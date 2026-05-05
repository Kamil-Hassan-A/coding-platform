import argparse
import hashlib
import os
import runpy
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

LANGS = {
    "python": {"id": 71, "name": "Python (3.8.1)", "monaco": "python"},
    "javascript": {"id": 63, "name": "JavaScript (Node.js 12.14.0)", "monaco": "javascript"},
    "typescript": {"id": 74, "name": "TypeScript (3.7.4)", "monaco": "typescript"},
    "java": {"id": 62, "name": "Java (OpenJDK 13.0.1)", "monaco": "java"},
    "cpp": {"id": 54, "name": "C++ (GCC 9.2.0)", "monaco": "cpp"},
    "csharp": {"id": 51, "name": "C# (Mono 6.6.0.161)", "monaco": "csharp"},
    "sql": {"id": 82, "name": "SQL (SQLite 3.27.2)", "monaco": "sql"},
}

GEN_LANGS = [LANGS["python"], LANGS["javascript"], LANGS["java"], LANGS["cpp"]]

SKILL_SEEDS = [
    {
        "name": "Agile",
        "description": "Agile values, ceremonies, and delivery practices",
        "icon_url": None,
        "allowed_languages": GEN_LANGS,
    },
    {
        "name": "HTML, CSS, JS",
        "description": "Frontend fundamentals using HTML, CSS, and JavaScript",
        "icon_url": None,
        "allowed_languages": [LANGS["javascript"], LANGS["typescript"]],
    },
    {
        "name": "React JS",
        "description": "Building component-based user interfaces with React",
        "icon_url": None,
        "allowed_languages": [LANGS["javascript"], LANGS["typescript"]],
    },
    {
        "name": "React JS with Redux",
        "description": "State-managed React applications using Redux",
        "icon_url": None,
        "allowed_languages": [LANGS["javascript"], LANGS["typescript"]],
    },
    {
        "name": "TypeScript",
        "description": "Typed JavaScript development with TypeScript",
        "icon_url": None,
        "allowed_languages": [LANGS["typescript"], LANGS["javascript"]],
    },
    {
        "name": "Next JS",
        "description": "Full-stack React applications with Next.js",
        "icon_url": None,
        "allowed_languages": [LANGS["javascript"], LANGS["typescript"]],
    },
    {
        "name": "Angular",
        "description": "Web application development using Angular",
        "icon_url": None,
        "allowed_languages": [LANGS["typescript"], LANGS["javascript"]],
    },
    {
        "name": "Python with Flask",
        "description": "Backend API development with Flask",
        "icon_url": None,
        "allowed_languages": [LANGS["python"]],
    },
    {
        "name": "Python with Django",
        "description": "Backend and web application development with Django",
        "icon_url": None,
        "allowed_languages": [LANGS["python"]],
    },
    {
        "name": "Python for Data Science",
        "description": "Data analysis and modeling workflows in Python",
        "icon_url": None,
        "allowed_languages": [LANGS["python"], LANGS["sql"]],
    },
    {
        "name": "Java",
        "description": "Core Java programming and object-oriented design",
        "icon_url": None,
        "allowed_languages": [LANGS["java"]],
    },
    {
        "name": "Java Spring Boot",
        "description": "Building Java backend services with Spring Boot",
        "icon_url": None,
        "allowed_languages": [LANGS["java"]],
    },
    {
        "name": ".NET, C#",
        "description": "Application development with .NET and C#",
        "icon_url": None,
        "allowed_languages": [LANGS["csharp"], LANGS["cpp"]],
    },
    {
        "name": ".NET, VB.NET",
        "description": "Application development with .NET and VB.NET",
        "icon_url": None,
        "allowed_languages": [LANGS["csharp"], LANGS["cpp"]],
    },
    {
        "name": "SQL",
        "description": "Relational querying and data manipulation",
        "icon_url": None,
        "allowed_languages": [LANGS["sql"]],
    },
    {
        "name": "MongoDB",
        "description": "NoSQL document modeling and querying with MongoDB",
        "icon_url": None,
        "allowed_languages": [LANGS["javascript"], LANGS["python"]],
    },
    {
        "name": "PostgreSQL",
        "description": "Advanced SQL and relational database design in PostgreSQL",
        "icon_url": None,
        "allowed_languages": [LANGS["sql"], LANGS["python"]],
    },
    {
        "name": "Java Selenium",
        "description": "UI automation testing using Selenium with Java",
        "icon_url": None,
        "allowed_languages": [LANGS["java"]],
    },
    {
        "name": "Python Selenium",
        "description": "UI automation testing using Selenium with Python",
        "icon_url": None,
        "allowed_languages": [LANGS["python"]],
    },
]

