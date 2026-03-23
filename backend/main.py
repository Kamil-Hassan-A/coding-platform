"""FastAPI backend for the Coding Assessment Platform."""

import requests
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from judge0_service import Judge0Service
from models import Candidate, Question, Submission
from schemas import CandidateResponse, QuestionResponse, SubmitRequest, SubmitResponse

app = FastAPI(
    title="Coding Assessment Platform API",
    description="Backend API for the coding assessment platform",
    version="1.0.0",
)

judge0_service = Judge0Service()

# CORS — allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Coding Assessment Platform API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/candidates/{candidate_id}", response_model=CandidateResponse)
def get_candidate(candidate_id: str, db: Session = Depends(get_db)) -> CandidateResponse:
    candidate = db.scalar(select(Candidate).where(Candidate.candidate_id == candidate_id))
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )
    return CandidateResponse.model_validate(candidate)


@app.get("/questions/{question_id}", response_model=QuestionResponse)
def get_question(question_id: str, db: Session = Depends(get_db)) -> QuestionResponse:
    question = db.scalar(select(Question).where(Question.question_id == question_id))
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    return QuestionResponse.model_validate(question)


@app.post("/submit", response_model=SubmitResponse, status_code=status.HTTP_201_CREATED)
def submit_solution(payload: SubmitRequest, db: Session = Depends(get_db)) -> SubmitResponse:
    candidate = db.scalar(select(Candidate).where(Candidate.candidate_id == payload.candidate_id))
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )

    question = db.scalar(select(Question).where(Question.question_id == payload.question_id))
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    test_inputs = question.sample_test_cases or []
    try:
        execution_result = judge0_service.execute(
            code=payload.code,
            language=payload.language,
            test_inputs=test_inputs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except (requests.RequestException, TimeoutError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Judge0 execution failed: {exc}",
        ) from exc

    submission = Submission(
        candidate_id=candidate.id,
        question_id=question.id,
        code=payload.code,
        language=payload.language,
        result=execution_result,
        score=execution_result.get("score", 0),
        time_taken=execution_result.get("time_taken", 0),
    )

    try:
        db.add(submission)
        db.commit()
        db.refresh(submission)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist submission",
        ) from exc

    return SubmitResponse(
        submission_id=str(submission.id),
        candidate_id=candidate.candidate_id,
        question_id=question.question_id,
        language=submission.language,
        score=submission.score,
        time_taken=submission.time_taken,
        submitted_at=submission.submitted_at,
        result=execution_result,
    )


# ---- Mangum handler for AWS Lambda ----
handler = Mangum(app, lifespan="off")
