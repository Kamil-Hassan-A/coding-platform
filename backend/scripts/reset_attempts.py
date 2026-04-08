from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reset assessment session attempts for a candidate by email and optional skill.",
    )
    parser.add_argument("--email", required=True, help="Candidate email (e.g. candidate@example.com)")
    parser.add_argument("--skill", required=False, help="Optional skill name to reset (e.g. Java)")
    return parser.parse_args()


def load_database_url() -> str:
    backend_dir = Path(__file__).resolve().parents[1]
    env_path = backend_dir / ".env"
    load_dotenv(dotenv_path=env_path, override=False)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not found in backend/.env")
    return database_url


def main() -> int:
    args = parse_args()
    database_url = load_database_url()

    engine = create_engine(database_url, pool_pre_ping=True)
    violations_deleted = 0
    submissions_deleted = 0
    sessions_deleted = 0

    with engine.begin() as conn:
        user_row = conn.execute(
            text("SELECT id FROM users WHERE email = :email LIMIT 1"),
            {"email": args.email},
        ).first()

        if user_row is None:
            print(f"User not found for email: {args.email}", file=sys.stderr)
            return 1

        user_id = user_row[0]

        params: dict[str, object] = {"user_id": user_id}
        where_clause = "user_id = :user_id"

        if args.skill:
            skill_row = conn.execute(
                text("SELECT id FROM skills WHERE lower(name) = lower(:skill) LIMIT 1"),
                {"skill": args.skill},
            ).first()
            if skill_row is None:
                print(f"Skill not found: {args.skill}", file=sys.stderr)
                return 1

            params["skill_id"] = skill_row[0]
            where_clause += " AND skill_id = :skill_id"

        session_rows = conn.execute(
            text(f"SELECT id FROM assessment_sessions WHERE {where_clause}"),
            params,
        ).all()

        session_ids = [row[0] for row in session_rows]

        for session_id in session_ids:
            violations_result = conn.execute(
                text("DELETE FROM session_violations WHERE session_id = :session_id"),
                {"session_id": session_id},
            )
            violations_deleted += int(violations_result.rowcount or 0)

            submissions_result = conn.execute(
                text("DELETE FROM submissions WHERE session_id = :session_id"),
                {"session_id": session_id},
            )
            submissions_deleted += int(submissions_result.rowcount or 0)

            sessions_result = conn.execute(
                text("DELETE FROM assessment_sessions WHERE id = :session_id"),
                {"session_id": session_id},
            )
            sessions_deleted += int(sessions_result.rowcount or 0)

    suffix = f" [skill: {args.skill}]" if args.skill else ""
    print(
        "Reset complete: "
        f"deleted {violations_deleted} violation(s), "
        f"{submissions_deleted} submission(s), "
        f"{sessions_deleted} session(s) for {args.email}{suffix}"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
