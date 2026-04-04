import os
import random
import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
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
    Skill,
    SessionViolation,
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
    SessionRunRequest,
    SessionRunResponse,
    SessionStartRequest,
    SessionStartResponse,
    SessionSubmitRequest,
    SessionSubmitResponse,
    ViolationCreate,
)

router = APIRouter(tags=["sessions"])
judge0_service = Judge0Service()
logger = logging.getLogger(__name__)
ALLOWED_VIOLATION_TYPES = {
    "tab_switch",
    "window_blur",
    "tab_switch_shortcut",
    "fullscreen_exit",
    "paste",
    "paste_attempt",
    "copy",
    "cut",
    "select_all",
    "devtools_shortcut",
    "devtools",
    "devtools_open",
    "right_click",
    "unknown",
}
LEVEL_ORDER = [
    Level.BEGINNER,
    Level.INTERMEDIATE_1,
    Level.INTERMEDIATE_2,
    Level.SPECIALIST_1,
    Level.SPECIALIST_2,
]
MULTI_QUESTION_COUNT = 2


def preferred_difficulty_pair(level: Level) -> tuple[str, str]:
    if level == Level.BEGINNER:
        return ("easy", "hard")
    if level in (Level.INTERMEDIATE_1, Level.INTERMEDIATE_2):
        return ("medium", "hard")
    return ("medium", "hard")


def choose_two_problems(problems: list[Problem], level: Level) -> list[Problem]:
    if len(problems) < MULTI_QUESTION_COUNT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="At least 2 questions are required to start this assessment level",
        )

    labeled = [(problem, problem.difficulty_label) for problem in problems]
    preferred_first, preferred_second = preferred_difficulty_pair(level)

    first_pool = [problem for problem, difficulty in labeled if difficulty == preferred_first]
    second_pool = [problem for problem, difficulty in labeled if difficulty == preferred_second]

    if first_pool and second_pool:
        first = random.choice(first_pool)
        second_candidates = [problem for problem in second_pool if problem.id != first.id]
        if second_candidates:
            second = random.choice(second_candidates)
            return [first, second]

    sampled = random.sample(problems, MULTI_QUESTION_COUNT)
    return [sampled[0], sampled[1]]


def build_question_set_payload(problem_ids: list[UUID]) -> str:
    return json.dumps(
        {
            "format": "multi_question_v1",
            "problem_ids": [str(problem_id) for problem_id in problem_ids],
        }
    )


def parse_question_ids(raw: str | None, primary_problem_id: UUID) -> list[UUID]:
    ordered_ids: list[UUID] = [primary_problem_id]
    if not raw:
        return ordered_ids

    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return ordered_ids

    if not isinstance(parsed, dict) or parsed.get("format") != "multi_question_v1":
        return ordered_ids

    values = parsed.get("problem_ids")
    if not isinstance(values, list):
        return ordered_ids

    for value in values:
        try:
            parsed_id = UUID(str(value))
        except (TypeError, ValueError):
            continue
        if parsed_id not in ordered_ids:
            ordered_ids.append(parsed_id)
        if len(ordered_ids) >= MULTI_QUESTION_COUNT:
            break

    return ordered_ids


def build_problem_payload(problem: Problem) -> SessionProblemPayload:
    return SessionProblemPayload(
        problem_id=problem.id,
        title=problem.title,
        description=problem.description,
        templateCode=resolve_template_code(problem.starter_code),
        starter_code=problem.starter_code,
        tags=[str(tag) for tag in (problem.tags or [])],
        sample_test_cases=problem.sample_test_cases,
        time_limit_minutes=problem.time_limit_minutes,
    )


