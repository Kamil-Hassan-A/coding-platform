import csv
import io
import logging
import os
from datetime import datetime, timezone
from time import monotonic
from typing import Any
from uuid import UUID
from zipfile import ZipFile

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from fastapi.templating import Jinja2Templates
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
    CandidateSessionListItem,
    CandidateSessionReport,
    ReportsZipExportRequest,
    SessionReportDetail,
    SubmissionDetail,
    TestCaseDetail,
    ViolationDetail,
)
from scripts.seed_new import DEFAULT_JSON_FILE, run_seed

router = APIRouter(prefix="/admin", tags=["admin"])
# Dynamically resolve templates directory relative to this file
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.normpath(os.path.join(_BASE_DIR, "..", "templates"))

# Ensure templates folder exists at runtime
if not os.path.exists(TEMPLATES_DIR):
    raise RuntimeError(f"CRITICAL: Templates directory not found at {TEMPLATES_DIR}")

templates = Jinja2Templates(directory=TEMPLATES_DIR)
logger = logging.getLogger(__name__)
logger.debug("Jinja2 templates directory resolved to: %s", TEMPLATES_DIR)

REPORT_NOT_FOUND_DETAIL = "Candidate not found"
PDF_FAILURE_DETAIL = "Failed to generate PDF report"
CSV_FAILURE_DETAIL = "Failed to export CSV report"
SESSION_NOT_FOUND_DETAIL = "Session not found"
INVALID_MODE_DETAIL = "Invalid mode parameter"
SESSION_CSV_FAILURE_DETAIL = "Failed to export session CSV report"
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
    employee_id: str | None = Query(None),
    years_min: int | None = Query(None),
    years_max: int | None = Query(None),
    exp_min: int | None = Query(None),
    exp_max: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> AdminCandidatesResponse:
    query = select(User).where(User.role == UserRole.CANDIDATE)

    if employee_id:
        query = query.where(User.employee_id.ilike(f"%{employee_id}%"))
    if years_min is not None:
        query = query.where(User.exp_indium_years >= years_min)
    if years_max is not None:
        query = query.where(User.exp_indium_years <= years_max)
    if exp_min is not None:
        query = query.where(User.exp_overall_years >= exp_min)
    if exp_max is not None:
        query = query.where(User.exp_overall_years <= exp_max)

    candidate_users = db.scalars(query.order_by(User.created_at.desc())).all()

    all_sessions = db.scalars(
        select(AssessmentSession)
        .options(selectinload(AssessmentSession.skill), selectinload(AssessmentSession.submissions))
        .order_by(AssessmentSession.started_at.desc())
    ).all()

    # Group sessions by user_id and skill_id, keeping the first (latest) one we see per skill
    sessions_by_user: dict[UUID, dict[UUID, AssessmentSession]] = {}
    for session in all_sessions:
        u_id = session.user_id
        if u_id not in sessions_by_user:
            sessions_by_user[u_id] = {}
        s_id = session.skill_id
        if s_id not in sessions_by_user[u_id]:
            sessions_by_user[u_id][s_id] = session

    rows: list[AdminCandidateRow] = []
    for candidate in candidate_users:
        user_sessions = sessions_by_user.get(candidate.id, {})

        if not user_sessions:
            rows.append(
                AdminCandidateRow(
                    user_id=candidate.id,
                    name=candidate.name,
                    gender=candidate.gender or "Unknown",
                    dept=candidate.department or "N/A",
                    skill="Not Attempted",
                    latest_session_id=None,
                    latest_skill_name=None,
                    latest_submitted_at=None,
                    score=0,
                    status="Pending",
                )
            )
        else:
            for skill_id, session in user_sessions.items():
                latest_submission = None
                if session.submissions:
                    latest_submission = max(
                        session.submissions,
                        key=lambda s: (s.submitted_at or datetime.min.replace(tzinfo=timezone.utc), s.id)
                    )

                skill_name = session.skill.name if session.skill else "Unknown"

                status = "Pending"
                score = 0
                if latest_submission:
                    score = latest_submission.score
                    status = "Pass" if latest_submission.status == SubmissionStatus.CLEARED else "Fail"
                else:
                    if session.status in [SessionStatus.TIMED_OUT, SessionStatus.AUTO_SUBMITTED]:
                        status = "Fail"
                    elif session.status == SessionStatus.SUBMITTED:
                        status = "Pass"
                    else:
                        status = "Pending"

                submitted_at = latest_submission.submitted_at if latest_submission else session.submitted_at

                rows.append(
                    AdminCandidateRow(
                        user_id=candidate.id,
                        name=candidate.name,
                        gender=candidate.gender or "Unknown",
                        dept=candidate.department or "N/A",
                        skill=skill_name,
                        latest_session_id=session.id,
                        latest_skill_name=skill_name,
                        latest_submitted_at=submitted_at,
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


def build_candidate_session_report(
    db: Session, user_id: UUID, session_id: UUID
) -> CandidateSessionReport:
    start_time = monotonic()

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

    session = db.scalar(
        select(AssessmentSession)
        .options(
            selectinload(AssessmentSession.skill),
            selectinload(AssessmentSession.violations),
            selectinload(AssessmentSession.submissions),
        )
        .where(
            AssessmentSession.id == session_id,
            AssessmentSession.user_id == user_id,
        )
    )
    if session is None:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

    skill_name = session.skill.name if session.skill is not None else "Unknown"

    ordered_violations = sorted(session.violations, key=lambda v: v.timestamp)
    violations = [
        ViolationDetail(
            type=v.type,
            timestamp=v.timestamp,
            metadata=v.metadata_,
        )
        for v in ordered_violations
    ]

    violation_summary: dict[str, int] = {}
    for v in ordered_violations:
        violation_summary[v.type] = violation_summary.get(v.type, 0) + 1

    latest_submission = None
    if session.submissions:
        latest_submission = max(
            session.submissions,
            key=lambda s: (
                s.submitted_at or datetime.min.replace(tzinfo=timezone.utc),
                s.id,
            ),
        )

    submission_detail = None
    if latest_submission is not None:
        submission_detail = _build_submission_detail(latest_submission, skill_name)

    session_detail = SessionReportDetail(
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

    report = CandidateSessionReport(
        user_id=user.id,
        name=user.name,
        email=user.email,
        employee_id=user.employee_id or "",
        department=user.department or "",
        gender=user.gender or "",
        exp_indium_years=max(0, user.exp_indium_years),
        exp_overall_years=max(0, user.exp_overall_years),
        generated_at=datetime.now(timezone.utc),
        session=session_detail,
    )

    if logger.isEnabledFor(logging.INFO):
        logger.info(
            "Session report built in %.2fs for user_id=%s session_id=%s",
            monotonic() - start_time, user_id, session_id,
        )

    return report


def get_candidate_sessions(db: Session, user_id: UUID) -> list[CandidateSessionListItem]:
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

    sessions = db.scalars(
        select(AssessmentSession)
        .options(
            selectinload(AssessmentSession.submissions),
            selectinload(AssessmentSession.skill),
        )
        .where(AssessmentSession.user_id == user_id)
        .order_by(AssessmentSession.submitted_at.desc(), AssessmentSession.started_at.desc())
    ).all()

    items: list[CandidateSessionListItem] = []
    for session in sessions:
        latest_submission = None
        if session.submissions:
            latest_submission = max(
                session.submissions,
                key=lambda s: (
                    s.submitted_at or datetime.min.replace(tzinfo=timezone.utc),
                    s.id,
                ),
            )

        items.append(
            CandidateSessionListItem(
                session_id=session.id,
                skill=session.skill.name if session.skill is not None else "Unknown",
                score=latest_submission.score if latest_submission is not None else None,
                status=latest_submission.status.value if latest_submission is not None else session.status.value,
                submitted_at=session.submitted_at,
            )
        )

    return items


@router.get("/session-report/{session_id}/csv")
def get_session_report_csv(
    session_id: UUID,
    csv_type: str = Query("summary", alias="type", pattern="^(summary|detailed)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> StreamingResponse:
    """Export specific session data as CSV for admin users."""
    start_time = monotonic()
    _ = current_user

    try:
        session = db.scalar(
            select(AssessmentSession)
            .options(
                selectinload(AssessmentSession.skill),
                selectinload(AssessmentSession.submissions),
                selectinload(AssessmentSession.violations),
            )
            .where(AssessmentSession.id == session_id)
        )
        if session is None:
            raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)

        candidate = db.scalar(select(User).where(User.id == session.user_id))
        if candidate is None:
            raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

        skill_name = session.skill.name if session.skill is not None else "Unknown"
        ordered_submissions = sorted(
            session.submissions,
            key=lambda submission: (
                submission.submitted_at or datetime.min.replace(tzinfo=timezone.utc),
                submission.id,
            ),
            reverse=True,
        )
        latest_submission = ordered_submissions[0] if ordered_submissions else None
        score = latest_submission.score if latest_submission is not None else None
        submitted_at = session.submitted_at or (
            latest_submission.submitted_at if latest_submission is not None else None
        )
        violations_count = len(session.violations)

        output = io.StringIO()
        writer = csv.writer(output)

        if csv_type == "detailed":
            writer.writerow(
                [
                    "Candidate Name",
                    "Session ID",
                    "Skill",
                    "Score",
                    "Status",
                    "Submitted At",
                    "Violations Count",
                    "Question ID",
                    "Language",
                    "Submission Status",
                    "Execution Time (seconds)",
                    "Passed Test Cases",
                ]
            )

            if ordered_submissions:
                for submission in ordered_submissions:
                    writer.writerow(
                        [
                            candidate.name,
                            str(session.id),
                            skill_name,
                            score if score is not None else "",
                            session.status.value,
                            submitted_at.isoformat() if submitted_at else "",
                            violations_count,
                            str(submission.problem_id),
                            submission.language,
                            submission.status.value,
                            submission.time_taken_seconds,
                            f"{submission.passed_tests}/{submission.total_tests}",
                        ]
                    )
            else:
                writer.writerow(
                    [
                        candidate.name,
                        str(session.id),
                        skill_name,
                        score if score is not None else "",
                        session.status.value,
                        submitted_at.isoformat() if submitted_at else "",
                        violations_count,
                        "",
                        "",
                        "",
                        "",
                        "",
                    ]
                )
        else:
            writer.writerow(
                [
                    "Candidate Name",
                    "Session ID",
                    "Skill",
                    "Score",
                    "Status",
                    "Submitted At",
                    "Violations Count",
                ]
            )
            writer.writerow(
                [
                    candidate.name,
                    str(session.id),
                    skill_name,
                    score if score is not None else "",
                    session.status.value,
                    submitted_at.isoformat() if submitted_at else "",
                    violations_count,
                ]
            )

        csv_content = output.getvalue()
        output.close()

        if logger.isEnabledFor(logging.INFO):
            logger.info(
                "Session CSV exported in %.2fs for session_id=%s csv_type=%s",
                monotonic() - start_time,
                session_id,
                csv_type,
            )

        safe_skill = (skill_name or "unknown").replace(" ", "_")
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="session_{session_id}_{safe_skill}_{timestamp}.csv"'
                )
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Session CSV export failed in %.2fs for session_id=%s",
            monotonic() - start_time,
            session_id,
        )
        raise HTTPException(status_code=500, detail=SESSION_CSV_FAILURE_DETAIL) from exc


def build_session_report(db: Session, session_id: UUID) -> dict[str, object]:
    """Build single session report with candidate info, submission, and violations."""
    session = db.scalar(
        select(AssessmentSession)
        .options(
            selectinload(AssessmentSession.skill),
            selectinload(AssessmentSession.violations),
            selectinload(AssessmentSession.submissions),
        )
        .where(AssessmentSession.id == session_id)
    )

    if session is None:
        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)

    user = db.scalar(select(User).where(User.id == session.user_id))
    if user is None or user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)

    skill_name = session.skill.name if session.skill is not None else "Unknown"

    ordered_violations = sorted(session.violations, key=lambda item: item.timestamp)
    violations = [
        ViolationDetail(
            type=violation.type,
            timestamp=violation.timestamp,
            metadata=violation.metadata_,
        )
        for violation in ordered_violations
    ]

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

    return {
        "candidate": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "employee_id": user.employee_id or "",
            "department": user.department or "",
        },
        "session": {
            "session_id": str(session.id),
            "skill_name": skill_name,
            "level": session.level.value,
            "started_at": session.started_at,
            "submitted_at": session.submitted_at,
            "status": session.status.value,
            "attempt_number": session.attempt_number,
        },
        "submission": submission_detail,
        "violations": violations,
    }


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

    template = templates.get_template("candidate_report.html")
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


