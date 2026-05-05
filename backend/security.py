import os
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.getenv("JWT_SECRET_KEY", "dev-only-insecure-secret")


def get_jwt_expire_hours() -> int:
    try:
        return int(os.getenv("JWT_EXPIRE_HOURS", "8"))
    except ValueError:
        return 8


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    string_password = hashed_password.decode("utf-8")
    return string_password

def verify_password(plain_password: str, password_hash: str) -> bool:
    password_byte_enc = plain_password.encode("utf-8")
    password_hash = password_hash.encode("utf-8")
    return bcrypt.checkpw(password=password_byte_enc, hashed_password=password_hash)


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> tuple[str, datetime]:
    expire_at = datetime.now(timezone.utc) + timedelta(hours=get_jwt_expire_hours())
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire_at,
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, get_jwt_secret(), algorithm=ALGORITHM)
    return token, expire_at


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