def get_session_problem_set(db: Session, session_obj: AssessmentSession) -> list[Problem]:
    ordered_ids = parse_question_ids(session_obj.last_draft_code, session_obj.problem_id)
    resolved: list[Problem] = []

    for problem_id in ordered_ids:
        problem = db.scalar(select(Problem).where(Problem.id == problem_id))
        if problem is None:
            continue
        if problem.skill_id != session_obj.skill_id or problem.level != session_obj.level:
            continue
        resolved.append(problem)

    if not resolved:
        primary = db.scalar(select(Problem).where(Problem.id == session_obj.problem_id))
        if primary is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
        resolved.append(primary)

    return resolved


def resolve_problem_from_session(
    db: Session,
    session_obj: AssessmentSession,
    requested_problem_id: UUID | None,
) -> Problem:
    problems = get_session_problem_set(db, session_obj)
    if requested_problem_id is None:
        return problems[0]

    for problem in problems:
        if problem.id == requested_problem_id:
            return problem

    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Problem is not part of this session")


def execute_problem(
    problem: Problem,
    skill: Skill,
    code: str,
    language: str,
    *,
    use_hidden_cases: bool,
) -> dict[str, Any]:
    resolved_monaco, resolved_language_id = resolve_language_from_skill(language, skill.allowed_languages or [])

    test_inputs = problem.hidden_test_cases if use_hidden_cases else problem.sample_test_cases
    try:
        if resolved_monaco in ("html_css_js", "html", "css", "javascript_web"):
            cases = [
                {
                    "stdin": str(case.get("input", "")),
                    "expected_output": str(case.get("output", "")),
                    "stdout": "Pending AI feedback",
                    "stderr": None,
                    "compile_output": None,
                    "message": None,
                    "status": {"id": 3, "description": "Accepted"},
                    "time": "0",
                    "memory": None,
                    "passed": True,
                }
                for case in (test_inputs or [])
                if isinstance(case, dict)
            ]
            execution_result = {
                "score": 100,
                "passed_tests": len(cases),
                "total_tests": len(cases),
                "time_taken": 0,
                "cases": cases,
            }
        else:
            execution_result = judge0_service.execute(
                code=code,
                language_id=resolved_language_id,
                test_inputs=test_inputs or [],
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except (requests.RequestException, TimeoutError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Judge0 execution failed: {str(exc)}") from exc

    return {
        "resolved_monaco": resolved_monaco,
        "score": int(execution_result.get("score", 0)),
        "passed_tests": int(execution_result.get("passed_tests", 0)),
        "total_tests": int(execution_result.get("total_tests", 0)),
        "time_taken": int(execution_result.get("time_taken", 0)),
        "cases": execution_result.get("cases", []),
    }


def _truncate_text(value: Any, limit: int = 2000) -> str:
    text = "" if value is None else str(value)
    if len(text) <= limit:
        return text
    return f"{text[:limit]}...<truncated:{len(text) - limit}>"


def _compute_overall_status(cases: list[dict[str, Any]]) -> str:
    if not cases:
        return "runtime_error"

    statuses = [str(case.get("normalized_status") or "").strip() for case in cases if isinstance(case, dict)]
    if any(status == "compile_error" for status in statuses):
        return "compile_error"
    if any(status == "runtime_error" for status in statuses):
        return "runtime_error"
    if any(status == "time_limit_exceeded" for status in statuses):
        return "time_limit_exceeded"
    if statuses and all(status == "success" for status in statuses):
        return "success"
    return "runtime_error"


def resolve_template_code(starter_code: object) -> str | None:
    if isinstance(starter_code, dict):
        for key in ("python", "default", "javascript", "java"):
            value = starter_code.get(key)
            if isinstance(value, str) and value.strip():
                return value
        for value in starter_code.values():
            if isinstance(value, str) and value.strip():
                return value
        return None
    if isinstance(starter_code, str) and starter_code.strip():
        return starter_code
    return None


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


def resolve_language_from_skill(language: str, allowed_languages: list[Any]) -> tuple[str, int]:
    requested = (language or "").strip().lower()
    if not requested:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Language is required")

    for item in allowed_languages or []:
        if not isinstance(item, dict):
            continue
        lang_id = item.get("id")
        monaco = str(item.get("monaco") or "").strip().lower()
        name = str(item.get("name") or "").strip().lower()
        if lang_id is None:
            continue

        if requested == monaco or requested == name or requested == str(lang_id).strip().lower():
            try:
                return (monaco or requested), int(lang_id)
            except (TypeError, ValueError):
                continue

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Selected language is not allowed for this skill",
    )


def score_submission(
    db: Session,
    session_obj: AssessmentSession,
    code: str,
    language: str,
    forced_status: SubmissionStatus | None = None,
) -> Submission:
    if session_obj.submission is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session already submitted")

    problem = resolve_problem_from_session(db, session_obj, None)
    skill = db.scalar(select(Skill).where(Skill.id == session_obj.skill_id))
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    execution_result = execute_problem(
        problem=problem,
        skill=skill,
        code=code,
        language=language,
        use_hidden_cases=True,
    )

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
        language=execution_result["resolved_monaco"],
        status=submission_status,
        score=score,
        passed_tests=passed_tests,
        total_tests=total_tests,
        time_taken_seconds=time_taken_seconds,
        judge_result={"cases": execution_result.get("cases", [])},
    )
    db.add(submission)

    if submission_status == SubmissionStatus.TIMED_OUT:
        session_obj.status = SessionStatus.TIMED_OUT
        session_obj.submitted_at = current_time
    else:
        # Keep submitted state for analytics compatibility while allowing additional submits/runs.
        session_obj.status = SessionStatus.SUBMITTED
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
    skill = db.scalar(select(Skill).where(Skill.id == payload.skill_id))
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

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

    selected_problems = choose_two_problems(problems, payload.level)
    selected_problem = selected_problems[0]
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
        last_draft_code=build_question_set_payload([problem.id for problem in selected_problems]),
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
        problem=build_problem_payload(selected_problem),
        problems=[build_problem_payload(problem) for problem in selected_problems],
        allowed_languages=skill.allowed_languages or [],
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
    problems = get_session_problem_set(db, session_obj)
    primary_problem = problems[0]
    skill = db.scalar(select(Skill).where(Skill.id == session_obj.skill_id))
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    return SessionDetailResponse(
        session_id=session_obj.id,
        status=session_obj.status,
        expires_at=expires_at,
        seconds_remaining=seconds_remaining,
        problem=build_problem_payload(primary_problem),
        problems=[build_problem_payload(problem) for problem in problems],
        allowed_languages=skill.allowed_languages or [],
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


@router.post("/sessions/{session_id}/violation")
def log_violation(
    session_id: UUID,
    payload: ViolationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> dict[str, str]:
    session_obj = db.scalar(select(AssessmentSession).where(AssessmentSession.id == session_id))
    if session_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    ensure_session_owner(session_obj, current_user)

    requested_type = str(payload.type or "").strip().lower()
    violation_type = requested_type if requested_type in ALLOWED_VIOLATION_TYPES else "unknown"

    now_utc = datetime.now(timezone.utc)
    try:
        client_time = payload.timestamp
    except Exception:
        client_time = None

    final_time = now_utc
    if isinstance(client_time, datetime):
        if client_time.tzinfo is None:
            client_time = client_time.replace(tzinfo=timezone.utc)
        try:
            drift_seconds = abs((now_utc - client_time.astimezone(timezone.utc)).total_seconds())
            if drift_seconds <= 300:
                final_time = client_time.astimezone(timezone.utc)
        except Exception:
            final_time = now_utc

    dedupe_since = now_utc - timedelta(seconds=2)
    existing = db.scalar(
        select(SessionViolation).where(
            SessionViolation.session_id == session_obj.id,
            SessionViolation.type == violation_type,
            SessionViolation.timestamp >= dedupe_since,
        )
    )
    if existing is not None:
        return {"status": "duplicate_skipped"}

    try:
        violation = SessionViolation(
            session_id=session_obj.id,
            user_id=current_user.id,
            type=violation_type,
            timestamp=final_time,
            metadata_=payload.metadata,
        )
        db.add(violation)
        db.commit()
        return {"status": "logged"}
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning(
            "Failed to log violation: session_id=%s user_id=%s type=%s error=%s",
            session_id,
            current_user.id,
            violation_type,
            exc,
        )
        return {"status": "failed"}
    except Exception as exc:
        db.rollback()
        logger.warning(
            "Unexpected violation logging failure: session_id=%s user_id=%s type=%s error=%s",
            session_id,
            current_user.id,
            violation_type,
            exc,
        )
        return {"status": "failed"}


@router.post("/sessions/{session_id}/submit", response_model=SessionSubmitResponse)
def submit_session(
    session_id: UUID,
    payload: SessionSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SessionSubmitResponse:
    logger.info(
        "submit_session request: session_id=%s code=%s language=%s",
        session_id,
        _truncate_text(payload.code),
        payload.language,
    )
    session_obj = db.scalar(select(AssessmentSession).where(AssessmentSession.id == session_id))
    if session_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    ensure_session_owner(session_obj, current_user)

    prior_submissions = int(
        db.scalar(select(func.count(Submission.id)).where(Submission.session_id == session_id)) or 0
    )
    logger.info(
        "submit_session attempt: session_id=%s prior_submissions=%s",
        session_id,
        prior_submissions,
    )

    current_time = datetime.now(timezone.utc)
    expires_at = session_obj.expires_at.astimezone(timezone.utc) if session_obj.expires_at.tzinfo else session_obj.expires_at.replace(tzinfo=timezone.utc)
    answer_items = payload.answers or []
    if expires_at <= current_time:
        code_to_submit = payload.code
        lang_to_submit = payload.language
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
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"status": "expired", "message": "Session has expired"},
        )

    try:
        if answer_items:
            if session_obj.submission is not None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session already submitted")

            skill = db.scalar(select(Skill).where(Skill.id == session_obj.skill_id))
            if skill is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

            session_problem_set = get_session_problem_set(db, session_obj)
            allowed_problem_ids = {problem.id for problem in session_problem_set}
            deduped_answers: list[tuple[Problem, str, str]] = []
            seen_problem_ids: set[UUID] = set()

            for answer in answer_items:
                if answer.problem_id in seen_problem_ids:
                    continue
                if answer.problem_id not in allowed_problem_ids:
                    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Answer contains an invalid problem")
                problem = resolve_problem_from_session(db, session_obj, answer.problem_id)
                deduped_answers.append((problem, answer.code, answer.language))
                seen_problem_ids.add(answer.problem_id)

            if len(deduped_answers) < MULTI_QUESTION_COUNT:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Please submit solutions for both questions",
                )

            executions = [
                execute_problem(
                    problem=problem,
                    skill=skill,
                    code=code,
                    language=language,
                    use_hidden_cases=True,
                )
                for problem, code, language in deduped_answers
            ]

            score = int(round(sum(item["score"] for item in executions) / len(executions)))
            passed_tests = int(sum(item["passed_tests"] for item in executions))
            total_tests = int(sum(item["total_tests"] for item in executions))
            merged_cases: list[Any] = []
            for execution in executions:
                merged_cases.extend(execution.get("cases", []))

            default_status = SubmissionStatus.CLEARED if score >= get_pass_threshold() else SubmissionStatus.FAILED
            submission_status = default_status
            started_at = session_obj.started_at.astimezone(timezone.utc) if session_obj.started_at.tzinfo else session_obj.started_at.replace(tzinfo=timezone.utc)
            time_taken_seconds = max(0, int((datetime.now(timezone.utc) - started_at).total_seconds()))

            primary_execution = executions[0]
            combined_code = json.dumps(
                [
                    {
                        "problem_id": str(problem.id),
                        "code": code,
                        "language": language,
                    }
                    for problem, code, language in deduped_answers
                ]
            )

            submission = Submission(
                session_id=session_obj.id,
                user_id=session_obj.user_id,
                problem_id=session_obj.problem_id,
                skill_id=session_obj.skill_id,
                level=session_obj.level,
                code=combined_code,
                language=primary_execution["resolved_monaco"],
                status=submission_status,
                score=score,
                passed_tests=passed_tests,
                total_tests=total_tests,
                time_taken_seconds=time_taken_seconds,
                judge_result={"cases": merged_cases},
            )
            db.add(submission)

            session_obj.status = SessionStatus.SUBMITTED
            session_obj.submitted_at = datetime.now(timezone.utc)

            if submission_status == SubmissionStatus.CLEARED:
                progress = db.scalar(
                    select(UserSkillProgress).where(
                        UserSkillProgress.user_id == session_obj.user_id,
                        UserSkillProgress.skill_id == session_obj.skill_id,
                        UserSkillProgress.level == session_obj.level,
                    )
                )
                current_time = datetime.now(timezone.utc)
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
        else:
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

    raw_cases = submission.judge_result.get("cases", []) if isinstance(submission.judge_result, dict) else []
    normalized_cases = [case for case in raw_cases if isinstance(case, dict)]
    overall_status = _compute_overall_status(normalized_cases)
    response_payload = SessionSubmitResponse(
        submission_id=submission.id,
        session_id=session_obj.id,
        status=submission.status,
        score=submission.score,
        passed_tests=submission.passed_tests,
        total_tests=submission.total_tests,
        time_taken_seconds=submission.time_taken_seconds,
        cases=raw_cases,
    )
    logger.info(
        "submit_session response: session_id=%s submission_id=%s status=%s overall_status=%s passed_tests=%s total_tests=%s submission_number=%s",
        session_id,
        response_payload.submission_id,
        response_payload.status,
        overall_status,
        response_payload.passed_tests,
        response_payload.total_tests,
        prior_submissions + 1,
    )
    return response_payload


