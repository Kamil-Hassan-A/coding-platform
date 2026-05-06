import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Allow running as: python scripts/seed_new.py from backend/
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import get_session_local
from models import Base, Level, Problem, Skill, User, UserRole, UserSkillProgress
from security import hash_password


LEVEL_ORDER = [
    Level.BEGINNER,
    Level.INTERMEDIATE_1,
    Level.INTERMEDIATE_2,
    Level.SPECIALIST_1,
    Level.SPECIALIST_2,
]

CANONICAL_LEVEL_KEYS = {
    "Beginner": Level.BEGINNER,
    "Intermediate_1": Level.INTERMEDIATE_1,
    "Intermediate_2": Level.INTERMEDIATE_2,
    "Specialist_1": Level.SPECIALIST_1,
    "Specialist_2": Level.SPECIALIST_2,
}

CANONICAL_DIFFICULTIES = ["Easy", "Medium", "Hard"]

LANGUAGE_ALIASES = {
    "js": "javascript",
    "node": "javascript",
    "nodejs": "javascript",
    "ts": "typescript",
    "py": "python",
    "c#": "csharp",
    "cs": "csharp",
    "c++": "cpp",
    "postgres": "sql",
    "postgresql": "sql",
}

# Seed directly from the sample scrape payload kept beside this script.
DEFAULT_JSON_FILE = CURRENT_FILE.parent / "problem_dataset.json"


def to_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_language_key(language: str) -> str:
    key = to_str(language).lower()
    if key in LANGUAGE_ALIASES:
        return LANGUAGE_ALIASES[key]
    return key


def normalize_test_cases(raw_cases: Any) -> list[dict[str, str]]:
    if not isinstance(raw_cases, list):
        return []

    cases: list[dict[str, str]] = []
    for case in raw_cases:
        if not isinstance(case, dict):
            continue
        if "input" not in case or "output" not in case:
            continue
        input_value = to_str(case.get("input", ""))
        output_value = to_str(case.get("output", ""))
        cases.append({"input": input_value, "output": output_value})
    return cases


def normalize_tags(raw_tags: Any, skill_name: str, level_key: str, difficulty: str) -> list[str]:
    tags: list[str] = []
    if isinstance(raw_tags, list):
        tags.extend([to_str(item) for item in raw_tags])
    elif isinstance(raw_tags, str):
        tags.extend([part.strip() for part in raw_tags.split(",")])

    tags.extend([skill_name, level_key, difficulty])

    deduped: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if not tag:
            continue
        lowered = tag.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped.append(tag)
    return deduped


def normalize_starter_code(raw_starter_code: Any, language: str) -> dict[str, Any]:
    if isinstance(raw_starter_code, dict):
        return raw_starter_code
    if isinstance(raw_starter_code, str) and raw_starter_code.strip():
        return {"default": raw_starter_code}

    key = normalize_language_key(language)
    if key:
        return {key: "", "default": ""}
    return {"default": ""}


def stable_external_task_id(
    dataset_name: str,
    skill_name: str,
    level_key: str,
    difficulty: str,
    problem_id: str,
    slug: str,
    title: str,
) -> str:
    if problem_id:
        return f"scrape:{problem_id}"
    if slug:
        return f"scrape:{slug}"

    payload = f"{dataset_name}|{skill_name}|{level_key}|{difficulty}|{title}".encode("utf-8")
    digest = hashlib.sha1(payload).hexdigest()[:28]
    return f"scrape:{digest}"


def resolve_allowed_languages(skill_obj: dict[str, Any]) -> list[dict[str, Any]]:
    return skill_obj.get("allowed_languages", [])


def validate_payload(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    skills = payload.get("skills")
    if not isinstance(skills, list):
        return ["Top-level 'skills' must be an array."]

    for skill_index, skill_obj in enumerate(skills, start=1):
        if not isinstance(skill_obj, dict):
            errors.append(f"Skill #{skill_index} must be an object.")
            continue

        skill_name = to_str(skill_obj.get("skill")) or f"#{skill_index}"
        levels = skill_obj.get("levels")
        if not isinstance(levels, dict):
            errors.append(f"Skill '{skill_name}' must include a 'levels' object.")
            continue

        for level_key, level_payload in levels.items():
            if not isinstance(level_payload, dict):
                errors.append(f"Skill '{skill_name}' level '{level_key}' must be an object.")
                continue

            for difficulty in CANONICAL_DIFFICULTIES:
                if difficulty not in level_payload:
                    continue
                if not isinstance(level_payload[difficulty], list):
                    errors.append(
                        f"Skill '{skill_name}' level '{level_key}' bucket '{difficulty}' must be an array."
                    )

    return errors


def create_user(
    db,
    email: str,
    password: str,
    role: UserRole,
    name: str,
    employee_id: str,
    gender: str,
    department: str,
    exp_indium_years: int,
    exp_overall_years: int,
) -> User:
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
        name=name,
        employee_id=employee_id,
        gender=gender,
        department=department,
        exp_indium_years=exp_indium_years,
        exp_overall_years=exp_overall_years,
    )
    db.add(user)
    db.flush()
    return user


