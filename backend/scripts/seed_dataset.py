import sys
import argparse
import json
import re
from pathlib import Path
from typing import Any

from sqlalchemy import select

CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import get_session_local
from models import Level, Problem, Skill


DATASET_PROBLEMS = {
    "React JS": {
        Level.BEGINNER: {
            "title": "React JS - Props Formatter",
            "description": 'Read two lines: component name and prop value. Print the component as: <Name name="value" />',
            "sample_test_cases": [
                {
                    "stdin": "Greeting\\nLCGC",
                    "expected_output": '<Greeting name="LCGC" />',
                    "explanation": "Formats component with name prop.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "Button\\nClick Me",
                    "expected_output": '<Button name="Click Me" />',
                }
            ],
            "difficulty_label": "Beginner",
            "time_limit_minutes": 45,
        },
        Level.INTERMEDIATE_1: {
            "title": "React JS - State Transition Tracker",
            "description": "Read an integer (initial count) then operations on next line separated by spaces: + increments -1, - decrements 1. Print final count.",
            "sample_test_cases": [
                {
                    "stdin": "0\\n+ + - +",
                    "expected_output": "2",
                    "explanation": "Apply each operation in order.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "5\\n- - +",
                    "expected_output": "4",
                },
                {
                    "stdin": "10\\n+ + + - - -",
                    "expected_output": "10",
                },
            ],
            "difficulty_label": "Intermediate 1",
            "time_limit_minutes": 45,
        },
        Level.INTERMEDIATE_2: {
            "title": "React JS - useEffect Dependency Checker",
            "description": "Read N, then N key=value previous state lines, then N key=value current state lines. Print changed keys alphabetically one per line. If nothing changed print 'no changes'.",
            "sample_test_cases": [
                {
                    "stdin": "2\\ncount=0\\nname=Alice\\ncount=1\\nname=Alice",
                    "expected_output": "count",
                    "explanation": "Only count changed.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "2\\ncount=0\\nname=Alice\\ncount=0\\nname=Alice",
                    "expected_output": "no changes",
                },
                {
                    "stdin": "3\\na=1\\nb=2\\nc=3\\na=1\\nb=5\\nc=9",
                    "expected_output": "b\\nc",
                },
            ],
            "difficulty_label": "Intermediate 2",
            "time_limit_minutes": 45,
        },
        Level.SPECIALIST_1: {
            "title": "React JS - Context Value Resolver",
            "description": "Read N key:value context entries then a lookup key. Print value or 'undefined'.",
            "sample_test_cases": [
                {
                    "stdin": "3\\ntheme:dark\\nlang:en\\nuser:Alice\\ntheme",
                    "expected_output": "dark",
                    "explanation": "Lookup existing key.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "2\\ncolor:blue\\nsize:lg\\nfont",
                    "expected_output": "undefined",
                },
                {
                    "stdin": "4\\na:1\\nb:2\\nc:3\\nd:4\\nc",
                    "expected_output": "3",
                },
            ],
            "difficulty_label": "Specialist 1",
            "time_limit_minutes": 45,
        },
        Level.SPECIALIST_2: {
            "title": "React JS - Virtual DOM Diff",
            "description": "Read N old components then M new components. Print ADDED: (sorted), REMOVED: (sorted), UNCHANGED: (sorted). Print 'none' if section empty.",
            "sample_test_cases": [
                {
                    "stdin": "3\\nHeader\\nFooter\\nSidebar\\n3\\nHeader\\nMain\\nSidebar",
                    "expected_output": "ADDED:\\nMain\\nREMOVED:\\nFooter\\nUNCHANGED:\\nHeader\\nSidebar",
                    "explanation": "Compare old and new component sets.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "2\\nA\\nB\\n2\\nB\\nC",
                    "expected_output": "ADDED:\\nC\\nREMOVED:\\nA\\nUNCHANGED:\\nB",
                },
                {
                    "stdin": "2\\nX\\nY\\n2\\nX\\nY",
                    "expected_output": "ADDED:\\nnone\\nREMOVED:\\nnone\\nUNCHANGED:\\nX\\nY",
                },
            ],
            "difficulty_label": "Specialist 2",
            "time_limit_minutes": 45,
        },
    },
    "Java Springboot": {
        Level.BEGINNER: {
            "title": "Java Spring Boot - REST Endpoint Formatter",
            "description": "Read HTTP method and path. Print @{Method}Mapping(\"{path}\") where Method is title case.",
            "sample_test_cases": [
                {
                    "stdin": "GET\\n/users",
                    "expected_output": '@GetMapping("/users")',
                    "explanation": "Build mapping annotation for GET.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "POST\\n/auth/login",
                    "expected_output": '@PostMapping("/auth/login")',
                },
                {
                    "stdin": "DELETE\\n/users/1",
                    "expected_output": '@DeleteMapping("/users/1")',
                },
            ],
            "difficulty_label": "Beginner",
            "time_limit_minutes": 45,
        },
        Level.INTERMEDIATE_1: {
            "title": "Java Spring Boot - Bean Dependency Resolver",
            "description": "Read N bean definitions as BeanName:Dep1,Dep2 then a bean name. Print its dependencies one per line or 'no dependencies'.",
            "sample_test_cases": [
                {
                    "stdin": "2\\nUserService:UserRepository,EmailService\\nEmailService:\\nUserService",
                    "expected_output": "UserRepository\\nEmailService",
                    "explanation": "List dependencies for selected bean.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "1\\nAuthService:\\nAuthService",
                    "expected_output": "no dependencies",
                },
                {
                    "stdin": "3\\nA:B,C\\nB:\\nC:\\nA",
                    "expected_output": "B\\nC",
                },
            ],
            "difficulty_label": "Intermediate 1",
            "time_limit_minutes": 45,
        },
        Level.INTERMEDIATE_2: {
            "title": "Java Spring Boot - JPA Query Builder",
            "description": "Read a Spring Data method name like findBy{Field}{Operator}. Convert Field to snake_case. Print WHERE clause. Operators: none=equals, GreaterThan, LessThan, Like.",
            "sample_test_cases": [
                {
                    "stdin": "findByEmailLike",
                    "expected_output": "WHERE email LIKE ?",
                    "explanation": "Like operator maps to LIKE.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "findByAge",
                    "expected_output": "WHERE age = ?",
                },
                {
                    "stdin": "findBySalaryGreaterThan",
                    "expected_output": "WHERE salary > ?",
                },
                {
                    "stdin": "findByCreatedAtLessThan",
                    "expected_output": "WHERE created_at < ?",
                },
            ],
            "difficulty_label": "Intermediate 2",
            "time_limit_minutes": 45,
        },
        Level.SPECIALIST_1: {
            "title": "Java Spring Boot - JWT Claims Parser",
            "description": "Read JWT payload as comma-separated key=value pairs, then N claim names. Print each value or 'missing'.",
            "sample_test_cases": [
                {
                    "stdin": "sub=user123,role=admin,exp=9999\\n2\\nsub\\nrole",
                    "expected_output": "user123\\nadmin",
                    "explanation": "Extract requested claims in order.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "sub=alice,dept=eng\\n2\\ndept\\nname",
                    "expected_output": "eng\\nmissing",
                },
                {
                    "stdin": "id=42,active=true,role=candidate\\n3\\nrole\\nid\\nactive",
                    "expected_output": "candidate\\n42\\ntrue",
                },
            ],
            "difficulty_label": "Specialist 1",
            "time_limit_minutes": 45,
        },
        Level.SPECIALIST_2: {
            "title": "Java Spring Boot - Circuit Breaker State Machine",
            "description": "Simulate circuit breaker. Start CLOSED failure_count=0 threshold=3. Events: SUCCESS FAILURE RESET. Print state after each event.",
            "sample_test_cases": [
                {
                    "stdin": "4\\nFAILURE\\nFAILURE\\nFAILURE\\nRESET",
                    "expected_output": "CLOSED\\nCLOSED\\nOPEN\\nHALF_OPEN",
                    "explanation": "Open after threshold, reset to half-open.",
                }
            ],
            "hidden_test_cases": [
                {
                    "stdin": "5\\nFAILURE\\nFAILURE\\nFAILURE\\nRESET\\nSUCCESS",
                    "expected_output": "CLOSED\\nCLOSED\\nOPEN\\nHALF_OPEN\\nCLOSED",
                },
                {
                    "stdin": "3\\nSUCCESS\\nSUCCESS\\nFAILURE",
                    "expected_output": "CLOSED\\nCLOSED\\nCLOSED",
                },
            ],
            "difficulty_label": "Specialist 2",
            "time_limit_minutes": 45,
        },
    },
}