@router.post("/sessions/{session_id}/run", response_model=SessionRunResponse)
def run_session_code(
    session_id: UUID,
    payload: SessionRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SessionRunResponse:
    logger.info(
        "run_session_code request: session_id=%s code=%s language=%s",
        session_id,
        _truncate_text(payload.code),
        payload.language,
    )
    session_obj = db.scalar(select(AssessmentSession).where(AssessmentSession.id == session_id))
    if session_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    ensure_session_owner(session_obj, current_user)

    current_time = datetime.now(timezone.utc)
    expires_at = (
        session_obj.expires_at.astimezone(timezone.utc)
        if session_obj.expires_at.tzinfo
        else session_obj.expires_at.replace(tzinfo=timezone.utc)
    )
    if expires_at <= current_time:
        session_obj.status = SessionStatus.TIMED_OUT
        db.commit()
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"status": "expired", "message": "Session has expired"},
        )

    problem = resolve_problem_from_session(db, session_obj, payload.problem_id)
    skill = db.scalar(select(Skill).where(Skill.id == session_obj.skill_id))
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    execution_result = execute_problem(
        problem=problem,
        skill=skill,
        code=payload.code,
        language=payload.language,
        use_hidden_cases=False,
    )

    raw_cases = execution_result.get("cases", [])
    normalized_cases = [case for case in raw_cases if isinstance(case, dict)]
    overall_status = _compute_overall_status(normalized_cases)

    response_payload = SessionRunResponse(
        cases=raw_cases,
        time_taken_ms=int(execution_result.get("time_taken", 0)),
    )
    logger.info(
        "run_session_code response: session_id=%s case_count=%s time_taken_ms=%s overall_status=%s",
        session_id,
        len(response_payload.cases),
        response_payload.time_taken_ms,
        overall_status,
    )
    return response_payload