DEFAULT_DATASET_ROOT = BACKEND_DIR.parent / "dataset"
DATASET_VARIABLE_CANDIDATES = [
    "KNOWLEDGE_BASE",
    "KNOWLEDGE_BASE_EXTENSION",
]


def normalize_level(level_raw: Any) -> Level:
    value = str(level_raw or "").strip().lower().replace("-", " ").replace("_", " ")
    if value in {"beginner", "easy"}:
        return Level.BEGINNER
    if value in {"intermediate 1", "intermediate1", "medium", "intermediate"}:
        return Level.INTERMEDIATE_1
    if value in {"intermediate 2", "intermediate2", "mid advanced"}:
        return Level.INTERMEDIATE_2
    if value in {"specialist 1", "specialist1", "hard"}:
        return Level.SPECIALIST_1
    if value in {"specialist 2", "specialist2", "expert"}:
        return Level.SPECIALIST_2
    return Level.BEGINNER


def stable_external_task_id(source_dataset: str, skill_name: str, level_raw: str, title: str, prompt: str) -> str:
    payload = f"{source_dataset}|{skill_name}|{level_raw}|{title}|{prompt}".encode("utf-8")
    digest = hashlib.sha1(payload).hexdigest()[:28]
    return f"kb:{digest}"


def to_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_tags(raw_tags: Any, skill_name: str, level_raw: str) -> list[str]:
    tags: list[str] = []

    if isinstance(raw_tags, list):
        tags.extend([to_str(item) for item in raw_tags])
    elif isinstance(raw_tags, str):
        tags.extend([part.strip() for part in raw_tags.split(",")])

    tags.extend([skill_name, level_raw])

    deduped: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if not tag:
            continue
        normalized = tag.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(tag)
    return deduped


def normalize_test_cases(raw_cases: Any) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    if not isinstance(raw_cases, list):
        return normalized

    for case in raw_cases:
        if isinstance(case, dict):
            input_value = to_str(case.get("input", case.get("stdin", "")))
            output_value = to_str(case.get("output", case.get("expected_output", case.get("expected", ""))))
            normalized.append({"input": input_value, "output": output_value})
        elif isinstance(case, str):
            normalized.append({"input": case, "output": ""})

    return normalized


def get_starter_code(record: dict[str, Any]) -> dict[str, Any] | None:
    candidate = record.get("starter_code")
    if isinstance(candidate, dict):
        return candidate
    if isinstance(candidate, str) and candidate.strip():
        return {"default": candidate}

    template_code = record.get("templateCode")
    if isinstance(template_code, str) and template_code.strip():
        return {"default": template_code}

    language = to_str(record.get("language")).lower()
    if language:
        return {
            language: "",
            "default": "",
        }
    return {"default": ""}


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


def create_skills(db) -> list[Skill]:
    skills: list[Skill] = []
    for payload in SKILL_SEEDS:
        skill = Skill(
            name=payload["name"],
            description=payload.get("description"),
            icon_url=payload.get("icon_url"),
            allowed_languages=payload.get("allowed_languages", []),
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


def load_dataset_records(file_path: Path, variable_name: str) -> list[dict[str, Any]]:
    module_globals = runpy.run_path(str(file_path))
    data = module_globals.get(variable_name)
    if not isinstance(data, list):
        raise ValueError(f"Expected list variable '{variable_name}' in {file_path}")
    return [row for row in data if isinstance(row, dict)]


def discover_dataset_sources(dataset_root: Path) -> list[dict[str, Any]]:
    if not dataset_root.exists():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_root}")

    discovered: list[dict[str, Any]] = []
    for py_file in dataset_root.rglob("*.py"):
        # Ignore helper/seed scripts and cache paths.
        if py_file.name.startswith("seed_"):
            continue
        if "__pycache__" in py_file.parts:
            continue

        module_globals = runpy.run_path(str(py_file))
        selected_variable = None
        for variable_name in DATASET_VARIABLE_CANDIDATES:
            candidate = module_globals.get(variable_name)
            if isinstance(candidate, list):
                selected_variable = variable_name
                break

        # Fallback: pick the first top-level list of dict records.
        if selected_variable is None:
            for variable_name, value in module_globals.items():
                if isinstance(value, list) and value and isinstance(value[0], dict):
                    selected_variable = variable_name
                    break

        if selected_variable is None:
            continue

        discovered.append(
            {
                "file": py_file,
                "variable": selected_variable,
                "source_dataset": py_file.parent.name,
            }
        )

    if not discovered:
        raise ValueError(f"No dataset Python files found under: {dataset_root}")

    return sorted(discovered, key=lambda item: str(item["file"]))


