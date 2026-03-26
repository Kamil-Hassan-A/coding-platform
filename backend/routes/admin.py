import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin
from models import AssessmentSession, SessionStatus, Skill, Submission, SubmissionStatus, User, UserRole
from schemas import (
    AdminCandidateRow,
    AdminCandidatesResponse,
    AdminCredentialRow,
    AdminCredentialsResponse,
    AdminStatsResponse,
)
from scripts.seed import run_seed

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/seed")
def seed_database(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> dict[str, str]:
    admin_seed_key = os.getenv("ADMIN_SEED_KEY")
    if not x_api_key or x_api_key != admin_seed_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        run_seed()
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
