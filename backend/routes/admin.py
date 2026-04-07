import csv
import io
import logging
import os
from datetime import datetime, timezone
from time import monotonic
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import StreamingResponse
from jinja2 import Template
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from xhtml2pdf import pisa

from database import get_db
from dependencies import require_admin
from models import AssessmentSession, SessionStatus, SessionViolation, Skill, Submission, SubmissionStatus, User, UserRole
from schemas import (
    AdminCandidateRow,
    AdminCandidatesResponse,
    AdminCredentialRow,
    AdminCredentialsResponse,
    AdminStatsResponse,
    CandidateFullReport,
    SessionReportDetail,
    SubmissionDetail,
    TestCaseDetail,
    ViolationDetail,
)
from scripts.seed_new import DEFAULT_JSON_FILE, run_seed

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)
REPORT_NOT_FOUND_DETAIL = "Candidate not found"
PDF_FAILURE_DETAIL = "Failed to generate PDF report"
CSV_FAILURE_DETAIL = "Failed to export CSV report"
VIOLATION_TYPES = [
    "tab_switch",
    "tab_switch_shortcut",
    "window_blur",
    "fullscreen_exit",
    "paste",
    "copy",
    "cut",
    "select_all",
    "devtools_shortcut",
    "devtools",
    "devtools_open",
    "right_click",
    "unknown",
]
_REPORT_CACHE: dict[UUID, tuple[float, CandidateFullReport]] = {}
# Invalidate this cache when a new submission is created or when a session changes state/completes.


def _get_report_cache_ttl_seconds() -> int:
    raw_ttl = os.getenv("ADMIN_REPORT_CACHE_TTL_SECONDS", "0")
    try:
        return max(0, int(raw_ttl))
    except ValueError:
        return 0


def get_violation_summary(db: Session, session_id: UUID) -> dict[str, object]:
    breakdown = {violation_type: 0 for violation_type in VIOLATION_TYPES}

    rows = db.execute(
        select(SessionViolation.type, func.count(SessionViolation.id))
        .where(SessionViolation.session_id == session_id)
        .group_by(SessionViolation.type)
    ).all()

    total = 0
    for violation_type, count in rows:
        bucket = str(violation_type or "unknown")
        if bucket not in breakdown:
            bucket = "unknown"
        count_value = int(count or 0)
        breakdown[bucket] += count_value
        total += count_value

    if total == 0:
        severity = "none"
    elif total <= 3:
        severity = "low"
    elif total <= 7:
        severity = "medium"
    else:
        severity = "high"

    non_zero = {key: value for key, value in breakdown.items() if value > 0}
    most_common = max(non_zero, key=non_zero.get) if non_zero else None
    types_count = len(non_zero)

    fullscreen_exit = int(breakdown.get("fullscreen_exit", 0) or 0)
    devtools_open = int(breakdown.get("devtools_open", 0) or 0)
    devtools_shortcut = int(breakdown.get("devtools_shortcut", 0) or 0)
    paste = int(breakdown.get("paste", 0) or 0)
    copy = int(breakdown.get("copy", 0) or 0)
    tab_switch = int(breakdown.get("tab_switch", 0) or 0)
    right_click = int(breakdown.get("right_click", 0) or 0)

    risk_score = 0
    risk_score += min(fullscreen_exit, 5) * 2
    risk_score += min(devtools_open, 3) * 3
    risk_score += min(devtools_shortcut, 3) * 2
    risk_score += min(paste, 10) * 1
    risk_score += min(copy, 10) * 1
    risk_score += min(tab_switch, 10) * 1
    risk_score += min(right_click, 5) * 1

    if risk_score <= 5:
        risk_level = "low"
    elif risk_score <= 12:
        risk_level = "medium"
    else:
        risk_level = "high"

    weight_map = {
        "fullscreen_exit": 2,
        "devtools_open": 3,
        "devtools_shortcut": 2,
        "paste": 1,
        "copy": 1,
        "tab_switch": 1,
        "right_click": 1,
    }
    reason_map = {
        "devtools_open": "DevTools usage detected",
        "devtools_shortcut": "DevTools shortcut usage detected",
        "fullscreen_exit": "Frequent fullscreen exits",
        "paste": "Excessive paste activity",
        "copy": "Frequent copy activity",
        "tab_switch": "Frequent tab switching",
        "right_click": "Frequent right-click activity",
    }

    reason_counts = {
        "devtools_open": devtools_open,
        "devtools_shortcut": devtools_shortcut,
        "fullscreen_exit": fullscreen_exit,
        "paste": paste,
        "copy": copy,
        "tab_switch": tab_switch,
        "right_click": right_click,
    }

    ranked_reason_keys = sorted(
        [key for key, count in reason_counts.items() if count > 0],
        key=lambda key: (weight_map.get(key, 0) * reason_counts[key], reason_counts[key]),
        reverse=True,
    )
    risk_reasons = [reason_map[key] for key in ranked_reason_keys[:3] if key in reason_map] or []

    return {
        "total": total,
        "breakdown": breakdown,
        "severity": severity,
        "most_common": most_common,
        "types_count": types_count,
        "risk": {
            "score": int(risk_score),
            "level": risk_level,
            "reasons": risk_reasons,
        },
    }