@router.get("/candidate-report/{user_id}/session/{session_id}", response_model=CandidateSessionReport)
def get_candidate_session_report(
    user_id: UUID,
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CandidateSessionReport:
    _ = current_user
    return build_candidate_session_report(db=db, user_id=user_id, session_id=session_id)


@router.get("/candidate/{user_id}/sessions", response_model=list[CandidateSessionListItem])
def get_candidate_sessions_for_admin(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[CandidateSessionListItem]:
    return get_candidate_sessions(db=db, user_id=user_id)


@router.get("/candidate-report/{user_id}/session/{session_id}/pdf")
def get_candidate_session_report_pdf(
    user_id: UUID,
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Response:
    start_time = monotonic()
    _ = current_user

    report = build_candidate_session_report(db=db, user_id=user_id, session_id=session_id)

    template = templates.get_template("candidate_session_report.html")
    html = template.render(report=report)
    pdf_buffer = io.BytesIO()
    try:
        pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
    except Exception as exc:
        logger.exception(
            "Session PDF generation failed in %.2fs for user_id=%s session_id=%s",
            monotonic() - start_time, user_id, session_id,
        )
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL) from exc
    if pisa_status.err:
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL)

    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL)

    if logger.isEnabledFor(logging.INFO):
        logger.info(
            "Session PDF generated in %.2fs for user_id=%s session_id=%s",
            monotonic() - start_time, user_id, session_id,
        )

    safe_employee_id = (report.employee_id or str(report.user_id)).replace(" ", "_")
    safe_skill = report.session.skill_name.replace(" ", "_")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_employee_id}_{safe_skill}_session_report.pdf"'
            )
        },
    )


