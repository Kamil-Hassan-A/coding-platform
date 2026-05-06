import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Allow running as: python scripts/seed.py from backend/
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

# Seed directly from the new dataset payload
DEFAULT_JSON_FILE = CURRENT_FILE.parent / "problem_dataset_new.json"


def to_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def resolve_allowed_languages(skill_obj: dict[str, Any]) -> list[dict[str, Any]]:
    return skill_obj.get("allowed_languages", [])


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
            description=to_str(skill_obj.get("description")) or "Imported from seed JSON",
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
    skills_by_name: dict[str, Skill],
    skills_payload: list[dict[str, Any]],
) -> dict[str, int]:
    counts = {
        "problems_created": 0,
        "problems_skipped_invalid": 0,
        "problems_skipped_unknown_skill": 0,
        "problems_skipped_unknown_level": 0,
    }

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

                    title = to_str(question.get("title")) or "Untitled Problem"
                    description = to_str(question.get("description"))

                    question_type = str(question.get("question_type") or "coding").strip().lower()

                    problem = Problem(
                        skill_id=skill.id,
                        level=level,
                        title=title[:255],
                        description=description,
                        sample_test_cases=question.get("test_cases", []) if question_type != "sql" else question.get("test_cases", []), # In new schema, sample_test_cases are sometimes just test_cases
                        hidden_test_cases=question.get("hidden_test_cases", []),
                        time_limit_minutes=45,
                        tags=question.get("tags", []),
                        starter_code=question.get("starter_code", None),
                        difficulty_label=to_str(question.get("difficulty")) or difficulty,
                        solution_text=to_str(question.get("solution")) or None,
                        question_type=question_type,
                        
                        options=question.get("options", None),
                        correct_option_index=question.get("correct_option_index", None),
                        
                        starter_files=question.get("starter_files", None),
                        entry_point=question.get("entry_point", None),
                        test_harness=question.get("test_harness", None),
                        
                        database_schema=question.get("schema", None),
                    )
                    # Normalize test_cases property vs sample_test_cases
                    test_cases_from_payload = question.get("test_cases", [])
                    if isinstance(test_cases_from_payload, list) and len(test_cases_from_payload) > 0:
                        problem.sample_test_cases = test_cases_from_payload
                    elif isinstance(question.get("sample_test_cases"), list):
                        problem.sample_test_cases = question.get("sample_test_cases")

                    db.add(problem)
                    counts["problems_created"] += 1

    return counts


def run_seed(input_json: Path) -> None:
    if not input_json.exists():
        raise FileNotFoundError(f"Input JSON file not found: {input_json}")

    raw_payload = json.loads(input_json.read_text(encoding="utf-8"))
    
    skills_payload = raw_payload.get("skills") if isinstance(raw_payload, dict) else raw_payload
    if not isinstance(skills_payload, list):
        raise ValueError("Input JSON must contain a 'skills' array.")

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
            skills_by_name=skills_by_name,
            skills_payload=skills_payload,
        )
        counts["problems_created"] += problem_counts["problems_created"]
        counts["problems_skipped_invalid"] += problem_counts["problems_skipped_invalid"]
        counts["problems_skipped_unknown_skill"] += problem_counts["problems_skipped_unknown_skill"]
        counts["problems_skipped_unknown_level"] += problem_counts["problems_skipped_unknown_level"]

        counts["progress_created"] = create_progress_for_candidate(db, candidate_user, skills)

        db.commit()

        print("Seeding complete (seed.py).")
        print(f"- Input JSON: {input_json.resolve()}")
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
