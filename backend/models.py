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
        Index("ix_users_employee_id", "employee_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole, native_enum=False), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(50), unique=True)
    gender: Mapped[str] = mapped_column(String(20))
    department: Mapped[str] = mapped_column(String(100))
    exp_indium_years: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    exp_overall_years: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    skill_progress: Mapped[list["UserSkillProgress"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sessions: Mapped[list["AssessmentSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    violations: Mapped[list["SessionViolation"]] = relationship(back_populates="user", cascade="all, delete-orphan")
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
    allowed_languages: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    problems: Mapped[list["Problem"]] = relationship(back_populates="skill", cascade="all, delete-orphan")
    progress_records: Mapped[list["UserSkillProgress"]] = relationship(back_populates="skill", cascade="all, delete-orphan")
    sessions: Mapped[list["AssessmentSession"]] = relationship(back_populates="skill")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="skill")


class Problem(Base):
    __tablename__ = "problems"
    __table_args__ = (
        Index("ix_problems_skill_level", "skill_id", "level"),
        Index("ix_problems_external_task", "external_task_id"),
        Index("ix_problems_source_dataset", "source_dataset"),
        Index("ix_problems_source_name", "source_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    skill_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    level: Mapped[Level] = mapped_column(SqlEnum(Level, native_enum=False), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    sample_test_cases: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    hidden_test_cases: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=45)
    tags: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    starter_code: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    difficulty_label: Mapped[str | None] = mapped_column(String(50))
    external_task_id: Mapped[str | None] = mapped_column(String(255))
    source_name: Mapped[str | None] = mapped_column(String(100))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    source_dataset: Mapped[str | None] = mapped_column(String(100))
    solution_text: Mapped[str | None] = mapped_column(Text)
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
    submissions: Mapped[list["Submission"]] = relationship(back_populates="session")
    violations: Mapped[list["SessionViolation"]] = relationship(back_populates="session", cascade="all, delete-orphan")

class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        Index("ix_submissions_user", "user_id"),
        Index("ix_submissions_skill", "skill_id", "level"),
        Index("ix_submissions_session", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("assessment_sessions.id"), nullable=False)
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

    session: Mapped[AssessmentSession] = relationship(back_populates="submissions")
    user: Mapped[User] = relationship(back_populates="submissions")
    problem: Mapped[Problem] = relationship(back_populates="submissions")
    skill: Mapped[Skill] = relationship(back_populates="submissions")


class SessionViolation(Base):
    __tablename__ = "session_violations"
    __table_args__ = (
        Index("ix_session_violations_session_id", "session_id"),
        Index("ix_session_violations_user_id", "user_id"),
        Index("ix_session_violations_type", "type"),
        Index("idx_session_type_time", "session_id", "type", "timestamp"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("assessment_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON)

    session: Mapped[AssessmentSession] = relationship(back_populates="violations")
    user: Mapped[User] = relationship(back_populates="violations")


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

class CandidateQuestion(Base):
    __tablename__ = 'candidate_questions'

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    selected_skill: Mapped[str | None] = mapped_column(String(255), nullable=True)
    question1_id: Mapped[str] = mapped_column(String(255), nullable=False)
    question2_id: Mapped[str] = mapped_column(String(255), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