LEVEL_NAME_MAP: dict[str, Level] = {
    "beginner": Level.BEGINNER,
    "intermediate_1": Level.INTERMEDIATE_1,
    "intermediate1": Level.INTERMEDIATE_1,
    "intermediate_2": Level.INTERMEDIATE_2,
    "intermediate2": Level.INTERMEDIATE_2,
    "specialist_1": Level.SPECIALIST_1,
    "specialist1": Level.SPECIALIST_1,
    "specialist_2": Level.SPECIALIST_2,
    "specialist2": Level.SPECIALIST_2,
}

DIFFICULTY_BUCKETS = ("easy", "medium", "hard")


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def _map_skill_level(level_name: str) -> Level:
    normalized = _normalize_key(level_name)
    mapped = LEVEL_NAME_MAP.get(normalized)
    if mapped is None:
        raise ValueError(f"Unsupported skill level: {level_name}")
    return mapped


def _slugify(text: str) -> str:
    raw = re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")
    return raw or "untitled-question"


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _iter_levels(levels_obj: Any) -> list[tuple[str, dict[str, Any]]]:
    pairs: list[tuple[str, dict[str, Any]]] = []
    if isinstance(levels_obj, list):
        for item in levels_obj:
            if not isinstance(item, dict):
                continue
            level_name = item.get("skill_level") or item.get("level") or item.get("name")
            if isinstance(level_name, str):
                pairs.append((level_name, item))
        return pairs

    if isinstance(levels_obj, dict):
        for level_name, payload in levels_obj.items():
            if isinstance(level_name, str) and isinstance(payload, dict):
                pairs.append((level_name, payload))
        return pairs

    return pairs


