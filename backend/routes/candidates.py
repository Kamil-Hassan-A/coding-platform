from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Candidate
from schemas import CandidateResponse

router = APIRouter()


@router.get("/candidates/{candidate_id}", response_model=CandidateResponse)
def get_candidate(candidate_id: str, db: Session = Depends(get_db)) -> CandidateResponse:
    candidate = db.scalar(select(Candidate).where(Candidate.candidate_id == candidate_id))
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )
    return CandidateResponse.model_validate(candidate)
