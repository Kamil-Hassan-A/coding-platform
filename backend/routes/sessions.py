import os
import random
import json
import re
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

# Compiled once at import time — used to sanity-check that the per-problem
# `__hidden_setup__` we are about to send to Judge0 references the same
# tables that the candidate just saw in the schema panel.
_CREATE_RE_LOG = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?[`\"\[]?([A-Za-z_][A-Za-z0-9_]*)",
    re.IGNORECASE,
)

_ORDER_BY_HINT_RE = re.compile(r"\border\s+by\b", re.IGNORECASE)

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_candidate
from judge0_service import Judge0Service, sql_stdout_matches
from sql_schema import (
    SQL_STARTER_COMMENT,
    get_visible_schema,
    looks_like_raw_setup,
    sanitize_starter_code_for_payload,
)
from models import (
    AssessmentSession,
    Badge,
    Level,
    Problem,
    SessionStatus,
    Skill,
    Submission,
    SubmissionStatus,
    User,
    UserBadge,
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
DEFAULT_QUESTION_COUNT = 2
AGILE_QUESTION_COUNT = 5
MCQ_OPTION_PATTERN = re.compile(r"\b([A-D])\b", re.IGNORECASE)
MCQ_ANSWER_PATTERN = re.compile(r"correct\s*answer\s*[:\-]\s*([A-D])\b", re.IGNORECASE)
MCQ_DESCRIPTION_OPTION_PATTERN = re.compile(r"(?mi)^\s*([A-D])\)\s+.+$")
MCQ_SAMPLE_INPUT_ANSWER_PATTERN = re.compile(r"answer\s*=\s*['\"]?([A-D])['\"]?", re.IGNORECASE)
LEVEL_BADGE_LABELS = {
    Level.BEGINNER: "Beginner",
    Level.INTERMEDIATE_1: "Intermediate 1",
    Level.INTERMEDIATE_2: "Intermediate 2",
    Level.SPECIALIST_1: "Specialist 1",
    Level.SPECIALIST_2: "Specialist 2",
}
COMBINED_WEB_SKILL_KEYS = {"htmlcssjs"}
WEB_SKILL_KEYS = {"htmlcssjs"}
WEB_MONACO_LANGUAGES = {"html_css_js", "html", "css", "javascript_web", "javascript"}


def normalize_skill_key(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").strip().lower())


def is_combined_html_css_js_skill(skill: Skill) -> bool:
    return normalize_skill_key(skill.name) in COMBINED_WEB_SKILL_KEYS


def dedupe_allowed_languages(languages: list[Any]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()

    for item in languages:
        if not isinstance(item, dict):
            continue

        lang_id = item.get("id")
        monaco = str(item.get("monaco") or "").strip().lower()
        name = str(item.get("name") or "").strip().lower()
        dedupe_key = f"{lang_id}:{monaco}:{name}"
        if dedupe_key in seen:
            continue

        deduped.append(item)
        seen.add(dedupe_key)

    return deduped


def get_skill_scope_ids(db: Session, skill: Skill) -> set[UUID]:
    if not is_combined_html_css_js_skill(skill):
        return {skill.id}

    all_skills = db.scalars(select(Skill)).all()
    scoped_ids = {
        candidate.id
        for candidate in all_skills
        if normalize_skill_key(candidate.name) in WEB_SKILL_KEYS
    }
    if not scoped_ids:
        scoped_ids = {skill.id}
    return scoped_ids


def merge_allowed_languages_for_skill(db: Session, skill: Skill) -> list[dict[str, Any]]:
    if not is_combined_html_css_js_skill(skill):
        return dedupe_allowed_languages(skill.allowed_languages or [])

    scoped_skill_ids = get_skill_scope_ids(db, skill)
    scoped_skills = db.scalars(select(Skill).where(Skill.id.in_(scoped_skill_ids))).all()

    merged: list[Any] = []
    for scoped_skill in scoped_skills:
        merged.extend(scoped_skill.allowed_languages or [])

    return dedupe_allowed_languages(merged)


def get_assessment_problem_pool(db: Session, skill: Skill, level: Level) -> tuple[list[Problem], set[UUID]]:
    if not is_combined_html_css_js_skill(skill):
        problems = db.scalars(select(Problem).where(Problem.skill_id == skill.id, Problem.level == level)).all()
        return problems, {skill.id}

    all_skills = db.scalars(select(Skill)).all()
    web_skill_ids = {
        candidate.id
        for candidate in all_skills
        if normalize_skill_key(candidate.name) in WEB_SKILL_KEYS
    }
    scoped_ids = set(web_skill_ids)
    if not scoped_ids:
        scoped_ids = {skill.id}
        web_skill_ids = {skill.id}

    problems = db.scalars(
        select(Problem).where(
            Problem.skill_id.in_(scoped_ids),
            Problem.level == level,
        )
    ).all()
    return problems, web_skill_ids


def choose_combined_html_css_js_problems(
    problems: list[Problem],
    level: Level,
    required_count: int,
    web_skill_ids: set[UUID],
) -> list[Problem]:
    if len(problems) < required_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"At least {required_count} questions are required to start this assessment level",
        )

    web_problems = [problem for problem in problems if problem.skill_id in web_skill_ids]
    if not web_problems:
        return choose_problems(problems, level, required_count)

    selected: list[Problem] = [random.choice(web_problems)]
    selected_ids = {problem.id for problem in selected}

    if required_count > len(selected):
        remaining = [problem for problem in problems if problem.id not in selected_ids]
        if len(remaining) < required_count - len(selected):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"At least {required_count} questions are required to start this assessment level",
            )
        selected.extend(random.sample(remaining, required_count - len(selected)))

    return selected[:required_count]


def is_web_sandbox_problem(problem: Problem) -> bool:
    starter_code = problem.starter_code if isinstance(problem.starter_code, dict) else {}
    starter_keys = {str(key).strip().lower() for key in starter_code.keys()}
    if {"html", "css"}.issubset(starter_keys):
        return True
    if "javascript" in starter_keys or "js" in starter_keys:
        return True

    normalized_tags = {
        normalize_skill_key(str(tag))
        for tag in (problem.tags or [])
        if str(tag).strip()
    }
    web_tags = {
        "html",
        "css",
        "javascript",
        "js",
        "frontend",
        "web",
        "htmlcssjs",
    }
    if normalized_tags.intersection(web_tags):
        return True

    return False


def parse_web_bundle(raw: object) -> dict[str, str]:
    def _coerce_from_dict(value: dict[str, Any]) -> dict[str, str]:
        return {
            "html": str(value.get("html") or ""),
            "css": str(value.get("css") or ""),
            "js": str(value.get("js") or value.get("javascript") or ""),
        }

    if isinstance(raw, dict):
        return _coerce_from_dict(raw)

    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return {"html": "", "css": "", "js": ""}

        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return _coerce_from_dict(parsed)
        except (TypeError, ValueError):
            pass

        # If plain text was sent, treat it as JS-only content.
        return {"html": "", "css": "", "js": text}

    return {"html": "", "css": "", "js": ""}


def solution_web_bundle(problem: Problem) -> dict[str, str]:
    candidates: list[object] = []

    if problem.solution_text:
        candidates.append(problem.solution_text)

    if isinstance(problem.starter_code, dict):
        default_value = problem.starter_code.get("default")
        if default_value is not None:
            candidates.append(default_value)
        candidates.append(problem.starter_code)

    for candidate in candidates:
        bundle = parse_web_bundle(candidate)
        if any(value.strip() for value in bundle.values()):
            return bundle

    return {"html": "", "css": "", "js": ""}


def _tokenize_segment(value: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9_#.-]+", (value or "").lower())
    return {token for token in tokens if token}


def _segment_similarity(reference: str, candidate: str) -> float:
    ref_tokens = _tokenize_segment(reference)
    cand_tokens = _tokenize_segment(candidate)

    if not ref_tokens and not cand_tokens:
        return 1.0
    if not ref_tokens:
        return 1.0
    if not cand_tokens:
        return 0.0

    union = ref_tokens.union(cand_tokens)
    if not union:
        return 0.0

    return len(ref_tokens.intersection(cand_tokens)) / len(union)


def _build_web_case(stdin: str, expected_output: str, stdout: str, passed: bool) -> dict[str, Any]:
    return {
        "stdin": stdin,
        "expected_output": expected_output,
        "stdout": stdout,
        "stderr": None,
        "compile_output": None,
        "message": None,
        "status": {"id": 3, "description": "Accepted"} if passed else {"id": 4, "description": "Wrong Answer"},
        "time": "0",
        "memory": None,
        "passed": passed,
    }


def evaluate_web_submission(problem: Problem, code: str) -> dict[str, Any]:
    candidate = parse_web_bundle(code)
    reference = solution_web_bundle(problem)

    cases: list[dict[str, Any]] = []

    for segment in ("html", "css", "js"):
        value = candidate.get(segment, "")
        passed = bool(value.strip())
        cases.append(
            _build_web_case(
                stdin=f"segment:{segment}",
                expected_output="non-empty code",
                stdout="non-empty" if passed else "empty",
                passed=passed,
            )
        )

    reference_segments = [segment for segment in ("html", "css", "js") if reference.get(segment, "").strip()]
    if reference_segments:
        similarities = [_segment_similarity(reference[segment], candidate.get(segment, "")) for segment in reference_segments]
        average_similarity = sum(similarities) / len(similarities)
        # Keep threshold lenient so alternate implementations can still pass.
        reference_passed = average_similarity >= 0.12
        cases.append(
            _build_web_case(
                stdin="solution_match",
                expected_output="candidate should align with reference solution",
                stdout=f"similarity={average_similarity:.2f}",
                passed=reference_passed,
            )
        )

    passed_tests = sum(1 for case in cases if case.get("passed"))
    total_tests = len(cases)
    score = int(round((passed_tests / total_tests) * 100)) if total_tests else 0

    return {
        "resolved_monaco": "html_css_js",
        "score": score,
        "passed_tests": passed_tests,
        "total_tests": total_tests,
        "time_taken": 0,
        "cases": cases,
    }


def preferred_difficulty_pair(level: Level) -> tuple[str, str]:
    if level == Level.BEGINNER:
        return ("easy", "hard")
    if level in (Level.INTERMEDIATE_1, Level.INTERMEDIATE_2):
        return ("medium", "hard")
    return ("medium", "hard")


def get_required_question_count(skill: Skill) -> int:
    if skill.name.strip().lower() == "agile":
        return AGILE_QUESTION_COUNT
    return DEFAULT_QUESTION_COUNT


def choose_problems(problems: list[Problem], level: Level, required_count: int) -> list[Problem]:
    if len(problems) < required_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"At least {required_count} questions are required to start this assessment level",
        )

    grouped: dict[str, list[Problem]] = {}
    for problem in problems:
        difficulty = (problem.difficulty_label or "").strip().lower() or "unknown"
        grouped.setdefault(difficulty, []).append(problem)

    preferred_first, preferred_second = preferred_difficulty_pair(level)

    ordered_labels: list[str] = []
    for label in [preferred_first, preferred_second, "easy", "medium", "hard", *sorted(grouped.keys())]:
        if label in grouped and label not in ordered_labels:
            ordered_labels.append(label)

    selected: list[Problem] = []
    selected_ids: set[UUID] = set()

    while len(selected) < required_count:
        made_progress = False
        for label in ordered_labels:
            candidates = [problem for problem in grouped[label] if problem.id not in selected_ids]
            if not candidates:
                continue
            picked = random.choice(candidates)
            selected.append(picked)
            selected_ids.add(picked.id)
            made_progress = True
            if len(selected) >= required_count:
                break

        if not made_progress:
            break

    if len(selected) < required_count:
        remaining = [problem for problem in problems if problem.id not in selected_ids]
        if len(remaining) >= (required_count - len(selected)):
            selected.extend(random.sample(remaining, required_count - len(selected)))

    if len(selected) < required_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"At least {required_count} questions are required to start this assessment level",
        )

    return selected[:required_count]


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

    return ordered_ids


def build_problem_payload(problem: Problem) -> SessionProblemPayload:
    """Build a candidate-facing payload that:
    - never leaks `__hidden_setup__` / `default` raw CREATE+INSERT SQL,
    - exposes a clean `schema` list for SQL problems,
    - ALWAYS forces a clean HackerRank-style starter comment for SQL — we
      never echo the dataset's own SQL (some dataset entries historically
      pre-filled the answer in `starter_code.sql`).
    """
    raw_starter = problem.starter_code if isinstance(problem.starter_code, dict) else None
    schema_tables = get_visible_schema(
        raw_starter,
        problem.sample_test_cases or [],
        problem.hidden_test_cases or [],
    )
    is_sql_problem = str(problem.question_type or "").strip().lower() == "sql"
    is_framework_problem = str(problem.question_type or "").strip().lower() == "framework"
    if not is_sql_problem:
        schema_tables = []

    sanitized_starter = sanitize_starter_code_for_payload(raw_starter)
    if is_sql_problem and isinstance(sanitized_starter, dict):
        # Hard-reset SQL editor content to the clean comment — never let the
        # dataset's `starter_code.sql` (which may be a full reference query)
        # reach the candidate's editor.
        sanitized_starter["sql"] = SQL_STARTER_COMMENT
        # Drop any other language keys an SQL problem shouldn't carry.
        for stale_key in [k for k in list(sanitized_starter.keys()) if k != "sql"]:
            del sanitized_starter[stale_key]

    if is_sql_problem:
        template_code = SQL_STARTER_COMMENT
    elif is_framework_problem:
        template_code = None
        if isinstance(problem.starter_files, list) and len(problem.starter_files) > 0:
            first_file = problem.starter_files[0]
            if isinstance(first_file, dict):
                val = first_file.get("content")
                if isinstance(val, str):
                    template_code = val
    else:
        template_code = resolve_multifile_template_code(sanitized_starter) or resolve_template_code(
            sanitized_starter or problem.starter_code
        )

    # For SQL problems we INTENTIONALLY drop sample_test_cases entirely: the
    # legacy dataset entries here are descriptive prose / placeholder rows
    # that do NOT match the real `__hidden_setup__` Judge0 actually executes.
    # Showing them caused candidate confusion (mismatched CREATE TABLEs,
    # wrong "expected output", etc.). The schema panel + the candidate's own
    # `Run Code` output is the source of truth instead.
    #
    # For non-SQL problems we still strip any case whose `input` looks like
    # raw CREATE/INSERT SQL — those would also leak hidden setup.
    if is_sql_problem:
        sanitized_samples: list = []
    else:
        sanitized_samples = []
        for case in problem.sample_test_cases or []:
            if isinstance(case, dict) and looks_like_raw_setup(case.get("input")):
                continue
            sanitized_samples.append(case)

    return SessionProblemPayload(
        problem_id=problem.id,
        title=problem.title,
        description=problem.description,
        templateCode=template_code,
        starter_code=sanitized_starter,
        tags=[str(tag) for tag in (problem.tags or [])],
        sample_test_cases=sanitized_samples,
        time_limit_minutes=problem.time_limit_minutes,
        schema_tables=schema_tables,
        question_type=problem.question_type,
        options=problem.options,
        starter_files=problem.starter_files,
        entry_point=problem.entry_point,
        test_harness=problem.test_harness,
        database_schema=problem.database_schema,
    )

def resolve_multifile_template_code(starter_code: Any) -> str | None:
    if not isinstance(starter_code, dict):
        return None

    files = starter_code.get("files")
    if not isinstance(files, list):
        return None

    readonly = starter_code.get("readonly_files")
    readonly_set = {str(p) for p in readonly} if isinstance(readonly, list) else set()

    def read_file_content(target_path: str) -> str | None:
        for entry in files:
            if not isinstance(entry, dict):
                continue
            if str(entry.get("path") or "").strip() == target_path:
                content = entry.get("content")
                return content if isinstance(content, str) else None
        return None

    # Prefer solution.py when present, then any non-readonly file, then first file.
    preferred = read_file_content("solution.py")
    if preferred:
        return preferred

    for entry in files:
        if not isinstance(entry, dict):
            continue
        path = str(entry.get("path") or "").strip()
        if not path or path in readonly_set:
            continue
        content = entry.get("content")
        if isinstance(content, str):
            return content

    for entry in files:
        if not isinstance(entry, dict):
            continue
        content = entry.get("content")
        if isinstance(content, str):
            return content

    return None


def get_session_problem_set(db: Session, session_obj: AssessmentSession) -> list[Problem]:
    parent_skill = db.scalar(select(Skill).where(Skill.id == session_obj.skill_id))
    allowed_skill_ids = {session_obj.skill_id}
    if parent_skill is not None:
        allowed_skill_ids = get_skill_scope_ids(db, parent_skill)

    ordered_ids = parse_question_ids(session_obj.last_draft_code, session_obj.problem_id)
    resolved: list[Problem] = []

    for problem_id in ordered_ids:
        problem = db.scalar(select(Problem).where(Problem.id == problem_id))
        if problem is None:
            continue
        if problem.skill_id not in allowed_skill_ids or problem.level != session_obj.level:
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


def is_mcq_problem(problem: Problem, skill: Skill | None = None) -> bool:
    tags = [str(tag).strip().lower() for tag in (problem.tags or []) if str(tag).strip()]
    if "mcq" in tags:
        return True
    if skill is not None and skill.name.strip().lower() == "agile":
        return True
    return False


def extract_mcq_correct_option(problem: Problem) -> str | None:
    for source_text in (problem.solution_text or "", problem.description or ""):
        match = MCQ_ANSWER_PATTERN.search(source_text)
        if match:
            return match.group(1).upper()

    sample_cases = problem.sample_test_cases or []
    if isinstance(sample_cases, list):
        for case in sample_cases:
            if not isinstance(case, dict):
                continue
            raw_input = str(case.get("input", ""))
            match = MCQ_SAMPLE_INPUT_ANSWER_PATTERN.search(raw_input)
            if match:
                return match.group(1).upper()

    return None


def has_complete_mcq_options(problem: Problem) -> bool:
    description = problem.description or ""
    found = {match.group(1).upper() for match in MCQ_DESCRIPTION_OPTION_PATTERN.finditer(description)}
    return {"A", "B", "C", "D"}.issubset(found)


def is_pure_mcq_problem(problem: Problem, skill: Skill | None = None) -> bool:
    if not is_mcq_problem(problem, skill):
        return False
    if not has_complete_mcq_options(problem):
        return False
    if not extract_mcq_correct_option(problem):
        return False
    return True


def extract_mcq_selected_option(raw_answer: str) -> str | None:
    if not isinstance(raw_answer, str):
        return None
    cleaned = raw_answer.strip()
    if not cleaned:
        return None
    match = MCQ_OPTION_PATTERN.search(cleaned)
    if not match:
        return None
    return match.group(1).upper()


def evaluate_mcq_submission(problem: Problem, selected_option: str | None) -> dict[str, Any]:
    correct_option = extract_mcq_correct_option(problem)
    passed = bool(selected_option and correct_option and selected_option == correct_option)

    status_payload = {"id": 3, "description": "Accepted"} if passed else {"id": 4, "description": "Wrong Answer"}
    case = {
        "stdin": selected_option or "",
        "expected_output": correct_option or "",
        "stdout": selected_option or "",
        "stderr": None,
        "compile_output": None,
        "message": None,
        "status": status_payload,
        "time": "0",
        "memory": None,
        "passed": passed,
    }

    return {
        "resolved_monaco": "mcq",
        "score": 100 if passed else 0,
        "passed_tests": 1 if passed else 0,
        "total_tests": 1,
        "time_taken": 0,
        "cases": [case],
    }


def execute_problem(
    problem: Problem,
    skill: Skill,
    code: str,
    language: str,
    *,
    use_hidden_cases: bool,
) -> dict[str, Any]:
    if problem.question_type == "mcq":
        # MCQ evaluates against correct_option_index
        selected_index_str = (code or "").strip()
        passed = False
        try:
            if selected_index_str and problem.correct_option_index is not None:
                passed = int(selected_index_str) == problem.correct_option_index
        except ValueError:
            pass

        score = 100 if passed else 0
        case = {
            "stdin": selected_index_str,
            "expected_output": str(problem.correct_option_index) if problem.correct_option_index is not None else "",
            "stdout": selected_index_str,
            "stderr": None,
            "compile_output": None,
            "status": {
                "id": 3 if passed else 4,
                "description": "Accepted" if passed else "Wrong Answer",
            },
            "passed": passed,
            "time": "0",
            "memory": "0",
        }
        return {
            "resolved_monaco": (language or "mcq").strip().lower() or "mcq",
            "passed": passed,
            "passed_tests": 1 if passed else 0,
            "total_tests": 1,
            "score": score,
            "time_taken": 0,
            "cases": [case],
        }

    resolved_monaco, resolved_language_id = resolve_language_from_skill(language, skill.allowed_languages or [])

    test_inputs = problem.hidden_test_cases if use_hidden_cases else problem.sample_test_cases

    starter_dict = problem.starter_code if isinstance(problem.starter_code, dict) else {}

    is_sql = str(problem.question_type or "").strip().lower() == "sql"
    is_framework = str(problem.question_type or "").strip().lower() == "framework"
    setup_snapshot = ""

    if is_framework:
        request_id = uuid4().hex[:8]
        print("=== EXECUTE_PROBLEM (FRAMEWORK) ===")
        print("REQUEST ID:", request_id)
        print("PROBLEM ID:", problem.id, "TITLE:", problem.title)
        print("LANGUAGE:", language, "RESOLVED_MONACO:", resolved_monaco)

        files = build_framework_payload_files(problem, code)
        entry = str(problem.entry_point or "test_main.py").strip()
        execution_result = judge0_service.execute_multifile(
            files=files,
            entry_point=entry if entry else "test_main.py",
            problem_id=str(problem.id),
            request_id=request_id,
        )

        cases: list[Any] = list(execution_result.get("cases") or [])
        return {
            "resolved_monaco": resolved_monaco,
            "score": int(execution_result.get("score", 0)),
            "passed_tests": int(execution_result.get("passed_tests", 0)),
            "total_tests": int(execution_result.get("total_tests", 0)),
            "time_taken": int(execution_result.get("time_taken", 0)),
            "cases": cases,
            "is_sql_execution": False,
        }

    if is_sql:
        # STRICT: setup comes ONLY from this problem's own `__hidden_setup__`.
        raw_setup = starter_dict.get("__hidden_setup__") or ""
        if not isinstance(raw_setup, str):
            raw_setup = ""
        # Immutable snapshot: same string object passed to user run and reference run (str is immutable).
        setup_snapshot = raw_setup.rstrip()

    request_id = uuid4().hex[:8]
    print("=== EXECUTE_PROBLEM ===")
    print("REQUEST ID:", request_id)
    print("PROBLEM ID:", problem.id, "TITLE:", problem.title)
    print("CODE LENGTH:", len(code or ""), "CODE PREVIEW:", _truncate_text(code, 400))
    print("LANGUAGE:", language, "RESOLVED_MONACO:", resolved_monaco, "LANG_ID:", resolved_language_id)
    print("USE_HIDDEN_CASES:", use_hidden_cases, "TEST CASES:", len(test_inputs or []))
    if is_sql:
        # Cross-check: the schema panel the candidate just saw vs the setup
        # we are about to execute. If they reference different tables we have
        # a real cross-leak and should bail out rather than silently run.
        schema_tables = starter_dict.get("__schema__") or []
        schema_names = sorted(
            {(t.get("table") or "").upper() for t in schema_tables if isinstance(t, dict) and t.get("table")}
        )
        setup_table_names = sorted(
            {m.group(1).upper() for m in _CREATE_RE_LOG.finditer(setup_snapshot or "")}
        )
        print("SQL SCHEMA TABLES :", schema_names)
        print("SQL SETUP  TABLES :", setup_table_names)
        print("SQL SETUP LENGTH  :", len(setup_snapshot), "PREVIEW:", _truncate_text(setup_snapshot, 300))
        if schema_names and setup_table_names and not (set(schema_names) & set(setup_table_names)):
            print(
                f"!!! CROSS-LEAK suspected for problem {problem.id} ({problem.title!r}) — "
                f"schema={schema_names} but setup={setup_table_names}. "
                f"Refusing to run; check fix_missing_sql_setup.py + clean_invalid_sql_tables.py."
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    f"SQL problem {problem.title!r} has inconsistent schema/setup. "
                    f"Schema lists {schema_names}, setup creates {setup_table_names}. "
                    f"Run scripts/clean_invalid_sql_tables.py --apply to repair."
                ),
            )
        if not setup_snapshot.strip():
            print(
                f"!!! SQL problem {problem.id} ({problem.title!r}) has NO __hidden_setup__ — "
                f"candidate query will run against an empty SQLite session."
            )
    print("=======================")

    try:
        if resolved_monaco in WEB_MONACO_LANGUAGES and is_web_sandbox_problem(problem):
            execution_result = evaluate_web_submission(problem, code)
        else:
            execution_result = judge0_service.execute(
                code=code,
                language_id=resolved_language_id,
                test_inputs=test_inputs or [],
                setup_sql=setup_snapshot if is_sql and setup_snapshot else None,
                problem_id=str(problem.id),
                request_id=request_id,
            )
    except ValueError as exc:
        print("=== EXECUTE_PROBLEM VALIDATION ERROR ===", str(exc))
        logger.exception("execute_problem validation error: %s", exc)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except (requests.RequestException, TimeoutError, RuntimeError) as exc:
        print("=== EXECUTE_PROBLEM JUDGE0 ERROR ===", str(exc))
        logger.exception("execute_problem judge0 error: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Judge0 execution failed: {str(exc)}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        print("=== EXECUTE_PROBLEM UNEXPECTED ERROR ===", repr(exc))
        logger.exception("execute_problem unexpected error: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Execution failed: {str(exc)}") from exc

    cases: list[Any] = list(execution_result.get("cases") or [])

    sql_stdout_val: str | None = None
    sql_expected_val: str | None = None

    if is_sql:
        sql_stdout_val = None
        if cases and isinstance(cases[0], dict):
            ou = cases[0].get("stdout")
            sql_stdout_val = None if ou is None else str(ou)

        # Reference SQL lives in Problem.solution_text (same convention as scraped `solution`).
        expected_solution_sql = (problem.solution_text or "").strip()
        ref_solution_has_order_by = (
            bool(_ORDER_BY_HINT_RE.search(expected_solution_sql))
            if expected_solution_sql
            else False
        )
        if expected_solution_sql and not ref_solution_has_order_by:
            logger.warning(
                "SQL dataset quality: problem %s (%r) solution_text has no ORDER BY — row order may be non-deterministic",
                problem.id,
                problem.title,
            )

        ref_stdout: str | None = None
        if (
            expected_solution_sql
            and setup_snapshot.strip()
            and resolved_language_id
        ):
            logger.info(
                "Running reference for problem_id=%s, title=%s",
                problem.id,
                problem.title,
            )
            try:
                ref_raw = judge0_service.run_sql_reference(
                    reference_query=expected_solution_sql,
                    language_id=resolved_language_id,
                    setup_sql=setup_snapshot,
                    problem_id=str(problem.id),
                    request_id=f"{request_id}-ref",
                )
                if (ref_raw.get("status") or {}).get("id") == 3:
                    rv = ref_raw.get("stdout")
                    ref_stdout = None if rv is None else str(rv)
                else:
                    print(
                        "SQL REFERENCE RUN non-Accepted:",
                        problem.id,
                        ref_raw.get("status"),
                        _truncate_text(ref_raw.get("stderr"), 400),
                    )
            except (ValueError, requests.RequestException, TimeoutError, RuntimeError) as ref_exc:
                print("SQL REFERENCE RUN failed:", ref_exc)

        sql_expected_val = ref_stdout

        if ref_stdout is not None and len(cases) == 1 and isinstance(cases[0], dict):
            cases[0]["expected_output"] = ref_stdout
            user_ok = (cases[0].get("status") or {}).get("id") == 3
            cases[0]["passed"] = user_ok and sql_stdout_matches(
                sql_stdout_val,
                ref_stdout,
                reference_has_order_by=ref_solution_has_order_by,
            )
            ok = bool(cases[0]["passed"])
            execution_result["score"] = 100 if ok else 0
            execution_result["passed_tests"] = 1 if ok else 0
            execution_result["total_tests"] = 1

    out: dict[str, Any] = {
        "resolved_monaco": resolved_monaco,
        "score": int(execution_result.get("score", 0)),
        "passed_tests": int(execution_result.get("passed_tests", 0)),
        "total_tests": int(execution_result.get("total_tests", 0)),
        "time_taken": int(execution_result.get("time_taken", 0)),
        "cases": execution_result.get("cases", []),
    }
    if is_sql:
        out["stdout"] = sql_stdout_val
        out["expected_output"] = sql_expected_val
    return out


def build_framework_payload_files(
    problem: Problem,
    updated_solution: str,
) -> list[dict[str, Any]]:
    payload_files: list[dict[str, Any]] = []

    files = problem.starter_files if isinstance(problem.starter_files, list) else []
    for i, entry in enumerate(files):
        if not isinstance(entry, dict):
            continue
        path = str(entry.get("path") or "").strip()
        content = entry.get("content")
        if not path:
            continue

        # We assume the user submitted code completely replaces the first file's content
        if i == 0:
            payload_files.append({"path": path, "content": updated_solution})
            continue

        if isinstance(content, str):
            payload_files.append({"path": path, "content": content})

    # Always inject the test harness natively
    harness = str(problem.test_harness or "").strip()
    entry_point = str(problem.entry_point or "test_main.py").strip() or "test_main.py"
    if harness:
        payload_files.append({
            "path": entry_point,
            "content": harness
        })

    return payload_files


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
        for key in ("python", "default", "javascript", "java", "csharp", "c#", "cs", "dotnet", ".net", "vb", "vb.net", "visual basic"):
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


def award_level_badge(
    db: Session,
    *,
    user_id: UUID,
    skill: Skill,
    level: Level,
    awarded_at: datetime,
) -> None:
    level_label = LEVEL_BADGE_LABELS.get(level, level.value.replace("_", " ").title())
    badge_name = f"{skill.name} - {level_label} Cleared"
    description = f"Awarded for clearing {level_label} level in {skill.name}."
    criteria = json.dumps(
        {
            "event": "level_cleared",
            "skill_id": str(skill.id),
            "skill_name": skill.name,
            "level": level.value,
        }
    )

    badge = db.scalar(select(Badge).where(Badge.name == badge_name))
    if badge is None:
        badge = Badge(
            name=badge_name,
            description=description,
            criteria=criteria,
        )
        db.add(badge)
        db.flush()

    existing_award = db.scalar(
        select(UserBadge).where(
            UserBadge.user_id == user_id,
            UserBadge.badge_id == badge.id,
        )
    )
    if existing_award is None:
        db.add(
            UserBadge(
                user_id=user_id,
                badge_id=badge.id,
                awarded_at=awarded_at,
            )
        )


def ensure_session_owner(session_obj: AssessmentSession, current_user: User) -> None:
    if session_obj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session does not belong to current user")


def canonical_monaco_language(language: str) -> str:
    raw = (language or "").strip().lower()
    collapsed = re.sub(r"[\s\-_.(),]+", "", raw)

    if raw in {"c#", "csharp", "cs", "dotnet", ".net", ".net, c#", ".net,c#"} or collapsed in {
        "c#",
        "csharp",
        "cs",
        "dotnet",
        "net",
        "netc#",
        "netcsharp",
    }:
        return "csharp"

    if raw in {"vb", "vb.net", "vbnet", "visual basic", "visual basic.net", "visual basic .net"} or collapsed in {
        "vb",
        "vbnet",
        "visualbasic",
        "visualbasicnet",
    }:
        return "vb"

    return raw


def expand_language_aliases(value: object) -> set[str]:
    if value is None:
        return set()
    raw = str(value).strip().lower()
    if not raw:
        return set()

    collapsed = re.sub(r"[\s\-_.(),]+", "", raw)
    canonical = canonical_monaco_language(raw)
    aliases = {raw, collapsed, canonical}

    if canonical == "csharp":
        aliases.update({"c#", "cs", "dotnet", ".net", "net", "netc#", "netcsharp"})
    elif canonical == "vb":
        aliases.update({"vb", "vb.net", "vbnet", "visual basic", "visualbasic", "visualbasicnet"})

    return {item for item in aliases if item}


def resolve_language_from_skill(language: str, allowed_languages: list[Any]) -> tuple[str, int]:
    requested = (language or "").strip().lower()
    if not requested:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Language is required")

    requested_aliases = expand_language_aliases(requested)

    for item in allowed_languages or []:
        if not isinstance(item, dict):
            continue
        lang_id = item.get("id")
        monaco = str(item.get("monaco") or "").strip().lower()
        name = str(item.get("name") or "").strip().lower()
        if lang_id is None:
            continue

        item_aliases = expand_language_aliases(monaco)
        item_aliases.update(expand_language_aliases(name))
        item_aliases.add(str(lang_id).strip().lower())

        if requested_aliases.intersection(item_aliases):
            try:
                return (canonical_monaco_language(monaco or requested), int(lang_id))
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

    score = execution_result["score"]
    passed_tests = execution_result["passed_tests"]
    total_tests = execution_result["total_tests"]

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

        award_level_badge(
            db,
            user_id=session_obj.user_id,
            skill=skill,
            level=session_obj.level,
            awarded_at=current_time,
        )

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

    problems, web_skill_ids = get_assessment_problem_pool(db, skill, payload.level)
    if not problems:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    if skill.name.strip().lower() == "agile":
        problems = [problem for problem in problems if is_pure_mcq_problem(problem, skill)]

    required_count = get_required_question_count(skill)
    if is_combined_html_css_js_skill(skill):
        selected_problems = choose_combined_html_css_js_problems(
            problems,
            payload.level,
            required_count,
            web_skill_ids,
        )
    else:
        selected_problems = choose_problems(problems, payload.level, required_count)
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
        allowed_languages=merge_allowed_languages_for_skill(db, skill),
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
        allowed_languages=merge_allowed_languages_for_skill(db, skill),
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
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expired; draft auto-submitted")

    try:
        if answer_items:
            if session_obj.submissions:
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

            required_count = len(session_problem_set)
            if len(deduped_answers) < required_count:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Please submit solutions for all {required_count} questions",
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


@router.post("/sessions/{session_id}/run", response_model=SessionRunResponse, response_model_exclude_unset=True)
def run_session_code(
    session_id: UUID,
    payload: SessionRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
) -> SessionRunResponse:
    session_obj = db.scalar(select(AssessmentSession).where(AssessmentSession.id == session_id))
    if session_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    ensure_session_owner(session_obj, current_user)

    if session_obj.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not active")

    current_time = datetime.now(timezone.utc)
    expires_at = (
        session_obj.expires_at.astimezone(timezone.utc)
        if session_obj.expires_at.tzinfo
        else session_obj.expires_at.replace(tzinfo=timezone.utc)
    )
    if expires_at <= current_time:
        session_obj.status = SessionStatus.TIMED_OUT
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expired")

    problem = load_problem_for_session_run(db, session_obj, payload.problem_id)
    skill = db.scalar(select(Skill).where(Skill.id == session_obj.skill_id))
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    try:
        execution_result = execute_problem(
            problem=problem,
            skill=skill,
            code=payload.code,
            language=payload.language,
            use_hidden_cases=False,
        )
    except HTTPException:
        raise
    except Exception as exc:
        print("=== RUN UNEXPECTED ERROR ===", repr(exc))
        logger.exception("run_session_code unexpected error: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Run failed: {str(exc)}") from exc

    return SessionRunResponse(
        cases=execution_result.get("cases", []),
        time_taken_ms=int(execution_result.get("time_taken", 0)),
    )
