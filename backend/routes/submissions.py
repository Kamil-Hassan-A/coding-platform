import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_candidate
from models import AssessmentSession, Level, Submission, User, UserSkillProgress
from schemas import SubmissionResultsResponse

router = APIRouter(tags=["submissions"])
LEVEL_ORDER = [
    Level.BEGINNER,
    Level.INTERMEDIATE_1,
    Level.INTERMEDIATE_2,
    Level.SPECIALIST_1,
    Level.SPECIALIST_2,
]


def get_max_attempts() -> int:
    try:
        return int(os.getenv("MAX_ATTEMPTS_PER_LEVEL", "5"))
    except ValueError:
        return 5


def get_next_level(level: Level) -> Level | None:
    index = LEVEL_ORDER.index(level)
    if index + 1 >= len(LEVEL_ORDER):
        return None
    return LEVEL_ORDER[index + 1]


@router.get("/submissions/{submission_id}/results", response_model=SubmissionResultsResponse)
def get_submission_results(
    submission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SubmissionResultsResponse:
    submission = db.scalar(select(Submission).where(Submission.id == submission_id))
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    if submission.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Submission does not belong to current user")

    attempts_used = db.scalar(
        select(func.count(AssessmentSession.id)).where(
            AssessmentSession.user_id == current_user.id,
            AssessmentSession.skill_id == submission.skill_id,
            AssessmentSession.level == submission.level,
        )
    ) or 0
    attempts_used = int(attempts_used)
    attempts_remaining = max(0, get_max_attempts() - attempts_used)

    next_level_unlocked = False
    next_level = get_next_level(submission.level)
    if next_level is not None:
        next_progress = db.scalar(
            select(UserSkillProgress).where(
                UserSkillProgress.user_id == current_user.id,
                UserSkillProgress.skill_id == submission.skill_id,
                UserSkillProgress.level == next_level,
            )
        )
        next_level_unlocked = bool(next_progress.unlocked) if next_progress else False

    cases = submission.judge_result.get("cases", []) if isinstance(submission.judge_result, dict) else []
    return SubmissionResultsResponse(
        submission_id=submission.id,
        status=submission.status,
        score=submission.score,
        passed_tests=submission.passed_tests,
        total_tests=submission.total_tests,
        time_taken_seconds=submission.time_taken_seconds,
        attempts_used=attempts_used,
        attempts_remaining=attempts_remaining,
        next_level_unlocked=next_level_unlocked,
        cases=cases,
    )
