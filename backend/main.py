"""FastAPI backend for the Coding Assessment Platform."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routes.candidates import router as candidates_router
from routes.questions import router as questions_router
from routes.submissions import router as submissions_router

app = FastAPI(
    title="Coding Assessment Platform API",
    description="Backend API for the coding assessment platform",
    version="1.0.0",
)

# CORS — allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


app.include_router(candidates_router)
app.include_router(questions_router)
app.include_router(submissions_router)


# ---- Mangum handler for AWS Lambda ----
handler = Mangum(app, lifespan="off")