def seed_problems_from_datasets(
    db,
    skills_by_name: dict[str, Skill],
    dataset_sources: list[dict[str, Any]],
) -> dict[str, int]:
    counts = {
        "problems_created": 0,
        "problems_skipped_invalid": 0,
        "problems_skipped_unknown_skill": 0,
    }

    seen_external_ids: set[str] = set()

    for source in dataset_sources:
        dataset_file = source["file"]
        variable_name = source["variable"]
        source_dataset = source["source_dataset"]

        if not dataset_file.exists():
            raise FileNotFoundError(f"Dataset file not found: {dataset_file}")

        records = load_dataset_records(dataset_file, variable_name)

        for record in records:
            skill_raw = to_str(record.get("skill"))
            title = to_str(record.get("title"))
            level_raw = to_str(record.get("level"))
            prompt = to_str(record.get("problem"))

            if not skill_raw or not title or not prompt:
                counts["problems_skipped_invalid"] += 1
                continue

            skill = skills_by_name.get(skill_raw)
            if not skill:
                counts["problems_skipped_unknown_skill"] += 1
                continue

            level = normalize_level(level_raw)
            external_task_id = stable_external_task_id(source_dataset, skill_raw, level_raw, title, prompt)
            if external_task_id in seen_external_ids:
                counts["problems_skipped_invalid"] += 1
                continue

            source_name = to_str(record.get("source")) or None
            solution_text = to_str(record.get("solution")) or None

            sample_test_cases = normalize_test_cases(record.get("sample_test_cases"))
            hidden_test_cases = normalize_test_cases(record.get("hidden_test_cases"))
            if not sample_test_cases:
                sample_test_cases = normalize_test_cases(record.get("test_cases"))

            tags = normalize_tags(record.get("tags"), skill_raw, level_raw)
            starter_code = get_starter_code(record)

            problem = Problem(
                skill_id=skill.id,
                level=level,
                title=title[:255],
                description=prompt,
                sample_test_cases=sample_test_cases,
                hidden_test_cases=hidden_test_cases,
                time_limit_minutes=45,
                tags=tags,
                starter_code=starter_code,
                difficulty_label=(level_raw[:50] if level_raw else None),
                external_task_id=external_task_id,
                source_name=source_name,
                source_dataset=source_dataset,
                solution_text=solution_text,
            )
            db.add(problem)
            seen_external_ids.add(external_task_id)
            counts["problems_created"] += 1

    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reset DB and seed users/skills/progress/problems in one pass.")
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=DEFAULT_DATASET_ROOT,
        help="Root dataset directory to auto-discover Python dataset files.",
    )
    parser.add_argument(
        "--skip-problems",
        action="store_true",
        help="Skip dataset discovery and problem seeding (only users/skills/progress).",
    )
    return parser.parse_args()


def run_seed(dataset_root: Path, skip_problems: bool = False) -> None:
    admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@example.com")
    admin_password = os.getenv("SEED_ADMIN_PASSWORD", "AdminPass123!")
    admin_name = os.getenv("SEED_ADMIN_NAME", "Local Admin")

    candidate_email = os.getenv("SEED_CANDIDATE_EMAIL", "candidate@example.com")
    candidate_password = os.getenv("SEED_CANDIDATE_PASSWORD", "Passw0rd!")
    candidate_name = os.getenv("SEED_CANDIDATE_NAME", "Local Candidate")

    session_local = get_session_local()
    dataset_sources: list[dict[str, Any]] = []
    if not skip_problems:
        dataset_sources = discover_dataset_sources(dataset_root)

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

        skills = create_skills(db)
        counts["skills_created"] = len(skills)

        skills_by_name = {skill.name: skill for skill in skills}

        if not skip_problems:
            problem_counts = seed_problems_from_datasets(db, skills_by_name, dataset_sources)
            counts["problems_created"] += problem_counts["problems_created"]
            counts["problems_skipped_invalid"] += problem_counts["problems_skipped_invalid"]
            counts["problems_skipped_unknown_skill"] += problem_counts["problems_skipped_unknown_skill"]

        # Fresh DB each run: directly create baseline unlock records.
        counts["progress_created"] = create_progress_for_candidate(db, candidate_user, skills)

        db.commit()

        print("Seeding complete.")
        print(f"- Dataset root: {dataset_root.resolve()}")
        print(f"- Dataset files discovered: {len(dataset_sources)}")
        print(f"- Users created: {counts['users_created']}")
        print(f"- Skills created: {counts['skills_created']}")
        print(f"- Problems created: {counts['problems_created']}")
        print(f"- Problems skipped (invalid): {counts['problems_skipped_invalid']}")
        print(f"- Problems skipped (unknown skill): {counts['problems_skipped_unknown_skill']}")
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
    args = parse_args()
    run_seed(args.dataset_root, args.skip_problems)