def get_submission_summary(db: Session, session_id: UUID) -> dict[str, float | int]:
    aggregate_row = db.execute(
        select(
            func.count(Submission.id),
            func.max(Submission.score),
        ).where(Submission.session_id == session_id)
    ).one()

    total_submissions = int(aggregate_row[0] or 0)
    best_score = float(aggregate_row[1] or 0)

    latest_score_row = db.execute(
        select(Submission.score)
        .where(Submission.session_id == session_id)
        .order_by(Submission.submitted_at.desc(), Submission.id.desc())
        .limit(1)
    ).first()
    latest_score = float(latest_score_row[0]) if latest_score_row is not None and latest_score_row[0] is not None else 0.0

    return {
        "total": total_submissions,
        "best_score": best_score,
        "latest_score": latest_score,
    }


@router.post("/seed")
def seed_database(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> dict[str, str]:
    admin_seed_key = os.getenv("ADMIN_SEED_KEY")
    if not x_api_key or x_api_key != admin_seed_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        run_seed(DEFAULT_JSON_FILE)
        return {"message": "Database seeded successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to seed database") from exc


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> AdminStatsResponse:
    """Return high-level assessment stats for the admin dashboard."""

    total_employees = db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.CANDIDATE)
    ) or 0

    total_assessments = db.scalar(select(func.count(AssessmentSession.id))) or 0

    in_progress = db.scalar(
        select(func.count(AssessmentSession.id)).where(
            AssessmentSession.status == SessionStatus.ACTIVE
        )
    ) or 0

    completed = db.scalar(
        select(func.count(AssessmentSession.id)).where(
            AssessmentSession.status == SessionStatus.SUBMITTED
        )
    ) or 0

    terminated = db.scalar(
        select(func.count(AssessmentSession.id)).where(
            AssessmentSession.status.in_([SessionStatus.TIMED_OUT, SessionStatus.AUTO_SUBMITTED])
        )
    ) or 0

    # No manual review workflow exists yet; reserved for future use
    pending_review = 0

    return AdminStatsResponse(
        totalEmployees=int(total_employees),
        totalAssessments=int(total_assessments),
        inProgress=int(in_progress),
        completed=int(completed),
        terminated=int(terminated),
        pendingReview=pending_review,
    )



