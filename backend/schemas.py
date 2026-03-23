from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    candidate_id: str
    name: str
    email: EmailStr
    assigned_questions: list[str]


class QuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    question_id: str
    title: str
    description: str
    sample_test_cases: list[Any]
    difficulty: str


class SubmitRequest(BaseModel):
    candidate_id: str = Field(min_length=1)
    question_id: str = Field(min_length=1)
    code: str = Field(min_length=1)
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


class JudgeResultResponse(BaseModel):
    passed: bool
    passed_tests: int
    total_tests: int
    score: int
    time_taken: int
    cases: list[TestCaseResult]


class SubmitResponse(BaseModel):
    submission_id: str
    candidate_id: str
    question_id: str
    language: str
    score: int
    time_taken: int
    submitted_at: datetime
    result: JudgeResultResponse
