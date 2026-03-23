import os
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_jwt_secret() -> str:
    return os.getenv("JWT_SECRET_KEY", "dev-only-insecure-secret")


def get_jwt_expire_hours() -> int:
    try:
        return int(os.getenv("JWT_EXPIRE_HOURS", "8"))
    except ValueError:
        return 8


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


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
