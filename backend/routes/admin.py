import os
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin
from models import AssessmentSession, SessionStatus, SessionViolation, Skill, Submission, SubmissionStatus, User, UserRole
from schemas import (
    AdminCandidateRow,
    AdminCandidatesResponse,
    AdminCredentialRow,
    AdminCredentialsResponse,
    AdminStatsResponse,
)
from scripts.seed_new import DEFAULT_JSON_FILE, run_seed

router = APIRouter(prefix="/admin", tags=["admin"])
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

    if risk_score == 0:
        risk_level = "none"
    elif risk_score <= 5:
        risk_level = "low"
    elif risk_score <= 12:
        risk_level = "medium"
    else:
        risk_level = "high"

    reason_candidates = [
        ("devtools_open", devtools_open),
        ("fullscreen_exit", fullscreen_exit),
        ("paste", paste),
        ("copy", copy),
        ("tab_switch", tab_switch),
    ]
    reason_candidates.sort(key=lambda item: item[1], reverse=True)
    top_reason_key = next((key for key, count in reason_candidates if count > 0), None)

    reason_map = {
        "devtools_open": "DevTools usage detected",
        "fullscreen_exit": "Frequent fullscreen exits",
        "paste": "Excessive paste activity",
        "copy": "Frequent copy activity",
        "tab_switch": "Frequent tab switching",
    }
    risk_reason = reason_map.get(top_reason_key, "No suspicious activity")

    return {
        "total": total,
        "breakdown": breakdown,
        "severity": severity,
        "most_common": most_common,
        "types_count": types_count,
        "risk": {
            "score": int(risk_score),
            "level": risk_level,
            "flagged": risk_level == "high",
            "reason": risk_reason,
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
