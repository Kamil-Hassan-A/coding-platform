import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

# Allow running as: python scripts/seed.py from backend/
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import get_session_local
from models import Level, Problem, Skill, User, UserRole, UserSkillProgress 
from security import hash_password 


LEVEL_ORDER = [
    Level.BEGINNER,
    Level.INTERMEDIATE_1,
    Level.INTERMEDIATE_2,
    Level.SPECIALIST_1,
    Level.SPECIALIST_2,
]

SKILL_SEEDS = [
    {
        "name": "Python",
        "description": "Core Python programming",
        "icon_url": None,
    },
    {
        "name": "SQL",
        "description": "Querying and data manipulation",
        "icon_url": None,
    },
    {
        "name": "Data Structures",
        "description": "Arrays, maps, stacks, and algorithmic basics",
        "icon_url": None,
    },
]

PROBLEM_TEMPLATES = {
    Level.BEGINNER: {
        "title": "Echo Input",
        "description": "Read stdin and print exactly the same value.",
        "sample_test_cases": [{"stdin": "hello", "expected_output": "hello", "explanation": "Echo text"}],
        "hidden_test_cases": [{"stdin": "abc", "expected_output": "abc"}],
        "difficulty_label": "Beginner",
        "time_limit_minutes": 45,
    },
    Level.INTERMEDIATE_1: {
        "title": "Sum Two Integers",
        "description": "Read two integers from stdin and print their sum.",
        "sample_test_cases": [{"stdin": "2 3", "expected_output": "5", "explanation": "2 + 3"}],
        "hidden_test_cases": [{"stdin": "10 40", "expected_output": "50"}],
        "difficulty_label": "Intermediate 1",
        "time_limit_minutes": 45,
    },
    Level.INTERMEDIATE_2: {
        "title": "Count Words",
        "description": "Read a line and print the number of words.",
        "sample_test_cases": [{"stdin": "hello world", "expected_output": "2", "explanation": "Two words"}],
        "hidden_test_cases": [{"stdin": "a b c d", "expected_output": "4"}],
        "difficulty_label": "Intermediate 2",
        "time_limit_minutes": 45,
    },
    Level.SPECIALIST_1: {
        "title": "Reverse Lines",
        "description": "Read stdin text and print it reversed character-by-character.",
        "sample_test_cases": [{"stdin": "abcd", "expected_output": "dcba", "explanation": "Reverse string"}],
        "hidden_test_cases": [{"stdin": "racecar", "expected_output": "racecar"}],
        "difficulty_label": "Specialist 1",
        "time_limit_minutes": 45,
    },
    Level.SPECIALIST_2: {
        "title": "Unique Sorted Numbers",
        "description": "Read space-separated integers and print unique sorted values.",
        "sample_test_cases": [
            {"stdin": "3 1 2 2 3", "expected_output": "1 2 3", "explanation": "Sort and deduplicate"}
        ],
        "hidden_test_cases": [{"stdin": "5 4 5 1", "expected_output": "1 4 5"}],
        "difficulty_label": "Specialist 2",
        "time_limit_minutes": 45,
    },
}


def get_or_create_user(db, email: str, password: str, role: UserRole, name: str) -> tuple[User, bool]:
    user = db.scalar(select(User).where(User.email == email))
    if user:
        return user, False

    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
        name=name,
    )
    db.add(user)
    db.flush()
    return user, True


def get_or_create_skill(db, payload: dict) -> tuple[Skill, bool]:
    skill = db.scalar(select(Skill).where(Skill.name == payload["name"]))
    if skill:
        return skill, False

    skill = Skill(
        name=payload["name"],
        description=payload.get("description"),
        icon_url=payload.get("icon_url"),
    )
    db.add(skill)
    db.flush()
    return skill, True


def get_or_create_problem(db, skill: Skill, level: Level, template: dict) -> bool:
    title = f"{skill.name} - {template['title']}"
    existing = db.scalar(
        select(Problem).where(
            Problem.skill_id == skill.id,
            Problem.level == level,
            Problem.title == title,
        )
    )
    if existing:
        return False

    problem = Problem(
        skill_id=skill.id,
        level=level,
        title=title,
        description=template["description"],
        sample_test_cases=template["sample_test_cases"],
        hidden_test_cases=template["hidden_test_cases"],
        time_limit_minutes=template["time_limit_minutes"],
        difficulty_label=template["difficulty_label"],
    )
    db.add(problem)
    return True


def ensure_progress_for_candidate(db, user: User, skill: Skill) -> int:
    inserted = 0
    for level in LEVEL_ORDER:
        existing = db.scalar(
            select(UserSkillProgress).where(
                UserSkillProgress.user_id == user.id,
                UserSkillProgress.skill_id == skill.id,
                UserSkillProgress.level == level,
            )
        )
        if existing:
            if level == Level.BEGINNER and not existing.unlocked:
                existing.unlocked = True
            continue

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


def run_seed() -> None:
    admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@example.com")
    admin_password = os.getenv("SEED_ADMIN_PASSWORD", "AdminPass123!")
    admin_name = os.getenv("SEED_ADMIN_NAME", "Local Admin")

    candidate_email = os.getenv("SEED_CANDIDATE_EMAIL", "candidate@example.com")
    candidate_password = os.getenv("SEED_CANDIDATE_PASSWORD", "Passw0rd!")
    candidate_name = os.getenv("SEED_CANDIDATE_NAME", "Local Candidate")

    session_local = get_session_local()
    db = session_local()

    counts = {
        "users_created": 0,
        "skills_created": 0,
        "problems_created": 0,
        "progress_created": 0,
    }

    try:
        _, admin_created = get_or_create_user(
            db=db,
            email=admin_email,
            password=admin_password,
            role=UserRole.ADMIN,
            name=admin_name,
        )
        counts["users_created"] += int(admin_created)

        candidate_user, candidate_created = get_or_create_user(
            db=db,
            email=candidate_email,
            password=candidate_password,
            role=UserRole.CANDIDATE,
            name=candidate_name,
        )
        counts["users_created"] += int(candidate_created)

        skills: list[Skill] = []
        for skill_payload in SKILL_SEEDS:
            skill, created = get_or_create_skill(db, skill_payload)
            skills.append(skill)
            counts["skills_created"] += int(created)

        for skill in skills:
            for level in LEVEL_ORDER:
                created = get_or_create_problem(db, skill, level, PROBLEM_TEMPLATES[level])
                counts["problems_created"] += int(created)

        # Ensure local candidate has baseline unlock records.
        for skill in skills:
            counts["progress_created"] += ensure_progress_for_candidate(db, candidate_user, skill)

        db.commit()

        print("Seeding complete.")
        print(f"- Users created: {counts['users_created']}")
        print(f"- Skills created: {counts['skills_created']}")
        print(f"- Problems created: {counts['problems_created']}")
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
    run_seed()