def create_skills_from_payload(db, skills_payload: list[dict[str, Any]]) -> list[Skill]:
    skills: list[Skill] = []
    for skill_obj in skills_payload:
        skill_name = to_str(skill_obj.get("skill"))
        if not skill_name:
            continue

        skill = Skill(
            name=skill_name,
            description=to_str(skill_obj.get("description")) or "Imported from scrape JSON",
            icon_url=to_str(skill_obj.get("icon_url")) or None,
            allowed_languages=resolve_allowed_languages(skill_obj),
        )
        db.add(skill)
        skills.append(skill)

    db.flush()
    return skills


def create_progress_for_candidate(db, user: User, skills: list[Skill]) -> int:
    inserted = 0
    for skill in skills:
        for level in LEVEL_ORDER:
            progress = UserSkillProgress(
                user_id=user.id,
                skill_id=skill.id,
                level=level,
                unlocked=(level == Level.BEGINNER),
                cleared=False,
                cleared_at=None,
            )
            db.add(progress)
            inserted += 1
    return inserted


def seed_problems_from_payload(
    db,
    dataset_name: str,
    skills_by_name: dict[str, Skill],
    skills_payload: list[dict[str, Any]],
) -> dict[str, int]:
    counts = {
        "problems_created": 0,
        "problems_skipped_invalid": 0,
        "problems_skipped_unknown_skill": 0,
        "problems_skipped_unknown_level": 0,
    }

    seen_external_ids: set[str] = set()

    for skill_obj in skills_payload:
        skill_name = to_str(skill_obj.get("skill"))
        if not skill_name:
            continue

        skill = skills_by_name.get(skill_name)
        if skill is None:
            counts["problems_skipped_unknown_skill"] += 1
            continue

        levels = skill_obj.get("levels")
        if not isinstance(levels, dict):
            counts["problems_skipped_invalid"] += 1
            continue

        for level_key, level_payload in levels.items():
            level = CANONICAL_LEVEL_KEYS.get(level_key)
            if level is None:
                counts["problems_skipped_unknown_level"] += 1
                continue

            if not isinstance(level_payload, dict):
                counts["problems_skipped_invalid"] += 1
                continue

            for difficulty in CANONICAL_DIFFICULTIES:
                bucket = level_payload.get(difficulty, [])
                if not isinstance(bucket, list):
                    counts["problems_skipped_invalid"] += 1
                    continue

                for question in bucket:
                    if not isinstance(question, dict):
                        counts["problems_skipped_invalid"] += 1
                        continue

                    title = to_str(question.get("title"))
                    slug = to_str(question.get("slug"))
                    description = to_str(question.get("content"))

                    if not title:
                        title = slug.replace("-", " ").title() if slug else "Untitled Problem"
                    if not description:
                        description = to_str(question.get("problem")) or "No description provided"

                    problem_id = to_str(question.get("id"))
                    external_task_id = stable_external_task_id(
                        dataset_name=dataset_name,
                        skill_name=skill_name,
                        level_key=level_key,
                        difficulty=difficulty,
                        problem_id=problem_id,
                        slug=slug,
                        title=title,
                    )
                    if external_task_id in seen_external_ids:
                        counts["problems_skipped_invalid"] += 1
                        continue

                    language = to_str(question.get("language"))
                    tags = normalize_tags(question.get("tags"), skill_name, level_key, difficulty)
                    sample_test_cases = normalize_test_cases(question.get("sample_test_cases"))
                    hidden_test_cases = normalize_test_cases(question.get("hidden_test_cases"))
                    starter_code = normalize_starter_code(question.get("starter_code"), language)

                    source_name = to_str(question.get("source")) or None
                    source_url = to_str(question.get("url")) or None
                    solution_text = to_str(question.get("solution")) or None
                    difficulty_label = to_str(question.get("difficulty")) or difficulty
                    question_type = str(question.get("question_type") or "coding").strip().lower()

                    raw_options = question.get("options")
                    raw_correct = question.get("correct_option")
                    if question_type == "mcq" and raw_options:
                        type_data = {
                            "options": raw_options,
                            "correct_option": raw_correct,
                        }
                    else:
                        type_data = None

                    problem = Problem(
                        skill_id=skill.id,
                        level=level,
                        title=title[:255],
                        description=description,
                        sample_test_cases=sample_test_cases,
                        hidden_test_cases=hidden_test_cases,
                        time_limit_minutes=45,
                        tags=tags,
                        starter_code=starter_code,
                        difficulty_label=difficulty_label[:50],
                        external_task_id=external_task_id,
                        source_name=source_name,
                        source_url=source_url,
                        source_dataset=dataset_name,
                        solution_text=solution_text,
                        question_type=question_type,
                        type_data=type_data,
                    )
                    db.add(problem)
                    seen_external_ids.add(external_task_id)
                    counts["problems_created"] += 1

    return counts


