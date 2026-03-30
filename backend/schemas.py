from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from models import Level, SessionStatus, SubmissionStatus, UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginUser(BaseModel):
    user_id: UUID
    role: UserRole
    name: str
    email: EmailStr
    employee_id: str 
    gender: str
    department: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: LoginUser


class LanguageResponse(BaseModel):
    id: int
    name: str
    monaco: str


class SkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    skill_id: UUID
    name: str
    description: str | None
    icon_url: str | None
    allowed_languages: list[LanguageResponse]


class LevelProgressItem(BaseModel):
    level: Level
    label: str
    unlocked: bool
    cleared: bool
    attempts_used: int
    attempts_remaining: int


class SkillProgressResponse(BaseModel):
    skill_id: UUID
    skill_name: str
    levels: list[LevelProgressItem]


class SessionStartRequest(BaseModel):
    skill_id: UUID
    level: Level


class SessionProblemPayload(BaseModel):
    title: str
    description: str
    sample_test_cases: list[Any]
    time_limit_minutes: int


class SessionStartResponse(BaseModel):
    session_id: UUID
    problem_id: UUID
    expires_at: datetime
    attempt_number: int
    attempts_remaining: int
    allowed_languages: list[LanguageResponse]
    problem: SessionProblemPayload


class SessionDetailResponse(BaseModel):
    session_id: UUID
    status: SessionStatus
    expires_at: datetime
    seconds_remaining: int
    allowed_languages: list[LanguageResponse]
    problem: SessionProblemPayload
    last_draft_code: str | None
    last_draft_lang: str | None


class SessionDraftRequest(BaseModel):
    code: str
    language: str = Field(min_length=1)


class SessionDraftResponse(BaseModel):
    saved_at: datetime


class SessionRunRequest(BaseModel):
    code: str
    language: str = Field(min_length=1)


class SessionSubmitRequest(BaseModel):
    code: str
    language: str = Field(min_length=1)


class TestCaseResult(BaseModel):
    token: str | None = None
    stdin: str
    expected_output: str | None = None
    stdout: str | None = None
    stderr: str | None = None
    compile_output: str | None = None
    message: str | None = None
    status: dict[str, Any]
    time: str | None = None
    memory: int | None = None
    passed: bool


class SessionSubmitResponse(BaseModel):
    submission_id: UUID
    session_id: UUID
    status: SubmissionStatus
    score: int
    passed_tests: int
    total_tests: int
    time_taken_seconds: int
    cases: list[TestCaseResult]


class SessionRunResponse(BaseModel):
    cases: list[TestCaseResult]
    time_taken_ms: int


class SubmissionResultsResponse(BaseModel):
    submission_id: UUID
    status: SubmissionStatus
    score: int
    passed_tests: int
    total_tests: int
    time_taken_seconds: int
    attempts_used: int
    attempts_remaining: int
    next_level_unlocked: bool
    cases: list[TestCaseResult]


class AdminStatsResponse(BaseModel):
    totalEmployees: int
    totalAssessments: int
    inProgress: int
    completed: int
    terminated: int
    pendingReview: int


class AdminCandidateRow(BaseModel):
    user_id: UUID
    name: str
    gender: str
    dept: str
    skill: str
    score: int
    status: str


class AdminCandidatesResponse(BaseModel):
    candidates: list[AdminCandidateRow]


class AdminCredentialRow(BaseModel):
    id: UUID
    employeeId: str
    name: str
    department: str
    expIndium: int
    expOverall: int
    verifiedSkills: list[str]
    status: str


class AdminCredentialsResponse(BaseModel):
    credentials: list[AdminCredentialRow]
