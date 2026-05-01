from datetime import datetime
from typing import Literal
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


class CandidateBadgeResponse(BaseModel):
    badge_id: UUID
    name: str
    description: str | None
    icon_url: str | None
    criteria: str
    awarded_at: datetime


class SessionStartRequest(BaseModel):
    skill_id: UUID
    level: Level


class ProblemTestCase(BaseModel):
    input: str
    output: str


class SqlTableColumn(BaseModel):
    name: str
    type: str


class SqlTableSchema(BaseModel):
    table: str
    columns: list[SqlTableColumn]


class SessionProblemPayload(BaseModel):
    problem_id: UUID
    title: str
    description: str
    templateCode: str | None = None
    starter_code: dict[str, Any] | None = None
    tags: list[str] = Field(default_factory=list)
    sample_test_cases: list[ProblemTestCase]
    time_limit_minutes: int
    schema_tables: list[SqlTableSchema] = Field(default_factory=list)
    question_type: str | None = None
    type_data: dict[str, Any] | None = None


class SessionStartResponse(BaseModel):
    session_id: UUID
    problem_id: UUID
    expires_at: datetime
    attempt_number: int
    attempts_remaining: int
    problem: SessionProblemPayload
    problems: list[SessionProblemPayload] = Field(default_factory=list)
    allowed_languages: list[LanguageResponse] = Field(default_factory=list)


class SessionDetailResponse(BaseModel):
    session_id: UUID
    status: SessionStatus
    expires_at: datetime
    seconds_remaining: int
    problem: SessionProblemPayload
    problems: list[SessionProblemPayload] = Field(default_factory=list)
    allowed_languages: list[LanguageResponse] = Field(default_factory=list)
    last_draft_code: str | None
    last_draft_lang: str | None


class SessionDraftRequest(BaseModel):
    code: str
    language: str = Field(min_length=1)


class SessionDraftResponse(BaseModel):
    saved_at: datetime


class ViolationCreate(BaseModel):
    type: str
    timestamp: datetime
    metadata: dict[str, Any] | None = None


class SessionQuestionAnswer(BaseModel):
    problem_id: UUID
    code: str
    language: str = Field(min_length=1)


class SessionSubmitRequest(BaseModel):
    code: str
    language: str = Field(min_length=1)
    metadata: dict[str, Any] | None = None
    answers: list[SessionQuestionAnswer] = Field(default_factory=list)


class SessionRunRequest(BaseModel):
    code: str
    language: str = Field(min_length=1)
    problem_id: UUID | None = None


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
    sql_run: bool = False
    stdout: str | None = None
    expected_output: str | None = None


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
    latest_session_id: UUID | None = None
    latest_skill_name: str | None = None
    latest_submitted_at: datetime | None = None
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


class ViolationDetail(BaseModel):
    type: str
    timestamp: datetime
    metadata: dict[str, Any] | None = None


class TestCaseDetail(BaseModel):
    stdin: str
    expected_output: str | None
    stdout: str | None
    stderr: str | None
    passed: bool


class SubmissionDetail(BaseModel):
    submission_id: UUID
    skill_name: str
    level: str
    language: str
    code: str
    score: int
    passed_tests: int
    total_tests: int
    status: str
    submitted_at: datetime
    time_taken_seconds: int
    cases: list[TestCaseDetail]


class SessionReportDetail(BaseModel):
    session_id: UUID
    skill_name: str
    level: str
    started_at: datetime
    submitted_at: datetime | None
    status: str
    attempt_number: int
    violations: list[ViolationDetail]
    violation_summary: dict[str, int]
    submission: SubmissionDetail | None


class CandidateFullReport(BaseModel):
    user_id: UUID
    name: str
    email: str
    employee_id: str
    department: str
    gender: str
    exp_indium_years: int
    exp_overall_years: int
    generated_at: datetime
    sessions: list[SessionReportDetail]


class CandidateSessionReport(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    name: str
    email: str
    employee_id: str
    department: str
    gender: str
    exp_indium_years: int
    exp_overall_years: int
    generated_at: datetime
    session: SessionReportDetail


class CandidateSessionListItem(BaseModel):
    session_id: UUID
    skill: str
    score: int | None
    status: str
    submitted_at: datetime | None


class ReportsZipExportRequest(BaseModel):
    user_ids: list[UUID]
    mode: Literal["latest", "full"]
