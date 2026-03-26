from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import LoginRequest, LoginResponse, LoginUser
from security import create_access_token, get_jwt_expire_hours, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token, _ = create_access_token(
        subject=str(user.id),
        extra_claims={
            "role": user.role.value,
            "name": user.name,
            "email": user.email,
        },
    )
    expires_in = get_jwt_expire_hours() * 3600

    return LoginResponse(
        access_token=token,
        expires_in=expires_in,
        user=LoginUser(
            user_id=user.id,
            role=user.role,
            name=user.name,
            email=user.email,
            employee_id=user.employee_id,
            gender=user.gender,
            department=user.department,
        ),
    )
