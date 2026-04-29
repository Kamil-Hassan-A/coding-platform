"""FastAPI backend for the Coding Assessment Platform."""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.sessions import router as sessions_router
from routes.skills import router as skills_router
from routes.submissions import router as submissions_router
from routes.system import router as system_router

logging.basicConfig(level=logging.INFO)


def _get_allowed_origins() -> list[str]:
    """Return safe default origins and optional env-provided production origins."""
    default_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://your-production-domain.com",
    ]

    env_value = os.getenv("CORS_ALLOWED_ORIGINS", "")
    extra_origins = [origin.strip() for origin in env_value.split(",") if origin.strip()]

    # Keep order stable while removing duplicates.
    return list(dict.fromkeys(default_origins + extra_origins))

app = FastAPI(
    title="Coding Assessment Platform API",
    description="Backend API for the coding assessment platform",
    version="1.0.0",
)

# CORS — allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Coding Assessment Platform API is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy"}


app.include_router(auth_router)
app.include_router(skills_router)
app.include_router(sessions_router)
app.include_router(submissions_router)
app.include_router(admin_router)
app.include_router(system_router)


# ---- Mangum handler for AWS Lambda ----
handler = Mangum(app, lifespan="off")

from routes import test_questions
app.include_router(test_questions.router)
