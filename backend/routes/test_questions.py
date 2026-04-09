from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
import json
import random
from models import User, utcnow, CandidateQuestion
from dependencies import get_current_user
import os
from typing import Optional

router = APIRouter(prefix="/api/test/questions", tags=["Test"])

all_problems_cache = []


def _extract_flat_problems(payload: object) -> list[dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if not isinstance(payload, dict):
        return []

    skills = payload.get("skills")
    if not isinstance(skills, list):
        return []

    flat: list[dict] = []
    for skill_entry in skills:
        if not isinstance(skill_entry, dict):
            continue

        skill_name = skill_entry.get("skill") or skill_entry.get("name") or skill_entry.get("skill_name")
        levels = skill_entry.get("levels")
        if not isinstance(levels, dict):
            continue

        for _, level_payload in levels.items():
            if not isinstance(level_payload, dict):
                continue

            for bucket_name, bucket_payload in level_payload.items():
                questions = []
                if isinstance(bucket_payload, list):
                    questions = [item for item in bucket_payload if isinstance(item, dict)]
                elif isinstance(bucket_payload, dict):
                    nested = bucket_payload.get("questions")
                    if isinstance(nested, list):
                        questions = [item for item in nested if isinstance(item, dict)]

                for question in questions:
                    normalized = dict(question)
                    if skill_name and not normalized.get("skill"):
                        normalized["skill"] = skill_name
                    if not normalized.get("difficulty"):
                        normalized["difficulty"] = bucket_name
                    if not normalized.get("description") and normalized.get("content"):
                        normalized["description"] = normalized.get("content")
                    if not normalized.get("tag") and skill_name:
                        normalized["tag"] = skill_name
                    flat.append(normalized)

    return flat

def load_problems():
    global all_problems_cache
    if not all_problems_cache:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts"))
        dataset_candidates = [
            os.path.join(base_dir, "problem_dataset.json"),
            os.path.join(base_dir, "problems.json"),
        ]

        for path in dataset_candidates:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    payload = json.load(f)
                    all_problems_cache = _extract_flat_problems(payload)
                break

@router.get("/")
def get_questions(skill: Optional[str] = Query(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    load_problems()
    
    query = db.query(CandidateQuestion).filter(CandidateQuestion.candidate_id == current_user.id)
    if skill:
        query = query.filter(CandidateQuestion.selected_skill == skill)
    else:
        query = query.filter(CandidateQuestion.selected_skill.is_(None))
        
    record = query.first()
    
    if record:
        q1 = next((p for p in all_problems_cache if str(p.get("id")) == record.question1_id), None)
        q2 = next((p for p in all_problems_cache if str(p.get("id")) == record.question2_id), None)
        res = {"question1": q1, "question2": q2}
        if skill:
            res["skill"] = skill
        return res

    available_problems = all_problems_cache
    if skill:
        # Match against 'skill' or 'tag' field based on prompt hint
        available_problems = [
            p for p in available_problems
            if str(p.get("skill", "")).lower() == skill.lower() or 
               str(p.get("tag", "")).lower() == skill.lower()
        ]

    diff_map = {"easy": [], "medium": [], "hard": []}
    for p in available_problems:
        d = p.get("difficulty", "").lower()
        if d in diff_map:
            diff_map[d].append(p)
            
    diffs = [d for d in ["medium", "hard", "easy"] if diff_map[d]]
    
    if len(diffs) >= 2:
        d1, d2 = diffs[0], diffs[1] # Prefer medium and hard, or medium/easy, or hard/easy
    elif len(diffs) == 1:
        d1 = d2 = diffs[0]
    else:
        raise HTTPException(status_code=404, detail="No problems available for this configuration")

    q1 = random.choice(diff_map[d1])
    q2 = random.choice(diff_map[d2])

    if q1 == q2 and len(diff_map[d1]) > 1:
        while q2 == q1:
            q2 = random.choice(diff_map[d2])

    new_record = CandidateQuestion(
        candidate_id=current_user.id,
        selected_skill=skill,
        question1_id=str(q1.get("id")),
        question2_id=str(q2.get("id"))
    )
    db.add(new_record)
    db.commit()

    res = {"question1": q1, "question2": q2}
    if skill:
        res["skill"] = skill
    return res
