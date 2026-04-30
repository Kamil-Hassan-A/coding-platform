"""Database configuration and session management."""

import json
import os
from collections.abc import Generator
from functools import lru_cache
from pathlib import Path

import boto3
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from models import Base

# Load local backend/.env if present so local uvicorn/scripts get DB settings.
load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=False)


def get_db_credentials() -> dict:
    """Retrieve database credentials from Secrets Manager."""
    secret_arn = os.environ.get("DB_SECRET_ARN")
    if not secret_arn:
        return {}

    client = boto3.client("secretsmanager")
    response = client.get_secret_value(SecretId=secret_arn)
    return json.loads(response["SecretString"])


def build_database_url() -> str:
    direct_url = os.environ.get("DATABASE_URL")
    if direct_url:
        return direct_url

    db_host = os.environ.get("DB_HOST")
    db_port = os.environ.get("DB_PORT", "5432")
    db_name = os.environ.get("DB_NAME", "codingplatform")
    db_user = os.environ.get("DB_USER")
    db_password = os.environ.get("DB_PASSWORD")

    if not (db_user and db_password):
        creds = get_db_credentials()
        db_user = db_user or creds.get("username")
        db_password = db_password or creds.get("password")

    if not (db_host and db_user and db_password):
        raise RuntimeError(
            "Database connection details are not configured. Set DATABASE_URL or DB_HOST/DB credentials."
        )

    return f"postgresql+psycopg2://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


@lru_cache
def get_session_local() -> sessionmaker[Session]:
    database_url = build_database_url()
    engine = create_engine(database_url, pool_pre_ping=True)

    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()