import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, Enum):
    CANDIDATE = "candidate"
    ADMIN = "admin"


class Level(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE_1 = "intermediate_1"
    INTERMEDIATE_2 = "intermediate_2"
    SPECIALIST_1 = "specialist_1"
    SPECIALIST_2 = "specialist_2"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    SUBMITTED = "submitted"
    TIMED_OUT = "timed_out"
    AUTO_SUBMITTED = "auto_submitted"


class SubmissionStatus(str, Enum):
    CLEARED = "cleared"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    AUTO_SUBMITTED = "auto_submitted"


class AiFeedbackStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    DONE = "done"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_role", "role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole, native_enum=False), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    skill_progress: Mapped[list["UserSkillProgress"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sessions: Mapped[list["AssessmentSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    badges: Mapped[list["UserBadge"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserBadge.user_id",
    )


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    problems: Mapped[list["Problem"]] = relationship(back_populates="skill", cascade="all, delete-orphan")
    progress_records: Mapped[list["UserSkillProgress"]] = relationship(back_populates="skill", cascade="all, delete-orphan")
    sessions: Mapped[list["AssessmentSession"]] = relationship(back_populates="skill")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="skill")


class Problem(Base):
    __tablename__ = "problems"
    __table_args__ = (Index("ix_problems_skill_level", "skill_id", "level"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    skill_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    level: Mapped[Level] = mapped_column(SqlEnum(Level, native_enum=False), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    sample_test_cases: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    hidden_test_cases: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=45)
    difficulty_label: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    skill: Mapped[Skill] = relationship(back_populates="problems")
    sessions: Mapped[list["AssessmentSession"]] = relationship(back_populates="problem")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="problem")


class UserSkillProgress(Base):
    __tablename__ = "user_skill_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", "level", name="uq_usp_user_skill_level"),
        Index("ix_usp_user_skill", "user_id", "skill_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    level: Mapped[Level] = mapped_column(SqlEnum(Level, native_enum=False), nullable=False)
    cleared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unlocked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="skill_progress")
    skill: Mapped[Skill] = relationship(back_populates="progress_records")


class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"
    __table_args__ = (
        Index("ix_sessions_user_skill_level", "user_id", "skill_id", "level"),
        Index("ix_sessions_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    problem_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("problems.id"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("skills.id"), nullable=False)
    level: Mapped[Level] = mapped_column(SqlEnum(Level, native_enum=False), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(SqlEnum(SessionStatus, native_enum=False), nullable=False, default=SessionStatus.ACTIVE)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    last_draft_code: Mapped[str | None] = mapped_column(Text)
    last_draft_lang: Mapped[str | None] = mapped_column(String(50))
    draft_saved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="sessions")
    problem: Mapped[Problem] = relationship(back_populates="sessions")
    skill: Mapped[Skill] = relationship(back_populates="sessions")
    submission: Mapped["Submission | None"] = relationship(back_populates="session", uselist=False)

class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        Index("ix_submissions_user", "user_id"),
        Index("ix_submissions_skill", "skill_id", "level"),
        Index("ix_submissions_session", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("assessment_sessions.id"), nullable=False, unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    problem_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("problems.id"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("skills.id"), nullable=False)
    level: Mapped[Level] = mapped_column(SqlEnum(Level, native_enum=False), nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[SubmissionStatus] = mapped_column(SqlEnum(SubmissionStatus, native_enum=False), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    passed_tests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    time_taken_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    judge_result: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    ai_feedback: Mapped[str | None] = mapped_column(Text)
    ai_feedback_status: Mapped[AiFeedbackStatus] = mapped_column(
        SqlEnum(AiFeedbackStatus, native_enum=False),
        nullable=False,
        default=AiFeedbackStatus.PENDING,
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    session: Mapped[AssessmentSession] = relationship(back_populates="submission")
    user: Mapped[User] = relationship(back_populates="submissions")
    problem: Mapped[Problem] = relationship(back_populates="submissions")
    skill: Mapped[Skill] = relationship(back_populates="submissions")


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    criteria: Mapped[str] = mapped_column(Text, nullable=False)
    icon_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    user_badges: Mapped[list["UserBadge"]] = relationship(back_populates="badge", cascade="all, delete-orphan")


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_badges_user_badge"),
        Index("ix_user_badges_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    badge_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    awarded_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))

    user: Mapped[User] = relationship(back_populates="badges", foreign_keys=[user_id])
    badge: Mapped[Badge] = relationship(back_populates="user_badges")