@router.get("/candidates", response_model=AdminCandidatesResponse)
def get_admin_candidates(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> AdminCandidatesResponse:
    candidate_users = db.scalars(select(User).where(User.role == UserRole.CANDIDATE).order_by(User.created_at.desc())).all()

    rows: list[AdminCandidateRow] = []
    for candidate in candidate_users:
        latest_submission = db.scalar(
            select(Submission)
            .where(Submission.user_id == candidate.id)
            .order_by(Submission.submitted_at.desc())
            .limit(1)
        )

        latest_skill_name: str | None = None
        score = 0
        status = "Pending"

        if latest_submission is not None:
            latest_skill = db.scalar(select(Skill).where(Skill.id == latest_submission.skill_id))
            latest_skill_name = latest_skill.name if latest_skill else None
            score = latest_submission.score
            status = "Pass" if latest_submission.status == SubmissionStatus.CLEARED else "Fail"

        rows.append(
            AdminCandidateRow(
                user_id=candidate.id,
                name=candidate.name,
                gender=candidate.gender or "Unknown",
                dept=candidate.department or "N/A",
                skill=latest_skill_name or "Not Attempted",
                score=score,
                status=status,
            )
        )

    return AdminCandidatesResponse(candidates=rows)


@router.get("/credentials", response_model=AdminCredentialsResponse)
def get_admin_credentials(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> AdminCredentialsResponse:
    candidate_users = db.scalars(select(User).where(User.role == UserRole.CANDIDATE).order_by(User.created_at.desc())).all()

    rows: list[AdminCredentialRow] = []
    for candidate in candidate_users:
        verified_skill_names = db.scalars(
            select(func.distinct(Skill.name))
            .join(Submission, Submission.skill_id == Skill.id)
            .where(
                Submission.user_id == candidate.id,
                Submission.status == SubmissionStatus.CLEARED,
            )
        ).all()

        has_active_session = db.scalar(
            select(func.count(AssessmentSession.id)).where(
                AssessmentSession.user_id == candidate.id,
                AssessmentSession.status == SessionStatus.ACTIVE,
            )
        ) or 0

        rows.append(
            AdminCredentialRow(
                id=candidate.id,
                employeeId=candidate.employee_id or str(candidate.id),
                name=candidate.name,
                department=candidate.department or "N/A",
                expIndium=max(0, candidate.exp_indium_years),
                expOverall=max(0, candidate.exp_overall_years),
                verifiedSkills=list(verified_skill_names),
                status="Active" if has_active_session > 0 or len(verified_skill_names) > 0 else "Inactive",
            )
        )

    return AdminCredentialsResponse(credentials=rows)


@router.get("/session-report/{session_id}")
def get_admin_session_report(
    session_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, object]:
    session_obj = db.scalar(select(AssessmentSession).where(AssessmentSession.id == session_id))
    if session_obj is None:
        raise HTTPException(status_code=404, detail="Session not found")

    violations = get_violation_summary(db=db, session_id=session_id)
    submissions = get_submission_summary(db=db, session_id=session_id)
    return {
        "session_id": str(session_id),
        "violations": violations,
        "submissions": submissions,
    }


def _extract_test_cases(judge_result: Any) -> list[TestCaseDetail]:
    if not isinstance(judge_result, dict):
        return []

    raw_cases = judge_result.get("cases", [])
    if not isinstance(raw_cases, list):
        return []

    return [
        TestCaseDetail(
            stdin=str(case.get("stdin", "")),
            expected_output=case.get("expected_output"),
            stdout=case.get("stdout"),
            stderr=case.get("stderr"),
            passed=bool(case.get("passed", False)),
        )
        for case in raw_cases
        if isinstance(case, dict)
    ]


def _build_submission_detail(submission: Submission, skill_name: str) -> SubmissionDetail:
    return SubmissionDetail(
        submission_id=submission.id,
        skill_name=skill_name,
        level=submission.level.value,
        language=submission.language,
        code=submission.code,
        score=submission.score,
        passed_tests=submission.passed_tests,
        total_tests=submission.total_tests,
        status=submission.status.value,
        submitted_at=submission.submitted_at,
        time_taken_seconds=submission.time_taken_seconds,
        cases=_extract_test_cases(submission.judge_result),
    )


def build_candidate_full_report(db: Session, user_id: UUID) -> CandidateFullReport:
    """Build nested candidate report used by both JSON and PDF endpoints."""
    start_time = monotonic()

    cache_ttl_seconds = _get_report_cache_ttl_seconds()
    if cache_ttl_seconds > 0:
        cached_entry = _REPORT_CACHE.get(user_id)
        if cached_entry is not None:
            cached_at, cached_report = cached_entry
            if monotonic() - cached_at < cache_ttl_seconds:
                if logger.isEnabledFor(logging.INFO):
                    logger.info("Report built in %.2fs for user_id=%s", monotonic() - start_time, user_id)
                return cached_report.model_copy(deep=True)

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

    sessions = db.scalars(
        select(AssessmentSession)
        .options(
            selectinload(AssessmentSession.skill),
            selectinload(AssessmentSession.violations),
            selectinload(AssessmentSession.submissions),
        )
        .where(AssessmentSession.user_id == user_id)
        .order_by(AssessmentSession.started_at.desc())
    ).all()

    session_details: list[SessionReportDetail] = []
    for session in sessions:
        skill = session.skill
        skill_name = skill.name if skill is not None else "Unknown"

        ordered_violations = sorted(session.violations, key=lambda item: item.timestamp)
        violations = [
            ViolationDetail(
                type=violation.type,
                timestamp=violation.timestamp,
                metadata=violation.metadata_,
            )
            for violation in ordered_violations
        ]

        violation_summary: dict[str, int] = {}
        for violation in ordered_violations:
            violation_summary[violation.type] = violation_summary.get(violation.type, 0) + 1

        latest_submission = None
        if session.submissions:
            latest_submission = max(
                session.submissions,
                key=lambda item: (
                    item.submitted_at or datetime.min.replace(tzinfo=timezone.utc),
                    item.id,
                ),
            )

        submission_detail: SubmissionDetail | None = None
        if latest_submission is not None:
            submission_detail = _build_submission_detail(latest_submission, skill_name)

        session_details.append(
            SessionReportDetail(
                session_id=session.id,
                skill_name=skill_name,
                level=session.level.value,
                started_at=session.started_at,
                submitted_at=session.submitted_at,
                status=session.status.value,
                attempt_number=session.attempt_number,
                violations=violations,
                violation_summary=violation_summary,
                submission=submission_detail,
            )
        )

    report = CandidateFullReport(
        user_id=user.id,
        name=user.name,
        email=user.email,
        employee_id=user.employee_id or "",
        department=user.department or "",
        gender=user.gender or "",
        exp_indium_years=max(0, user.exp_indium_years),
        exp_overall_years=max(0, user.exp_overall_years),
        generated_at=datetime.now(timezone.utc),
        sessions=session_details,
    )

    if cache_ttl_seconds > 0:
        _REPORT_CACHE[user_id] = (monotonic(), report.model_copy(deep=True))

    if logger.isEnabledFor(logging.INFO):
        logger.info("Report built in %.2fs for user_id=%s", monotonic() - start_time, user_id)

    return report


@router.get("/candidate-report/{user_id}", response_model=CandidateFullReport)
def get_candidate_report(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CandidateFullReport:
    """Return full nested candidate report as JSON for admin users."""
    _ = current_user

    return build_candidate_full_report(db=db, user_id=user_id)


@router.get("/candidate-report/{user_id}/pdf")
def get_candidate_report_pdf(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Response:
    """Return candidate report as a PDF attachment for admin users."""
    start_time = monotonic()
    _ = current_user

    report = build_candidate_full_report(db=db, user_id=user_id)

    template = Template(
        """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <style>
        @page { size: A4; margin: 24px; }
        body { margin: 0; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #111827; }
        h1, h2, h3, h4, p { margin: 0; }
        .header-title { font-size: 30px; font-weight: 700; color: #f97316; }
        .header-subtitle { margin-top: 4px; font-size: 12px; color: #6b7280; }
        .header-divider { margin-top: 10px; border-top: 1px solid #e5e7eb; }
        .section-title { margin-top: 16px; margin-bottom: 8px; font-size: 16px; font-weight: 700; color: #111827; }
        .card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 14px; }
        .summary-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .summary-table td { width: 50%; padding: 6px 8px; vertical-align: top; }
        .field-label { font-size: 10px; color: #6b7280; }
        .field-value { margin-top: 2px; font-size: 12px; color: #111827; font-weight: 700; }
        .session { page-break-before: always; margin-top: 16px; border: 1px solid #e5e7eb; padding: 14px; background: #ffffff; }
        .session-head { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .session-head td { vertical-align: top; padding: 6px 8px; }
        .skill-name { font-size: 18px; font-weight: 700; color: #f97316; }
        .metric-label { font-size: 10px; color: #6b7280; }
        .metric-value { margin-top: 2px; font-size: 13px; color: #111827; font-weight: 700; }
        .badge-pass { display: inline-block; padding: 2px 8px; border: 1px solid #16a34a; color: #16a34a; font-size: 10px; font-weight: 700; }
        .badge-fail { display: inline-block; padding: 2px 8px; border: 1px solid #dc2626; color: #dc2626; font-size: 10px; font-weight: 700; }
        .subsection-title { margin-top: 14px; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: #111827; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #e5e7eb; text-align: left; padding: 7px; font-size: 10px; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; }
        tr { page-break-inside: avoid; }
        th { background: #f3f4f6; color: #111827; font-weight: 700; }
        pre { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 10px; font-size: 10px; font-family: Consolas, "Courier New", monospace; white-space: pre-wrap; word-break: break-word; }
        .passed { color: #16a34a; font-weight: 700; }
        .failed { color: #dc2626; font-weight: 700; }
        .muted { color: #6b7280; font-size: 10px; }
    </style>
</head>
<body>
    <div class="header-title">SkillPulse</div>
    <div class="header-subtitle">Internal Assessment Platform</div>
    <div class="header-divider"></div>

    <div class="section-title">Candidate Summary</div>
    <div class="card">
        <table class="summary-table">
            <tr>
                <td>
                    <div class="field-label">Name</div>
                    <div class="field-value">{{ report.name }}</div>
                </td>
                <td>
                    <div class="field-label">Email</div>
                    <div class="field-value">{{ report.email }}</div>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="field-label">Employee ID</div>
                    <div class="field-value">{{ report.employee_id }}</div>
                </td>
                <td>
                    <div class="field-label">Department</div>
                    <div class="field-value">{{ report.department }}</div>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="field-label">Gender</div>
                    <div class="field-value">{{ report.gender }}</div>
                </td>
                <td>
                    <div class="field-label">Experience</div>
                    <div class="field-value">{{ report.exp_indium_years }} yrs at Indium, {{ report.exp_overall_years }} yrs overall</div>
                </td>
            </tr>
        </table>
    </div>

    {% for session in report.sessions %}
    <div class="session">
        <table class="session-head">
            <tr>
                <td style="width: 40%;">
                    <div class="metric-label">Skill</div>
                    <div class="skill-name">{{ session.skill_name }}</div>
                    <div class="metric-label" style="margin-top: 4px;">Level: <span class="metric-value">{{ session.level }}</span></div>
                </td>
                <td style="width: 20%;">
                    <div class="metric-label">Score</div>
                    <div class="metric-value">{{ session.submission.score if session.submission else "-" }}</div>
                </td>
                <td style="width: 20%;">
                    <div class="metric-label">Status</div>
                    {% if session.submission and session.submission.status in ["cleared", "submitted", "success"] %}
                    <span class="badge-pass">PASS</span>
                    {% elif session.submission and session.submission.status %}
                    <span class="badge-fail">FAIL</span>
                    {% elif session.status in ["submitted"] %}
                    <span class="badge-pass">PASS</span>
                    {% else %}
                    <span class="badge-fail">FAIL</span>
                    {% endif %}
                </td>
                <td style="width: 20%;">
                    <div class="metric-label">Time Taken</div>
                    <div class="metric-value">{{ session.submission.time_taken_seconds if session.submission else "-" }} sec</div>
                </td>
            </tr>
        </table>

        <table class="summary-table" style="margin-bottom: 8px;">
            <tr>
                <td>
                    <div class="field-label">Attempt Number</div>
                    <div class="field-value">{{ session.attempt_number }}</div>
                </td>
                <td>
                    <div class="field-label">Started At</div>
                    <div class="field-value">{{ session.started_at }}</div>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="field-label">Submitted At</div>
                    <div class="field-value">{{ session.submitted_at or "-" }}</div>
                </td>
                <td>
                    <div class="field-label">Session Status</div>
                    <div class="field-value">{{ session.status }}</div>
                </td>
            </tr>
        </table>

        <div class="subsection-title">Violations</div>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Timestamp</th>
                    <th>Metadata</th>
                </tr>
            </thead>
            <tbody>
                {% if session.violations %}
                    {% for violation in session.violations %}
                    <tr>
                        <td>{{ violation.type }}</td>
                        <td>{{ violation.timestamp }}</td>
                        <td>{{ violation.metadata if violation.metadata is not none else "" }}</td>
                    </tr>
                    {% endfor %}
                {% else %}
                    <tr>
                        <td colspan="3" class="muted">No violations recorded</td>
                    </tr>
                {% endif %}
            </tbody>
        </table>

        <div class="subsection-title">Submission</div>
        {% if session.submission %}
            <table class="summary-table" style="margin-bottom: 8px;">
                <tr>
                    <td><div class="field-label">Language</div><div class="field-value">{{ session.submission.language }}</div></td>
                    <td><div class="field-label">Score</div><div class="field-value">{{ session.submission.score }}</div></td>
                </tr>
                <tr>
                    <td><div class="field-label">Tests</div><div class="field-value">{{ session.submission.passed_tests }}/{{ session.submission.total_tests }}</div></td>
                    <td><div class="field-label">Time Taken</div><div class="field-value">{{ session.submission.time_taken_seconds }} seconds</div></td>
                </tr>
            </table>

            <div class="field-label">Code</div>
            <pre>{{ session.submission.code }}</pre>

            <div class="subsection-title">Test Cases</div>
            <table>
                <thead>
                    <tr>
                        <th>Input</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Result</th>
                    </tr>
                </thead>
                <tbody>
                    {% if session.submission.cases %}
                        {% for tc in session.submission.cases %}
                        <tr>
                            <td>{{ tc.stdin }}</td>
                            <td>{{ tc.expected_output if tc.expected_output is not none else "" }}</td>
                            <td>{{ tc.stdout if tc.stdout is not none else tc.stderr if tc.stderr is not none else "" }}</td>
                            <td class="{{ 'passed' if tc.passed else 'failed' }}">{{ 'Passed' if tc.passed else 'Failed' }}</td>
                        </tr>
                        {% endfor %}
                    {% else %}
                        <tr>
                            <td colspan="4" class="muted">No case details available</td>
                        </tr>
                    {% endif %}
                </tbody>
            </table>
        {% else %}
            <div class="muted">No submission for this session</div>
        {% endif %}
    </div>
    {% endfor %}
</body>
</html>
        """.strip()
    )

    html = template.render(report=report)
    pdf_buffer = io.BytesIO()
    try:
        pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
    except Exception as exc:
        logger.exception("PDF generation failed in %.2fs for user_id=%s", monotonic() - start_time, user_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL) from exc
    if pisa_status.err:
        logger.error("PDF generation returned errors in %.2fs for user_id=%s", monotonic() - start_time, user_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL)

    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()
    if not pdf_bytes:
        logger.error("PDF generation produced empty bytes in %.2fs for user_id=%s", monotonic() - start_time, user_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL)

    if logger.isEnabledFor(logging.INFO):
        logger.info("PDF generated in %.2fs for user_id=%s", monotonic() - start_time, user_id)

    safe_employee_id = (report.employee_id or str(report.user_id)).replace(" ", "_")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_employee_id}_report.pdf"'},
    )


@router.get("/export/candidates-csv")
def export_candidates_csv(
    skill_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> StreamingResponse:
    """Export candidate performance report as CSV for admin users."""
    start_time = monotonic()
    _ = current_user

    try:
        # For very large exports, chunked streaming or a background job export may be needed.
        candidate_users = db.scalars(
            select(User)
            .where(User.role == UserRole.CANDIDATE)
            .order_by(User.created_at.desc())
        ).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Name",
                "Email",
                "Employee ID",
                "Department",
                "Gender",
                "Skill",
                "Level",
                "Score",
                "Status",
                "Submitted At",
                "Violations Count",
                "Time Taken (seconds)",
            ]
        )

        candidate_ids = [candidate.id for candidate in candidate_users]
        latest_submission_by_user: dict[UUID, Submission] = {}
        skill_name_by_id: dict[UUID, str] = {}
        violations_count_by_session: dict[UUID, int] = {}

        if candidate_ids:
            latest_submission_query = select(Submission).where(Submission.user_id.in_(candidate_ids))
            if skill_id is not None:
                latest_submission_query = latest_submission_query.where(Submission.skill_id == skill_id)

            submissions = db.scalars(
                latest_submission_query.order_by(
                    Submission.user_id.asc(),
                    Submission.submitted_at.desc(),
                    Submission.id.desc(),
                )
            ).all()

            for submission in submissions:
                if submission.user_id not in latest_submission_by_user:
                    latest_submission_by_user[submission.user_id] = submission

            latest_submissions = list(latest_submission_by_user.values())
            skill_ids = {submission.skill_id for submission in latest_submissions}
            session_ids = {submission.session_id for submission in latest_submissions}

            if skill_ids:
                skills = db.scalars(select(Skill).where(Skill.id.in_(skill_ids))).all()
                skill_name_by_id = {skill.id: skill.name for skill in skills}

            if session_ids:
                violation_rows = db.execute(
                    select(SessionViolation.session_id, func.count(SessionViolation.id))
                    .where(SessionViolation.session_id.in_(session_ids))
                    .group_by(SessionViolation.session_id)
                ).all()
                violations_count_by_session = {
                    row[0]: int(row[1] or 0) for row in violation_rows
                }

        for candidate in candidate_users:
            latest_submission = latest_submission_by_user.get(candidate.id)

            skill_name = ""
            level = ""
            score = ""
            status = ""
            submitted_at = ""
            violations_count = ""
            time_taken_seconds = ""

            if latest_submission is not None:
                skill_name = skill_name_by_id.get(latest_submission.skill_id, "")
                level = latest_submission.level.value
                score = str(latest_submission.score)
                status = latest_submission.status.value
                submitted_at = latest_submission.submitted_at.isoformat() if latest_submission.submitted_at else ""
                violations_count = str(violations_count_by_session.get(latest_submission.session_id, 0))
                time_taken_seconds = str(latest_submission.time_taken_seconds)

            writer.writerow(
                [
                    candidate.name,
                    candidate.email,
                    candidate.employee_id or "",
                    candidate.department or "",
                    candidate.gender or "",
                    skill_name,
                    level,
                    score,
                    status,
                    submitted_at,
                    violations_count,
                    time_taken_seconds,
                ]
            )

        csv_content = output.getvalue()
        output.close()

        if logger.isEnabledFor(logging.INFO):
            logger.info("CSV exported in %.2fs for skill_id=%s", monotonic() - start_time, skill_id)

        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="candidates_report.csv"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("CSV export failed in %.2fs for skill_id=%s", monotonic() - start_time, skill_id)
        raise HTTPException(status_code=500, detail=CSV_FAILURE_DETAIL) from exc