@router.get("/candidate-report/{user_id}/latest")
def get_candidate_report_latest(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict[str, object]:
    """Return latest session report for candidate as JSON."""
    _ = current_user

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

    latest_session = db.scalar(
        select(AssessmentSession)
        .where(AssessmentSession.user_id == user_id)
        .order_by(AssessmentSession.submitted_at.desc(), AssessmentSession.started_at.desc())
        .limit(1)
    )

    if latest_session is None:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

    return build_session_report(db=db, session_id=latest_session.id)


@router.get("/candidate-report/{user_id}/latest/pdf")
def get_candidate_report_latest_pdf(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Response:
    """Return latest session report for candidate as PDF."""
    start_time = monotonic()
    _ = current_user

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

    latest_session = db.scalar(
        select(AssessmentSession)
        .where(AssessmentSession.user_id == user_id)
        .order_by(AssessmentSession.submitted_at.desc(), AssessmentSession.started_at.desc())
        .limit(1)
    )

    if latest_session is None:
        raise HTTPException(status_code=404, detail=REPORT_NOT_FOUND_DETAIL)

    report = build_session_report(db=db, session_id=latest_session.id)

    template = templates.get_template("session_report.html")
    html = template.render(
        candidate=report["candidate"],
        session=report["session"],
        submission=report["submission"],
        violations=report["violations"],
    )

    pdf_buffer = io.BytesIO()
    try:
        pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
    except Exception as exc:
        logger.exception("PDF generation failed in %.2fs for user_id=%s (latest)", monotonic() - start_time, user_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL) from exc
    if pisa_status.err:
        logger.error("PDF generation returned errors in %.2fs for user_id=%s (latest)", monotonic() - start_time, user_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL)

    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()
    if not pdf_bytes:
        logger.error("PDF generation produced empty bytes in %.2fs for user_id=%s (latest)", monotonic() - start_time, user_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL)

    if logger.isEnabledFor(logging.INFO):
        logger.info("PDF generated in %.2fs for user_id=%s (latest)", monotonic() - start_time, user_id)

    safe_employee_id = (user.employee_id or str(user.id)).replace(" ", "_")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_employee_id}_latest_report.pdf"'},
    )


