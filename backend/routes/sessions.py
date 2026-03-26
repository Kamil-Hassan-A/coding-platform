import os
import random
from datetime import datetime, timedelta, timezone
from uuid import UUID

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_candidate
from judge0_service import Judge0Service
from models import (
    AssessmentSession,
    Level,
    Problem,
    SessionStatus,
    Submission,
    SubmissionStatus,
    User,
    UserSkillProgress,
)

from schemas import (
    SessionDetailResponse,
    SessionDraftRequest,
    SessionDraftResponse,
    SessionProblemPayload,
    SessionStartRequest,
    SessionStartResponse,
    SessionSubmitRequest,
    SessionSubmitResponse,
)

router = APIRouter(tags=["sessions"])
judge0_service = Judge0Service()
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


def get_pass_threshold() -> int:
    try:
        return int(os.getenv("SCORE_PASS_THRESHOLD", "70"))
    except ValueError:
        return 70


def get_next_level(level: Level) -> Level | None:
    index = LEVEL_ORDER.index(level)
    if index + 1 >= len(LEVEL_ORDER):
        return None
    return LEVEL_ORDER[index + 1]


def ensure_session_owner(session_obj: AssessmentSession, current_user: User) -> None:
    if session_obj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session does not belong to current user")


def score_submission(
    db: Session,
    session_obj: AssessmentSession,
    code: str,
    language: str,
    forced_status: SubmissionStatus | None = None,
) -> Submission:
    if session_obj.submission is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session already submitted")

    problem = db.scalar(select(Problem).where(Problem.id == session_obj.problem_id))
    if problem is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    try:
        execution_result = judge0_service.execute(
            code=code,
            language=language,
            test_inputs=problem.hidden_test_cases or [],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except (requests.RequestException, TimeoutError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Judge0 execution failed") from exc

    score = int(execution_result.get("score", 0))
    passed_tests = int(execution_result.get("passed_tests", 0))
    total_tests = int(execution_result.get("total_tests", 0))

    default_status = SubmissionStatus.CLEARED if score >= get_pass_threshold() else SubmissionStatus.FAILED
    submission_status = forced_status or default_status

    current_time = datetime.now(timezone.utc)
    started_at = session_obj.started_at.astimezone(timezone.utc) if session_obj.started_at.tzinfo else session_obj.started_at.replace(tzinfo=timezone.utc)
    time_taken_seconds = max(0, int((current_time - started_at).total_seconds()))

    submission = Submission(
        session_id=session_obj.id,
        user_id=session_obj.user_id,
        problem_id=session_obj.problem_id,
        skill_id=session_obj.skill_id,
        level=session_obj.level,
        code=code,
        language=language,
        status=submission_status,
        score=score,
        passed_tests=passed_tests,
        total_tests=total_tests,
        time_taken_seconds=time_taken_seconds,
        judge_result={"cases": execution_result.get("cases", [])},
    )
    db.add(submission)

    session_obj.status = (
        SessionStatus.SUBMITTED
        if submission_status in (SubmissionStatus.CLEARED, SubmissionStatus.FAILED)
        else SessionStatus.TIMED_OUT
    )
    session_obj.submitted_at = current_time

    if submission_status == SubmissionStatus.CLEARED:
        progress = db.scalar(
            select(UserSkillProgress).where(
                UserSkillProgress.user_id == session_obj.user_id,
                UserSkillProgress.skill_id == session_obj.skill_id,
                UserSkillProgress.level == session_obj.level,
            )
        )
        if progress is None:
            progress = UserSkillProgress(
                user_id=session_obj.user_id,
                skill_id=session_obj.skill_id,
                level=session_obj.level,
                unlocked=True,
                cleared=True,
                cleared_at=current_time,
            )
            db.add(progress)
        else:
            progress.unlocked = True
            progress.cleared = True
            progress.cleared_at = current_time

        next_level = get_next_level(session_obj.level)
        if next_level is not None:
            next_progress = db.scalar(
                select(UserSkillProgress).where(
                    UserSkillProgress.user_id == session_obj.user_id,
                    UserSkillProgress.skill_id == session_obj.skill_id,
                    UserSkillProgress.level == next_level,
                )
            )
            if next_progress is None:
                next_progress = UserSkillProgress(
                    user_id=session_obj.user_id,
                    skill_id=session_obj.skill_id,
                    level=next_level,
                    unlocked=True,
                    cleared=False,
                )
                db.add(next_progress)
            else:
                next_progress.unlocked = True

    return submission


@router.post("/sessions/start", response_model=SessionStartResponse, status_code=status.HTTP_201_CREATED)
def start_session(
    payload: SessionStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SessionStartResponse:
    progress = db.scalar(
        select(UserSkillProgress).where(
            UserSkillProgress.user_id == current_user.id,
            UserSkillProgress.skill_id == payload.skill_id,
            UserSkillProgress.level == payload.level,
        )
    )
    if progress is None:
        progress = UserSkillProgress(
            user_id=current_user.id,
            skill_id=payload.skill_id,
            level=payload.level,
            unlocked=payload.level == Level.BEGINNER,
            cleared=False,
        )
        db.add(progress)
        db.flush()

    if not progress.unlocked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Level is locked")

    attempts_used = db.scalar(
        select(func.count(AssessmentSession.id)).where(
            AssessmentSession.user_id == current_user.id,
            AssessmentSession.skill_id == payload.skill_id,
            AssessmentSession.level == payload.level,
        )
    ) or 0
    max_attempts = get_max_attempts()
    if int(attempts_used) >= max_attempts:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Max attempts reached")

    problems = db.scalars(select(Problem).where(Problem.skill_id == payload.skill_id, Problem.level == payload.level)).all()
    if not problems:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    selected_problem = random.choice(problems)
    started = datetime.now(timezone.utc)
    expires_at = started + timedelta(minutes=selected_problem.time_limit_minutes)

    session_obj = AssessmentSession(
        user_id=current_user.id,
        problem_id=selected_problem.id,
        skill_id=payload.skill_id,
        level=payload.level,
        status=SessionStatus.ACTIVE,
        started_at=started,
        expires_at=expires_at,
        attempt_number=int(attempts_used) + 1,
    )

    try:
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create session") from exc

    attempts_remaining = max(0, max_attempts - session_obj.attempt_number)
    return SessionStartResponse(
        session_id=session_obj.id,
        problem_id=selected_problem.id,
        expires_at=session_obj.expires_at,
        attempt_number=session_obj.attempt_number,
        attempts_remaining=attempts_remaining,
        problem=SessionProblemPayload(
            title=selected_problem.title,
            description=selected_problem.description,
            sample_test_cases=selected_problem.sample_test_cases,
            time_limit_minutes=selected_problem.time_limit_minutes,
        ),
    )


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SessionDetailResponse:

    session_obj = db.scalar(select(AssessmentSession).where(AssessmentSession.id == session_id))
    if session_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    ensure_session_owner(session_obj, current_user)

    current_time = datetime.now(timezone.utc)
    expires_at = session_obj.expires_at.astimezone(timezone.utc) if session_obj.expires_at.tzinfo else session_obj.expires_at.replace(tzinfo=timezone.utc)
    if session_obj.status == SessionStatus.ACTIVE and expires_at <= current_time:
        session_obj.status = SessionStatus.TIMED_OUT
        db.commit()

    seconds_remaining = max(0, int((expires_at - current_time).total_seconds()))
    problem = db.scalar(select(Problem).where(Problem.id == session_obj.problem_id))
    if problem is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    return SessionDetailResponse(
        session_id=session_obj.id,
        status=session_obj.status,
        expires_at=expires_at,
        seconds_remaining=seconds_remaining,
        problem=SessionProblemPayload(
            title=problem.title,
            description=problem.description,
            sample_test_cases=problem.sample_test_cases,
            time_limit_minutes=problem.time_limit_minutes,
        ),
        last_draft_code=session_obj.last_draft_code,
        last_draft_lang=session_obj.last_draft_lang,
    )


@router.post("/sessions/{session_id}/draft", response_model=SessionDraftResponse)
def save_draft(
    session_id: UUID,
    payload: SessionDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SessionDraftResponse:
    session_obj = db.scalar(select(AssessmentSession).where(AssessmentSession.id == session_id))
    if session_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    ensure_session_owner(session_obj, current_user)

    if session_obj.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not active")

    session_obj.last_draft_code = payload.code
    session_obj.last_draft_lang = payload.language
    session_obj.draft_saved_at = datetime.now(timezone.utc)
    db.commit()

    return SessionDraftResponse(saved_at=session_obj.draft_saved_at)


@router.post("/sessions/{session_id}/submit", response_model=SessionSubmitResponse)
def submit_session(
    session_id: UUID,
    payload: SessionSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SessionSubmitResponse:
    session_obj = db.scalar(select(AssessmentSession).where(AssessmentSession.id == session_id))
    if session_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    ensure_session_owner(session_obj, current_user)

    if session_obj.status in (SessionStatus.SUBMITTED, SessionStatus.TIMED_OUT, SessionStatus.AUTO_SUBMITTED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session already closed")

    current_time = datetime.now(timezone.utc)
    expires_at = session_obj.expires_at.astimezone(timezone.utc) if session_obj.expires_at.tzinfo else session_obj.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= current_time:
        code_to_submit = session_obj.last_draft_code or ""
        lang_to_submit = session_obj.last_draft_lang or payload.language
        try:
            score_submission(
                db=db,
                session_obj=session_obj,
                code=code_to_submit,
                language=lang_to_submit,
                forced_status=SubmissionStatus.TIMED_OUT,
            )
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist submission") from exc
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expired; draft auto-submitted")

    try:
        submission = score_submission(
            db=db,
            session_obj=session_obj,
            code=payload.code,
            language=payload.language,
        )
        db.commit()
        db.refresh(submission)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist submission") from exc

    cases = submission.judge_result.get("cases", []) if isinstance(submission.judge_result, dict) else []
    return SessionSubmitResponse(
        submission_id=submission.id,
        session_id=session_obj.id,
        status=submission.status,
        score=submission.score,
        passed_tests=submission.passed_tests,
        total_tests=submission.total_tests,
        time_taken_seconds=submission.time_taken_seconds,
        cases=cases,
    )
