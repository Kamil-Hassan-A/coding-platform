"""FastAPI backend for the Coding Assessment Platform."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.sessions import router as sessions_router
from routes.skills import router as skills_router
from routes.submissions import router as submissions_router

app = FastAPI(
    title="Coding Assessment Platform API",
    description="Backend API for the coding assessment platform",
    version="1.0.0",
)

# CORS — allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


# ---- Mangum handler for AWS Lambda ----
handler = Mangum(app, lifespan="off")