@router.get("/session-report/{session_id}")
def get_session_report(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict[str, object]:
    """Return specific session report as JSON."""
    _ = current_user

    return build_session_report(db=db, session_id=session_id)


@router.post("/export/reports-zip")
def export_reports_zip(
    payload: ReportsZipExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> StreamingResponse:
    """Export candidate PDFs as a ZIP archive for admin users."""
    start_time = monotonic()
    _ = current_user

    try:
        if not payload.user_ids:
            raise HTTPException(status_code=400, detail="No user IDs provided")

        candidates = db.scalars(
            select(User)
            .where(User.id.in_(payload.user_ids), User.role == UserRole.CANDIDATE)
            .order_by(User.created_at.desc())
        ).all()

        zip_buffer = io.BytesIO()
        with ZipFile(zip_buffer, mode="w") as zip_file:
            for candidate in candidates:
                if payload.mode == "full":
                    report = build_candidate_full_report(db=db, user_id=candidate.id)
                    template = templates.get_template("candidate_report.html")
                    html = template.render(report=report)
                else:
                    latest_session = db.scalar(
                        select(AssessmentSession)
                        .where(AssessmentSession.user_id == candidate.id)
                        .order_by(AssessmentSession.submitted_at.desc(), AssessmentSession.started_at.desc())
                        .limit(1)
                    )
                    if latest_session is None:
                        continue
                    report = build_session_report(db=db, session_id=latest_session.id)
                    template = templates.get_template("session_report.html")
                    html = template.render(
                        candidate=report["candidate"],
                        session=report["session"],
                        submission=report["submission"],
                        violations=report["violations"],
                    )

                pdf_buffer = io.BytesIO()
                pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
                if pisa_status.err:
                    continue

                safe_employee_id = (candidate.employee_id or str(candidate.id)).replace(" ", "_")
                zip_file.writestr(f"candidate_{safe_employee_id}.pdf", pdf_buffer.getvalue())

        zip_bytes = zip_buffer.getvalue()
        zip_buffer.close()

        if logger.isEnabledFor(logging.INFO):
            logger.info("Reports ZIP generated in %.2fs for mode=%s count=%s", monotonic() - start_time, payload.mode, len(candidates))

        return StreamingResponse(
            iter([zip_bytes]),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="reports_{payload.mode}.zip"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Reports ZIP export failed in %.2fs for mode=%s", monotonic() - start_time, payload.mode)
        raise HTTPException(status_code=500, detail="Failed to export reports ZIP") from exc


@router.get("/session-report/{session_id}/pdf")
def get_session_report_pdf(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Response:
    """Return specific session report as PDF."""
    start_time = monotonic()
    _ = current_user

    report = build_session_report(db=db, session_id=session_id)

    template = templates.get_template("session_report.html")
    html = template.render(
        candidate=report["candidate"],
        session=report["session"],
        submission=report["submission"],
        violations=report["violations"],
    )

    pdf_buffer = io.BytesIO()
    try:
        pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
    except Exception as exc:
        logger.exception("PDF generation failed in %.2fs for session_id=%s", monotonic() - start_time, session_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL) from exc
    if pisa_status.err:
        logger.error("PDF generation returned errors in %.2fs for session_id=%s", monotonic() - start_time, session_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL)

    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()
    if not pdf_bytes:
        logger.error("PDF generation produced empty bytes in %.2fs for session_id=%s", monotonic() - start_time, session_id)
        raise HTTPException(status_code=500, detail=PDF_FAILURE_DETAIL)

    if logger.isEnabledFor(logging.INFO):
        logger.info("PDF generated in %.2fs for session_id=%s", monotonic() - start_time, session_id)

    candidate_info = report["candidate"]
    safe_employee_id = (candidate_info.get("employee_id") or candidate_info.get("id", "unknown")).replace(" ", "_")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_employee_id}_session_report.pdf"'},
    )
@router.get("/export/candidates-csv")
def export_candidates_csv(
    mode: str = Query("latest", pattern="^(latest|all)$"),
    skill: str | None = None,
    gender: str | None = None,
    department: str | None = None,
    min_score: int | None = Query(default=None, ge=0),
    max_score: int | None = Query(default=None, ge=0),
    skill_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> StreamingResponse:
    """Export candidate performance report as CSV for admin users.
    
    Modes:
    - latest: Only latest session per candidate
    - all: Include all sessions (one row per session per candidate)
    """
    start_time = monotonic()
    _ = current_user

    try:
        if mode not in ("latest", "all"):
            raise HTTPException(status_code=400, detail=INVALID_MODE_DETAIL)

        # For very large exports, chunked streaming or a background job export may be needed.
        candidate_query = select(User).where(User.role == UserRole.CANDIDATE)
        if gender:
            candidate_query = candidate_query.where(User.gender == gender)
        if department:
            candidate_query = candidate_query.where(User.department == department)
        candidate_users = db.scalars(candidate_query.order_by(User.created_at.desc())).all()

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
        candidate_by_id = {candidate.id: candidate for candidate in candidate_users}
        skill_name_by_id: dict[UUID, str] = {}
        violations_count_by_session: dict[UUID, int] = {}

        if candidate_ids:
            if mode == "latest":
                # Get only latest submission per candidate
                latest_query = select(Submission).where(Submission.user_id.in_(candidate_ids))
                if skill_id is not None:
                    latest_query = latest_query.where(Submission.skill_id == skill_id)
                if min_score is not None:
                    latest_query = latest_query.where(Submission.score >= min_score)
                if max_score is not None:
                    latest_query = latest_query.where(Submission.score <= max_score)

                if skill:
                    matching_skill_ids = set(
                        db.scalars(select(Skill.id).where(func.lower(Skill.name) == skill.strip().lower())).all()
                    )
                    if matching_skill_ids:
                        latest_query = latest_query.where(Submission.skill_id.in_(matching_skill_ids))
                    else:
                        latest_query = latest_query.where(False)

                submissions = db.scalars(
                    latest_query.order_by(
                        Submission.user_id.asc(),
                        Submission.submitted_at.desc(),
                        Submission.id.desc(),
                    )
                ).all()

                latest_submission_by_user: dict[UUID, Submission] = {}
                for submission in submissions:
                    if submission.user_id not in latest_submission_by_user:
                        latest_submission_by_user[submission.user_id] = submission

                if skill_id is not None:
                    latest_submission_by_user = {
                        k: v for k, v in latest_submission_by_user.items()
                        if v.skill_id == skill_id
                    }

                submissions_to_export = list(latest_submission_by_user.values())
            else:
                # Get all submissions per candidate
                query = select(Submission).where(Submission.user_id.in_(candidate_ids))
                if skill_id is not None:
                    query = query.where(Submission.skill_id == skill_id)
                if min_score is not None:
                    query = query.where(Submission.score >= min_score)
                if max_score is not None:
                    query = query.where(Submission.score <= max_score)

                if skill:
                    matching_skill_ids = set(
                        db.scalars(select(Skill.id).where(func.lower(Skill.name) == skill.strip().lower())).all()
                    )
                    if matching_skill_ids:
                        query = query.where(Submission.skill_id.in_(matching_skill_ids))
                    else:
                        query = query.where(False)

                submissions_to_export = db.scalars(
                    query.order_by(
                        Submission.user_id.asc(),
                        Submission.submitted_at.desc(),
                        Submission.id.desc(),
                    )
                ).all()

            skill_ids = {submission.skill_id for submission in submissions_to_export}
            session_ids = {submission.session_id for submission in submissions_to_export}

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

            # Build rows for each submission
            for submission in submissions_to_export:
                candidate = candidate_by_id.get(submission.user_id)
                if not candidate:
                    continue

                skill_name = skill_name_by_id.get(submission.skill_id, "")
                level = submission.level.value
                score = str(submission.score)
                status = submission.status.value
                submitted_at = submission.submitted_at.isoformat() if submission.submitted_at else ""
                violations_count = str(violations_count_by_session.get(submission.session_id, 0))
                time_taken_seconds = str(submission.time_taken_seconds)

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
            logger.info(
                "CSV exported in %.2fs (mode=%s, skill=%s, gender=%s, department=%s, min_score=%s, max_score=%s, skill_id=%s)",
                monotonic() - start_time,
                mode,
                skill,
                gender,
                department,
                min_score,
                max_score,
                skill_id,
            )

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        filename = f"candidates_{mode}_{timestamp}.csv"
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "CSV export failed in %.2fs (mode=%s, skill=%s, gender=%s, department=%s, min_score=%s, max_score=%s, skill_id=%s)",
            monotonic() - start_time,
            mode,
            skill,
            gender,
            department,
            min_score,
            max_score,
            skill_id,
        )
        raise HTTPException(status_code=500, detail=CSV_FAILURE_DETAIL) from exc
