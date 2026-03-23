from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Question
from schemas import QuestionResponse

router = APIRouter()


@router.get("/questions/{question_id}", response_model=QuestionResponse)
def get_question(question_id: str, db: Session = Depends(get_db)) -> QuestionResponse:
    question = db.scalar(select(Question).where(Question.question_id == question_id))
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    return QuestionResponse.model_validate(question)