def _bucket_payload(level_payload: dict[str, Any], bucket: str) -> Any:
    if bucket in level_payload:
        return level_payload[bucket]

    for key, value in level_payload.items():
        if isinstance(key, str) and _normalize_key(key) == bucket:
            return value
    return None


def _extract_questions(bucket_payload: Any) -> list[dict[str, Any]]:
    if isinstance(bucket_payload, list):
        return [item for item in bucket_payload if isinstance(item, dict)]
    if isinstance(bucket_payload, dict):
        questions = bucket_payload.get("questions")
        if isinstance(questions, list):
            return [item for item in questions if isinstance(item, dict)]
    return []


def _coerce_title(question: dict[str, Any], description: str) -> str:
    title = question.get("title") or question.get("question") or question.get("name")
    if isinstance(title, str) and title.strip():
        return title.strip()
    if description.strip():
        return description.strip()[:120]
    return "Untitled Question"


def load_from_json(filepath: str, force: bool = False) -> None:
    file_path = Path(filepath)
    if not file_path.exists():
        raise ValueError(f"JSON file not found: {filepath}")

    with file_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, dict):
        raise ValueError("Top-level JSON payload must be an object")

    schema_version = payload.get("schema_version")
    if schema_version is not None and not isinstance(schema_version, str):
        raise ValueError("schema_version must be a string when provided")

    skills_data = payload.get("skills")
    if not isinstance(skills_data, list):
        raise ValueError("JSON payload must contain a skills array")

    has_slug = hasattr(Problem, "slug")
    has_solution = hasattr(Problem, "solution")
    has_source_url = hasattr(Problem, "source_url")

    session_local = get_session_local()
    db = session_local()

    created_count = 0
    updated_count = 0
    skipped_count = 0

    try:
        for skill_entry in skills_data:
            if not isinstance(skill_entry, dict):
                continue

            skill_name = skill_entry.get("name") or skill_entry.get("skill_name")
            if not isinstance(skill_name, str) or not skill_name.strip():
                raise ValueError("Each skill entry must include a non-empty name")

            skill = db.scalar(select(Skill).where(Skill.name == skill_name))
            if skill is None:
                raise ValueError(f"Skill not found in database: {skill_name}")

            levels = _iter_levels(skill_entry.get("levels"))
            for level_name, level_payload in levels:
                mapped_level = _map_skill_level(level_name)

                for bucket in DIFFICULTY_BUCKETS:
                    questions = _extract_questions(_bucket_payload(level_payload, bucket))
                    for question in questions:
                        description = str(
                            question.get("content")
                            or question.get("description")
                            or ""
                        )
                        title = _coerce_title(question, description)
                        slug = str(question.get("slug") or _slugify(title))

                        sample_cases = _as_list(
                            question.get("sample_test_cases")
                            or question.get("sampleTestCases")
                            or question.get("sample_cases")
                        )
                        hidden_cases = _as_list(
                            question.get("hidden_test_cases")
                            or question.get("hiddenTestCases")
                            or question.get("hidden_cases")
                        )

                        time_limit_minutes_raw = question.get("time_limit_minutes", 45)
                        try:
                            time_limit_minutes = int(time_limit_minutes_raw)
                        except (TypeError, ValueError):
                            time_limit_minutes = 45

                        lookup = select(Problem).where(
                            Problem.skill_id == skill.id,
                            Problem.level == mapped_level,
                        )
                        if has_slug:
                            lookup = lookup.where(getattr(Problem, "slug") == slug)
                        else:
                            lookup = lookup.where(Problem.title == title)

                        problem = db.scalar(lookup)
                        difficulty_label = bucket.title()

                        if problem:
                            problem.title = title
                            problem.description = description
                            problem.difficulty_label = difficulty_label

                            if force or sample_cases:
                                problem.sample_test_cases = sample_cases
                            if force or hidden_cases:
                                problem.hidden_test_cases = hidden_cases
                            if force or time_limit_minutes_raw is not None:
                                problem.time_limit_minutes = time_limit_minutes

                            if has_slug:
                                setattr(problem, "slug", slug)
                            if has_solution and (force or question.get("solution") is not None):
                                setattr(problem, "solution", question.get("solution"))
                            if has_source_url and (force or question.get("url") is not None):
                                setattr(problem, "source_url", question.get("url"))

                            updated_count += 1
                            print(f"UPDATED: {skill_name} / {mapped_level.value} / {slug}")
                        else:
                            create_kwargs: dict[str, Any] = {
                                "skill_id": skill.id,
                                "level": mapped_level,
                                "title": title,
                                "description": description,
                                "sample_test_cases": sample_cases,
                                "hidden_test_cases": hidden_cases,
                                "difficulty_label": difficulty_label,
                                "time_limit_minutes": time_limit_minutes,
                            }

                            if has_slug:
                                create_kwargs["slug"] = slug
                            if has_solution:
                                create_kwargs["solution"] = question.get("solution")
                            if has_source_url:
                                create_kwargs["source_url"] = question.get("url")

                            problem = Problem(**create_kwargs)
                            db.add(problem)
                            created_count += 1
                            print(f"CREATED: {skill_name} / {mapped_level.value} / {slug}")

                    if not questions:
                        skipped_count += 1

        db.commit()
        print("SUMMARY")
        print(f"CREATED: {created_count}")
        print(f"UPDATED: {updated_count}")
        print(f"SKIPPED: {skipped_count}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def run_dataset_seed() -> None:
    session_local = get_session_local()
    db = session_local()

    created_count = 0
    updated_count = 0
    skipped_count = 0

    try:
        for skill_name, levels_map in DATASET_PROBLEMS.items():
            skill = db.scalar(select(Skill).where(Skill.name == skill_name))
            if not skill:
                print(f"SKIPPED: {skill_name} (skill not found)")
                skipped_count += len(levels_map)
                continue

            for level, payload in levels_map.items():
                problem = db.scalar(
                    select(Problem).where(
                        Problem.skill_id == skill.id,
                        Problem.level == level,
                    )
                )

                if problem:
                    problem.title = payload["title"]
                    problem.description = payload["description"]
                    problem.sample_test_cases = payload["sample_test_cases"]
                    problem.hidden_test_cases = payload["hidden_test_cases"]
                    problem.difficulty_label = payload["difficulty_label"]
                    problem.time_limit_minutes = payload["time_limit_minutes"]
                    updated_count += 1
                    print(f"UPDATED: {skill_name} / {level.value}")
                else:
                    problem = Problem(
                        skill_id=skill.id,
                        level=level,
                        title=payload["title"],
                        description=payload["description"],
                        sample_test_cases=payload["sample_test_cases"],
                        hidden_test_cases=payload["hidden_test_cases"],
                        difficulty_label=payload["difficulty_label"],
                        time_limit_minutes=payload["time_limit_minutes"],
                    )
                    db.add(problem)
                    created_count += 1
                    print(f"CREATED: {skill_name} / {level.value}")

        db.commit()
        print("SUMMARY")
        print(f"CREATED: {created_count}")
        print(f"UPDATED: {updated_count}")
        print(f"SKIPPED: {skipped_count}")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed assessment datasets")
    parser.add_argument("--json", dest="json_path", help="Path to Kamil schema JSON file")
    parser.add_argument("--force", action="store_true", help="Force overwrite of existing fields when loading JSON")
    args = parser.parse_args()

    if args.json_path:
        load_from_json(args.json_path, force=args.force)
    else:
        run_dataset_seed()