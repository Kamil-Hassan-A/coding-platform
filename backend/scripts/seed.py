import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import inspect, select, text

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
        "name": "Java Springboot",
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

SKILL_CONTEXT = {
    "Agile": {"focus": "agile ceremonies and iterative delivery", "keyword": "sprint"},
    "HTML, CSS, JS": {"focus": "web markup, styling, and browser scripting", "keyword": "frontend"},
    "React JS": {"focus": "component architecture and UI composition", "keyword": "component"},
    "React JS with Redux": {"focus": "state management and predictable updates", "keyword": "redux"},
    "TypeScript": {"focus": "type safety and static analysis", "keyword": "types"},
    "Next JS": {"focus": "server rendering and full-stack routing", "keyword": "routing"},
    "Angular": {"focus": "modules, services, and reactive patterns", "keyword": "module"},
    "Python with Flask": {"focus": "microservice APIs and request handlers", "keyword": "flask"},
    "Python with Django": {"focus": "ORM-backed apps and MVC workflows", "keyword": "django"},
    "Python for Data Science": {"focus": "data cleaning and analysis pipelines", "keyword": "dataset"},
    "Java": {"focus": "object-oriented design and core language features", "keyword": "class"},
    "Java Springboot": {"focus": "REST APIs and dependency injection", "keyword": "spring"},
    ".NET, C#": {"focus": "typed application services on .NET", "keyword": "dotnet"},
    ".NET, VB.NET": {"focus": "business application workflows on .NET", "keyword": "vbnet"},
    "SQL": {"focus": "query planning and relational operations", "keyword": "query"},
    "MongoDB": {"focus": "document models and aggregation concepts", "keyword": "document"},
    "PostgreSQL": {"focus": "advanced relational features and indexing", "keyword": "postgres"},
    "Java Selenium": {"focus": "UI automation and regression testing", "keyword": "selenium"},
    "Python Selenium": {"focus": "browser automation and test scripting", "keyword": "webdriver"},
}


def slugify_skill(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower())
    return slug.strip("_") or "skill"


def build_problem_templates_for_skill(skill_name: str) -> dict:
    context = SKILL_CONTEXT.get(skill_name, {"focus": "software engineering fundamentals", "keyword": "skill"})
    focus = context["focus"]
    keyword = context["keyword"]
    skill_slug = slugify_skill(skill_name)
    skill_bonus = max(2, len(skill_slug) % 9 + 1)

    return {
        Level.BEGINNER: {
            "title": "Skill Tag Formatter",
            "description": (
                f"Read one line and print '{skill_slug}|<input>'. "
                f"The scenario is themed around {focus}."
            ),
            "sample_test_cases": [
                {
                    "stdin": keyword,
                    "expected_output": f"{skill_slug}|{keyword}",
                    "explanation": "Prefix input with skill tag",
                }
            ],
            "hidden_test_cases": [{"stdin": "practice", "expected_output": f"{skill_slug}|practice"}],
            "difficulty_label": "Beginner",
            "time_limit_minutes": 45,
        },
        Level.INTERMEDIATE_1: {
            "title": "Skill Bonus Sum",
            "description": (
                "Read two integers and print their sum plus a fixed skill bonus "
                f"of {skill_bonus}."
            ),
            "sample_test_cases": [
                {
                    "stdin": "2 3",
                    "expected_output": str(2 + 3 + skill_bonus),
                    "explanation": f"2 + 3 + {skill_bonus}",
                }
            ],
            "hidden_test_cases": [{"stdin": "10 40", "expected_output": str(10 + 40 + skill_bonus)}],
            "difficulty_label": "Intermediate 1",
            "time_limit_minutes": 45,
        },
        Level.INTERMEDIATE_2: {
            "title": "Keyword Counter",
            "description": (
                f"Read a line and count how many words exactly match '{keyword}' "
                "(case-insensitive)."
            ),
            "sample_test_cases": [
                {
                    "stdin": f"{keyword} test {keyword}",
                    "expected_output": "2",
                    "explanation": "Two exact keyword matches",
                }
            ],
            "hidden_test_cases": [{"stdin": f"x {keyword} y", "expected_output": "1"}],
            "difficulty_label": "Intermediate 2",
            "time_limit_minutes": 45,
        },
        Level.SPECIALIST_1: {
            "title": "Delimited Reverse",
            "description": (
                "Read comma-separated tokens and print them in reverse order joined "
                "by a single space."
            ),
            "sample_test_cases": [
                {
                    "stdin": "a,b,c,d",
                    "expected_output": "d c b a",
                    "explanation": "Reverse token order",
                }
            ],
            "hidden_test_cases": [{"stdin": "one,two", "expected_output": "two one"}],
            "difficulty_label": "Specialist 1",
            "time_limit_minutes": 45,
        },
        Level.SPECIALIST_2: {
            "title": "Unique Sorted Values",
            "description": (
                "Read space-separated integers and print unique sorted values in "
                "ascending order."
            ),
            "sample_test_cases": [
                {
                    "stdin": "3 1 2 2 3",
                    "expected_output": "1 2 3",
                    "explanation": "Sort and deduplicate",
                }
            ],
            "hidden_test_cases": [{"stdin": "5 4 5 1", "expected_output": "1 4 5"}],
            "difficulty_label": "Specialist 2",
            "time_limit_minutes": 45,
        },
    }


def ensure_user_profile_columns(db) -> None:
    inspector = inspect(db.bind)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}

    column_statements = {
        "employee_id": "ALTER TABLE users ADD COLUMN employee_id VARCHAR(50)",
        "gender": "ALTER TABLE users ADD COLUMN gender VARCHAR(20)",
        "department": "ALTER TABLE users ADD COLUMN department VARCHAR(100)",
        "exp_indium_years": "ALTER TABLE users ADD COLUMN exp_indium_years INTEGER DEFAULT 0",
        "exp_overall_years": "ALTER TABLE users ADD COLUMN exp_overall_years INTEGER DEFAULT 0",
    }

    for column_name, statement in column_statements.items():
        if column_name not in existing_columns:
            db.execute(text(statement))


def get_or_create_user(
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
) -> tuple[User, bool]:
    user = db.scalar(select(User).where(User.email == email))
    if user:
        user.employee_id = user.employee_id or employee_id
        user.gender = user.gender or gender
        user.department = user.department or department
        if user.exp_indium_years is None:
            user.exp_indium_years = exp_indium_years
        if user.exp_overall_years is None:
            user.exp_overall_years = exp_overall_years
        return user, False

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
    return user, True


def get_or_create_skill(db, payload: dict) -> tuple[Skill, bool]:
    skill = db.scalar(select(Skill).where(Skill.name == payload["name"]))
    if skill:
        skill.allowed_languages = payload.get("allowed_languages", [])
        return skill, False

    skill = Skill(
        name=payload["name"],
        description=payload.get("description"),
        icon_url=payload.get("icon_url"),
        allowed_languages=payload.get("allowed_languages", []),
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
    }

    try:
        ensure_user_profile_columns(db)

        _, admin_created = get_or_create_user(
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
        counts["users_created"] += int(admin_created)

        candidate_user, candidate_created = get_or_create_user(
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
        counts["users_created"] += int(candidate_created)

        skills: list[Skill] = []
        for skill_payload in SKILL_SEEDS:
            skill, created = get_or_create_skill(db, skill_payload)
            skills.append(skill)
            counts["skills_created"] += int(created)

        for skill in skills:
            skill_templates = build_problem_templates_for_skill(skill.name)
            for level in LEVEL_ORDER:
                created = get_or_create_problem(db, skill, level, skill_templates[level])
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
