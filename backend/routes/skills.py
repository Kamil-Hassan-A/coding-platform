import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_candidate
from models import AssessmentSession, Level, Skill, User, UserSkillProgress
from schemas import LevelProgressItem, SkillProgressResponse, SkillResponse

router = APIRouter(tags=["skills"])
LEVEL_ORDER = [
    Level.BEGINNER,
    Level.INTERMEDIATE_1,
    Level.INTERMEDIATE_2,
    Level.SPECIALIST_1,
    Level.SPECIALIST_2,
]
LEVEL_LABELS = {
    Level.BEGINNER: "Beginner",
    Level.INTERMEDIATE_1: "Intermediate 1",
    Level.INTERMEDIATE_2: "Intermediate 2",
    Level.SPECIALIST_1: "Specialist 1",
    Level.SPECIALIST_2: "Specialist 2",
}


def get_max_attempts() -> int:
    try:
        return int(os.getenv("MAX_ATTEMPTS_PER_LEVEL", "5"))
    except ValueError:
        return 5


@router.get("/skills", response_model=list[SkillResponse])
def list_skills(
    db: Session = Depends(get_db),
    _: User = Depends(require_candidate),
) -> list[SkillResponse]:
    skills = db.scalars(select(Skill).order_by(Skill.name.asc())).all()
    return [
        SkillResponse(skill_id=skill.id, name=skill.name, description=skill.description, icon_url=skill.icon_url)
        for skill in skills
    ]


@router.get("/user/progress", response_model=list[SkillProgressResponse])
def get_user_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> list[SkillProgressResponse]:
    max_attempts = get_max_attempts()
    skills = db.scalars(select(Skill).order_by(Skill.name.asc())).all()
    progress_rows = db.scalars(select(UserSkillProgress).where(UserSkillProgress.user_id == current_user.id)).all()

    progress_map = {(row.skill_id, row.level): row for row in progress_rows}
    responses: list[SkillProgressResponse] = []

    for skill in skills:
        levels: list[LevelProgressItem] = []
        for level in LEVEL_ORDER:
            attempts_used = db.scalar(
                select(func.count(AssessmentSession.id)).where(
                    AssessmentSession.user_id == current_user.id,
                    AssessmentSession.skill_id == skill.id,
                    AssessmentSession.level == level,
                )
            ) or 0
            progress = progress_map.get((skill.id, level))
            levels.append(
                LevelProgressItem(
                    level=level,
                    label=LEVEL_LABELS[level],
                    unlocked=bool(progress.unlocked) if progress else level == Level.BEGINNER,
                    cleared=bool(progress.cleared) if progress else False,
                    attempts_used=int(attempts_used),
                    attempts_remaining=max(0, max_attempts - int(attempts_used)),
                )
            )
        responses.append(SkillProgressResponse(skill_id=skill.id, skill_name=skill.name, levels=levels))

    return responses


@router.get("/skills/{skill_id}/levels", response_model=SkillProgressResponse)
def get_skill_levels(
    skill_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SkillProgressResponse:
    skill = db.scalar(select(Skill).where(Skill.id == skill_id))
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    max_attempts = get_max_attempts()
    progress_rows = db.scalars(
        select(UserSkillProgress).where(UserSkillProgress.user_id == current_user.id, UserSkillProgress.skill_id == skill.id)
    ).all()
    progress_map = {row.level: row for row in progress_rows}

    levels: list[LevelProgressItem] = []
    for level in LEVEL_ORDER:
        attempts_used = db.scalar(
            select(func.count(AssessmentSession.id)).where(
                AssessmentSession.user_id == current_user.id,
                AssessmentSession.skill_id == skill.id,
                AssessmentSession.level == level,
            )
        ) or 0
        progress = progress_map.get(level)
        levels.append(
            LevelProgressItem(
                level=level,
                label=LEVEL_LABELS[level],
                unlocked=bool(progress.unlocked) if progress else level == Level.BEGINNER,
                cleared=bool(progress.cleared) if progress else False,
                attempts_used=int(attempts_used),
                attempts_remaining=max(0, max_attempts - int(attempts_used)),
            )
        )

    return SkillProgressResponse(skill_id=skill.id, skill_name=skill.name, levels=levels)