def run_seed(input_json: Path) -> None:
    if not input_json.exists():
        raise FileNotFoundError(f"Input JSON file not found: {input_json}")

    raw_payload = json.loads(input_json.read_text(encoding="utf-8"))
    if not isinstance(raw_payload, dict):
        raise ValueError("Input JSON must be a top-level object.")

    validation_errors = validate_payload(raw_payload)
    if validation_errors:
        joined = "\n- " + "\n- ".join(validation_errors)
        raise ValueError(f"Input JSON validation failed:{joined}")

    dataset_name = to_str(raw_payload.get("dataset_name")) or input_json.stem
    skills_payload = raw_payload.get("skills")
    if not isinstance(skills_payload, list):
        raise ValueError("Input JSON must include a 'skills' array.")

    admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@example.com")
    admin_password = os.getenv("SEED_ADMIN_PASSWORD", "AdminPass123!")
    admin_name = os.getenv("SEED_ADMIN_NAME", "Local Admin")

    candidate_email = os.getenv("SEED_CANDIDATE_EMAIL", "candidate@example.com")
    candidate_password = os.getenv("SEED_CANDIDATE_PASSWORD", "Passw0rd!")
    candidate_name = os.getenv("SEED_CANDIDATE_NAME", "Local Candidate")

    session_local = get_session_local()

    # Always start from a clean database for deterministic local seed data.
    reset_db_session = session_local()
    try:
        engine = reset_db_session.get_bind()
        reset_db_session.close()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    finally:
        reset_db_session.close()

    db = session_local()

    counts = {
        "users_created": 0,
        "skills_created": 0,
        "problems_created": 0,
        "progress_created": 0,
        "problems_skipped_invalid": 0,
        "problems_skipped_unknown_skill": 0,
        "problems_skipped_unknown_level": 0,
    }

    try:
        create_user(
            db=db,
            email=admin_email,
            password=admin_password,
            role=UserRole.ADMIN,
            name=admin_name,
            employee_id=os.getenv("SEED_ADMIN_EMPLOYEE_ID", "ADM-1001"),
            gender=os.getenv("SEED_ADMIN_GENDER", "Male"),
            department=os.getenv("SEED_ADMIN_DEPARTMENT", "Engineering"),
            exp_indium_years=int(os.getenv("SEED_ADMIN_EXP_INDIUM", "5")),
            exp_overall_years=int(os.getenv("SEED_ADMIN_EXP_OVERALL", "10")),
        )
        counts["users_created"] += 1

        candidate_user = create_user(
            db=db,
            email=candidate_email,
            password=candidate_password,
            role=UserRole.CANDIDATE,
            name=candidate_name,
            employee_id=os.getenv("SEED_CANDIDATE_EMPLOYEE_ID", "IND-1001"),
            gender=os.getenv("SEED_CANDIDATE_GENDER", "Female"),
            department=os.getenv("SEED_CANDIDATE_DEPARTMENT", "Engineering"),
            exp_indium_years=int(os.getenv("SEED_CANDIDATE_EXP_INDIUM", "2")),
            exp_overall_years=int(os.getenv("SEED_CANDIDATE_EXP_OVERALL", "4")),
        )
        counts["users_created"] += 1

        skills = create_skills_from_payload(db, skills_payload)
        counts["skills_created"] = len(skills)

        skills_by_name = {skill.name: skill for skill in skills}

        problem_counts = seed_problems_from_payload(
            db=db,
            dataset_name=dataset_name,
            skills_by_name=skills_by_name,
            skills_payload=skills_payload,
        )
        counts["problems_created"] += problem_counts["problems_created"]
        counts["problems_skipped_invalid"] += problem_counts["problems_skipped_invalid"]
        counts["problems_skipped_unknown_skill"] += problem_counts["problems_skipped_unknown_skill"]
        counts["problems_skipped_unknown_level"] += problem_counts["problems_skipped_unknown_level"]

        counts["progress_created"] = create_progress_for_candidate(db, candidate_user, skills)

        db.commit()

        print("Seeding complete (seed_new.py).")
        print(f"- Input JSON: {input_json.resolve()}")
        print(f"- Dataset name: {dataset_name}")
        print(f"- Users created: {counts['users_created']}")
        print(f"- Skills created: {counts['skills_created']}")
        print(f"- Problems created: {counts['problems_created']}")
        print(f"- Problems skipped (invalid): {counts['problems_skipped_invalid']}")
        print(f"- Problems skipped (unknown skill): {counts['problems_skipped_unknown_skill']}")
        print(f"- Problems skipped (unknown level): {counts['problems_skipped_unknown_level']}")
        print(f"- Progress rows created: {counts['progress_created']}")
        print("Seeded login credentials:")
        print(f"- Admin: {admin_email} / {admin_password}")
        print(f"- Candidate: {candidate_email} / {candidate_password}")
        print(f"Timestamp (UTC): {datetime.now(timezone.utc).isoformat()}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed(DEFAULT_JSON_FILE)
