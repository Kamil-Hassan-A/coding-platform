# Internal Assessment Platform — Backend PRD
## Version 1.0 | March 2026 | Confidential

---

## 1. Overview

This document defines the complete backend specification for the Internal Assessment Platform — a self-hosted coding assessment system for evaluating employees through AI-generated challenges, automated Judge0 CE scoring, and AI-powered feedback.

The backend is a FastAPI application deployed on AWS Lambda via Mangum, exposed through API Gateway HTTP API, backed by Amazon RDS PostgreSQL, and integrated with a self-hosted Judge0 CE instance on EC2.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Python 3.11+ |
| **Framework** | FastAPI |
| **Lambda Adapter** | Mangum |
| **Deployment** | AWS Lambda (x86_64) |
| **API Gateway** | Amazon API Gateway HTTP API |
| **Database** | Amazon RDS PostgreSQL (db.t4g.micro) |
| **ORM** | SQLAlchemy 2.x (async) + Alembic |
| **Code Execution** | Judge0 CE self-hosted on EC2 (t3.small) |
| **Auth** | JWT (python-jose) + bcrypt password hashing |
| **AI Feedback** | API (async, post-submission) |
| **Networking** | Amazon VPC — Lambda and RDS in private subnets; Judge0 EC2 in private subnet |
| **Secrets** | AWS Secrets Manager |
| **Logging** | AWS CloudWatch |

---

## 3. Architecture & Runtime Flow

```
Client (React Frontend)
        │
        ▼
API Gateway HTTP API
        │
        ▼
AWS Lambda (FastAPI + Mangum)
        │
        ├─── RDS PostgreSQL (read/write all domain data)
        │
        ├─── Judge0 CE on EC2 (code execution — /submit only)
        │
        └─── AI feedback — async post-submission
```

**Request lifecycle:**

1. Client sends HTTP request to API Gateway.
2. API Gateway invokes Lambda with the proxied event.
3. Mangum translates the Lambda event into an ASGI request for FastAPI.
4. FastAPI middleware validates JWT and extracts user identity + role.
5. Route handler reads/writes PostgreSQL via SQLAlchemy async session.
6. For `/submit`: Lambda calls Judge0 CE synchronously, stores result, then triggers async AI feedback generation.
7. AI feedback is stored in the `submissions` table and served to admin via SSE on demand.
8. Response is returned to client through API Gateway.

---

## 4. Database Schema

### 4.1 Design Decisions

- Levels are a hardcoded Python enum (`beginner`, `intermediate_1`, `intermediate_2`, `specialist_1`, `specialist_2`). No levels table needed.
- Multiple problems exist per skill+level combination. One is randomly selected when a session starts.
- All tables use UUID primary keys.
- Soft deletes are not used — hard deletes with CASCADE where applicable.
- `submitted_at` and `created_at` fields always use UTC.

---

### 4.2 Table: `users`

Stores both candidates and admins. Role field gates all access.

```sql
CREATE TABLE users (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                       VARCHAR(255) NOT NULL UNIQUE,
    password_hash               VARCHAR(255) NOT NULL,
    role                        VARCHAR(20) NOT NULL CHECK (role IN ('candidate', 'admin')),
    name                        VARCHAR(255) NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_users_email ON users(email);
CREATE INDEX ix_users_role  ON users(role);
```

**Notes:**
- Password is always bcrypt-hashed. Plaintext is never stored.

---

### 4.3 Table: `skills`

Top-level skill categories (e.g., Python, SQL, Data Structures).

```sql
CREATE TABLE skills (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL UNIQUE,
    description   TEXT,
    icon_url      VARCHAR(500),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 4.4 Table: `problems`

Each problem belongs to a skill and a level. Multiple problems can exist per skill+level.

```sql
CREATE TABLE problems (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id            UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    level               VARCHAR(30) NOT NULL CHECK (
                            level IN (
                                'beginner',
                                'intermediate_1',
                                'intermediate_2',
                                'specialist_1',
                                'specialist_2'
                            )
                        ),
    title               VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,             -- markdown, rendered in editor
    sample_test_cases   JSONB NOT NULL DEFAULT '[]',  -- shown to candidate
    hidden_test_cases   JSONB NOT NULL DEFAULT '[]',  -- used for scoring, never exposed
    time_limit_minutes  INTEGER NOT NULL DEFAULT 45,
    difficulty_label    VARCHAR(50),               -- display label e.g. "Beginner"
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_problems_skill_level ON problems(skill_id, level);
```

**`sample_test_cases` and `hidden_test_cases` JSON shape (array of objects):**

```json
[
  {
    "stdin": "5\n1 2 3 4 5",
    "expected_output": "15",
    "explanation": "Sum of all elements"
  }
]
```

---

### 4.5 Table: `user_skill_progress`

Tracks which levels a candidate has cleared per skill, and controls level unlocking.

```sql
CREATE TABLE user_skill_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    level           VARCHAR(30) NOT NULL,
    cleared         BOOLEAN NOT NULL DEFAULT FALSE,
    unlocked        BOOLEAN NOT NULL DEFAULT FALSE,
    cleared_at      TIMESTAMPTZ,
    UNIQUE (user_id, skill_id, level)
);

CREATE INDEX ix_usp_user_skill ON user_skill_progress(user_id, skill_id);
```

**Notes:**
- On user creation, `beginner` level is seeded as `unlocked = true` for all skills.
- When a level is cleared (`cleared = true`), the next level is set to `unlocked = true` automatically by the backend.
- Level order: `beginner` → `intermediate_1` → `intermediate_2` → `specialist_1` → `specialist_2`.

---

### 4.6 Table: `assessment_sessions`

Tracks an active or completed test session. Created when a candidate starts a level.

```sql
CREATE TABLE assessment_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id      UUID NOT NULL REFERENCES problems(id),
    skill_id        UUID NOT NULL REFERENCES skills(id),
    level           VARCHAR(30) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'submitted', 'timed_out', 'auto_submitted')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,           -- started_at + time_limit_minutes
    submitted_at    TIMESTAMPTZ,
    attempt_number  INTEGER NOT NULL,               -- 1 through 5
    last_draft_code TEXT,                           -- latest autosaved code
    last_draft_lang VARCHAR(50),
    draft_saved_at  TIMESTAMPTZ
);

CREATE INDEX ix_sessions_user_skill_level ON assessment_sessions(user_id, skill_id, level);
CREATE INDEX ix_sessions_status ON assessment_sessions(status);
```

**Notes:**
- `attempt_number` is set to `(current attempt count for user+skill+level) + 1` at session creation.
- Maximum 5 sessions per user+skill+level. Session creation is rejected if count >= 5.
- A session counts as an attempt the moment it is created — regardless of submission or timeout.
- `expires_at` is authoritative for the timer. Frontend syncs with server on load.

---

### 4.7 Table: `submissions`

Stores the final submission and all scoring results for a session.

```sql
CREATE TABLE submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL UNIQUE REFERENCES assessment_sessions(id),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id          UUID NOT NULL REFERENCES problems(id),
    skill_id            UUID NOT NULL REFERENCES skills(id),
    level               VARCHAR(30) NOT NULL,
    code                TEXT NOT NULL,
    language            VARCHAR(50) NOT NULL,
    status              VARCHAR(20) NOT NULL
                            CHECK (status IN ('cleared', 'failed', 'timed_out', 'auto_submitted')),
    score               INTEGER NOT NULL DEFAULT 0,    -- 0 to 100
    passed_tests        INTEGER NOT NULL DEFAULT 0,
    total_tests         INTEGER NOT NULL DEFAULT 0,
    time_taken_seconds  INTEGER NOT NULL DEFAULT 0,    -- wall clock, session start to submit
    judge_result        JSONB NOT NULL DEFAULT '{}',   -- full Judge0 response per test case
    ai_feedback         TEXT,                          -- generated async, null until ready
    ai_feedback_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (ai_feedback_status IN ('pending', 'generating', 'done', 'failed')),
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_submissions_user    ON submissions(user_id);
CREATE INDEX ix_submissions_skill   ON submissions(skill_id, level);
CREATE INDEX ix_submissions_session ON submissions(session_id);
```

**`judge_result` JSON shape:**

```json
{
  "cases": [
    {
      "token": "abc123",
      "stdin": "5",
      "expected_output": "15",
      "stdout": "15",
      "stderr": null,
      "compile_output": null,
      "status": { "id": 3, "description": "Accepted" },
      "time": "0.012",
      "memory": 3200,
      "passed": true
    }
  ]
}
```

---

### 4.8 Table: `badges`

```sql
CREATE TABLE badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    criteria    TEXT NOT NULL,     -- human-readable criteria description
    icon_url    VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.9 Table: `user_badges`

```sql
CREATE TABLE user_badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    awarded_by  UUID REFERENCES users(id),   -- admin who assigned it (null if auto)
    UNIQUE (user_id, badge_id)
);

CREATE INDEX ix_user_badges_user ON user_badges(user_id);
```

---

### 4.10 Schema Summary

```
users
  └── user_skill_progress     (user_id, skill_id, level → cleared/unlocked)
  └── assessment_sessions     (user_id, problem_id, skill_id, level → session state)
        └── submissions       (session_id → score, judge_result, ai_feedback)
  └── user_badges             (user_id, badge_id)

skills
  └── problems                (skill_id, level → problem content + test cases)

badges
  └── user_badges
```

---

## 5. Authentication & Authorization

### 5.1 Login

**`POST /auth/login`**

- Accepts `email` + `password`.
- Verifies password against `bcrypt` hash.
- Returns a signed JWT containing `user_id`, `role`, `name`, `email`.
- Token expiry: 8 hours.
- No refresh token in v1.

**JWT payload:**

```json
{
  "sub": "<user_id>",
  "role": "candidate",
  "name": "Jane Doe",
  "email": "jane@company.com",
  "exp": 1712345678
}
```

### 5.2 Route Protection

All routes except `/health` and `/auth/login` require a valid JWT in the `Authorization: Bearer <token>` header.

FastAPI dependency `get_current_user` extracts and validates the token on every request.

Role enforcement:

- Routes under `/admin/*` require `role = admin`. Candidates hitting admin routes receive `403 Forbidden`.
- Routes under `/candidate/*` (or unscoped candidate routes) require `role = candidate`. Admins hitting candidate routes receive `403 Forbidden`.

---

## 6. API Endpoints

### 6.1 Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | None | Email + password → JWT |

---

### 6.2 Candidate — Skills & Progress

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/skills` | Candidate | List all skills |
| `GET` | `/user/progress` | Candidate | Skill+level unlock/cleared state for current user |
| `GET` | `/skills/{skill_id}/levels` | Candidate | Level details for a skill — attempts used, unlocked state |

**`GET /skills` response:**

```json
[
  {
    "skill_id": "uuid",
    "name": "Python",
    "description": "...",
    "icon_url": "..."
  }
]
```

**`GET /user/progress` response:**

```json
[
  {
    "skill_id": "uuid",
    "skill_name": "Python",
    "levels": [
      {
        "level": "beginner",
        "label": "Beginner",
        "unlocked": true,
        "cleared": true,
        "attempts_used": 2,
        "attempts_remaining": 3
      },
      {
        "level": "intermediate_1",
        "label": "Intermediate 1",
        "unlocked": true,
        "cleared": false,
        "attempts_used": 1,
        "attempts_remaining": 4
      }
    ]
  }
]
```

---

### 6.3 Candidate — Assessment Sessions

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/sessions/start` | Candidate | Start a new session — consumes 1 attempt |
| `GET` | `/sessions/{session_id}` | Candidate | Get session details including timer state |
| `POST` | `/sessions/{session_id}/draft` | Candidate | Autosave current code draft |
| `POST` | `/sessions/{session_id}/submit` | Candidate | Final code submission |

**`POST /sessions/start` request:**

```json
{
  "skill_id": "uuid",
  "level": "beginner"
}
```

**`POST /sessions/start` response:**

```json
{
  "session_id": "uuid",
  "problem_id": "uuid",
  "expires_at": "2026-03-23T15:00:00Z",
  "attempt_number": 2,
  "attempts_remaining": 3,
  "problem": {
    "title": "Two Sum",
    "description": "...",
    "sample_test_cases": [...],
    "time_limit_minutes": 45
  }
}
```

**Notes:**
- Returns `409 Conflict` if 5 attempts already used.
- Returns `403 Forbidden` if level is not unlocked.
- Randomly selects one problem from available problems for that skill+level.
- The problem selection is locked for the session — stored as `problem_id` on the session.

**`GET /sessions/{session_id}` response:**

```json
{
  "session_id": "uuid",
  "status": "active",
  "expires_at": "2026-03-23T15:00:00Z",
  "seconds_remaining": 1823,
  "problem": { ... },
  "last_draft_code": "def solution():\n    pass",
  "last_draft_lang": "python"
}
```

**`POST /sessions/{session_id}/draft` request:**

```json
{
  "code": "def solution():\n    pass",
  "language": "python"
}
```

Response: `200 OK` with `{ "saved_at": "2026-03-23T14:35:00Z" }`.

**`POST /sessions/{session_id}/submit` request:**

```json
{
  "code": "def solution(nums, target):\n    ...",
  "language": "python"
}
```

- Returns `409` if session is already submitted or timed out.
- Returns `403` if session does not belong to current user.
- Triggers Judge0 execution synchronously. Returns submission result.
- Triggers AI feedback generation **asynchronously** (does not block response).

---

### 6.4 Candidate — Submission Results

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/submissions/{submission_id}/results` | Candidate | Score + per-test-case result |
| `GET` | `/submissions/{submission_id}/feedback` | Admin only | SSE stream for AI feedback |

**`GET /submissions/{submission_id}/results` response:**

```json
{
  "submission_id": "uuid",
  "status": "cleared",
  "score": 85,
  "passed_tests": 17,
  "total_tests": 20,
  "time_taken_seconds": 1240,
  "attempts_used": 2,
  "attempts_remaining": 3,
  "next_level_unlocked": true,
  "cases": [
    {
      "stdin": "5",
      "expected_output": "15",
      "stdout": "15",
      "passed": true,
      "time_ms": 12,
      "memory_kb": 3200,
      "status": "Accepted"
    }
  ]
}
```

**Note:** AI feedback is NOT included here. Candidates never see AI feedback.

**`GET /submissions/{submission_id}/feedback` (Admin SSE):**

- Server-Sent Events endpoint.
- If `ai_feedback_status = done`: immediately streams the stored feedback text and closes.
- If `ai_feedback_status = generating`: streams progress tokens live as they are generated.
- If `ai_feedback_status = failed`: returns error event.
- If `ai_feedback_status = pending`: returns a waiting event and polls until generating starts.

```
event: token
data: "The candidate's solution uses..."

event: token
data: " a nested loop approach..."

event: done
data: ""
```

---

### 6.5 Candidate — History

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/user/attempts` | Candidate | All past sessions with result summary |

**Response:**

```json
[
  {
    "session_id": "uuid",
    "submission_id": "uuid",
    "skill_name": "Python",
    "level": "beginner",
    "status": "cleared",
    "score": 90,
    "submitted_at": "2026-03-20T10:00:00Z",
    "time_taken_seconds": 900,
    "cases": [...]
  }
]
```

---

### 6.6 Admin — Candidates

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/candidates` | Admin | Paginated, filterable candidate list |
| `GET` | `/admin/candidates/{user_id}` | Admin | Candidate profile + skill progress + attempt list |

**`GET /admin/candidates` query params:** `skill_id`, `level`, `department`, `status` (cleared/failed), `page`, `page_size`

**`GET /admin/candidates/{user_id}` response:**

```json
{
  "user_id": "uuid",
  "name": "Jane Doe",
  "email": "jane@company.com",
  "skill_progress": [...],
  "attempts": [
    {
      "session_id": "uuid",
      "submission_id": "uuid",
      "skill_name": "Python",
      "level": "beginner",
      "status": "cleared",
      "score": 90,
      "submitted_at": "2026-03-20T10:00:00Z"
    }
  ]
}
```

---

### 6.7 Admin — Attempt Report

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/candidates/{user_id}/report/{submission_id}` | Admin | Full attempt detail including AI feedback |

**Response:**

```json
{
  "submission_id": "uuid",
  "candidate": { "name": "...", "email": "...", "department": "..." },
  "skill_name": "Python",
  "level": "beginner",
  "started_at": "2026-03-20T09:45:00Z",
  "submitted_at": "2026-03-20T10:00:00Z",
  "time_taken_seconds": 900,
  "status": "cleared",
  "score": 90,
  "passed_tests": 18,
  "total_tests": 20,
  "code": "def solution():\n    ...",
  "language": "python",
  "cases": [...],
  "ai_feedback": "The solution is efficient...",
  "ai_feedback_status": "done"
}
```

---

### 6.8 Admin — Scores

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/scores` | Admin | All candidate scores filterable by skill/level/dept/date |

---

### 6.9 Admin — Leaderboard

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/leaderboard` | Admin | Ranked candidates by score per skill+level |

**Query params:** `skill_id`, `level`, `department`, `date_from`, `date_to`

---

### 6.10 Admin — Reports

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/reports` | Admin | List all generated reports |
| `POST` | `/admin/reports/generate` | Admin | Trigger report generation |
| `GET` | `/admin/reports/{report_id}/download` | Admin | Download report (Excel/CSV/PDF) |

**`POST /admin/reports/generate` request:**

```json
{
  "type": "excel",
  "skill_id": "uuid",
  "level": "beginner",
  "date_from": "2026-03-01",
  "date_to": "2026-03-31"
}
```

---

### 6.11 Admin — Badges

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/badges` | Admin | List all badges |
| `POST` | `/admin/badges` | Admin | Create a new badge |
| `POST` | `/admin/badges/{badge_id}/assign` | Admin | Assign badge to a candidate |
| `GET` | `/admin/badges/{badge_id}/candidates` | Admin | List candidates who earned this badge |

---

### 6.12 Utility

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Lambda + DB connectivity check |
| `GET` | `/` | None | Root — returns service name and version |

---

## 7. Judge0 Integration

### 7.1 Submission Flow

When `POST /sessions/{session_id}/submit` is called:

1. Fetch `hidden_test_cases` from the problem (never exposed to candidate).
2. For each test case, POST to Judge0 CE `/submissions?base64_encoded=false&wait=false` to create a token.
3. Batch-poll Judge0 `/submissions/batch?tokens=...` every 1.5 seconds until all tokens resolve (status ID not 1 or 2).
4. Evaluate each result — `passed = (stdout.strip() == expected_output.strip())`.
5. Compute `score = (passed_tests / total_tests) * 100`, rounded to integer.
6. Determine `status`: `cleared` if score >= 70, otherwise `failed`.
7. Persist `Submission` record with full `judge_result` JSON.
8. Update `assessment_sessions.status` to `submitted`.
9. If `cleared`: update `user_skill_progress` — set `cleared = true` for current level, set `unlocked = true` for next level.
10. Fire-and-forget: trigger async AI feedback generation.

### 7.2 Language ID Map

| Language | Judge0 Language ID |
|---|---|
| Python | 71 |
| JavaScript | 63 |
| TypeScript | 74 |
| Java | 62 |
| C++ | 54 |
| C | 50 |
| Go | 60 |
| Rust | 73 |

### 7.3 Timeout Handling

- If a session's `expires_at` has passed when submit is called: reject with `410 Gone`, mark session as `timed_out`, auto-submit last saved draft.
- A background Lambda (EventBridge scheduled rule, every 5 minutes) sweeps for `active` sessions past `expires_at` and auto-submits them with `last_draft_code`. If no draft exists, submits empty code — resulting in 0 score.

### 7.4 Failure Handling

- If Judge0 returns a network error or non-2xx: return `502 Bad Gateway` with `detail: "Judge0 execution failed"`.
- If any individual test case has `status.id = 6` (compilation error): `passed = false`, include `compile_output` in result.
- Judge0 call timeout: 30 seconds per batch poll cycle.

---

## 8. AI Feedback Pipeline

### 8.1 Trigger

AI feedback generation is triggered **asynchronously** immediately after a submission is persisted. It does not block the submission response.

Implementation: After saving the `Submission` row, set `ai_feedback_status = 'generating'` and invoke the feedback coroutine as a background task (`FastAPI BackgroundTasks`).

### 8.2 Prompt

The AI is given:

- Problem title and description
- Candidate's submitted code and language
- Judge0 result summary (passed/failed per test case, score)
- Instruction to provide constructive code review

System prompt (sent to API):

```
You are a senior software engineer reviewing a coding assessment submission.
Provide concise, constructive feedback on the candidate's code. Cover:
1. Correctness and logic
2. Time and space complexity
3. Code quality and readability
4. Specific suggestions for improvement

Be professional and objective. Do not reveal the hidden test cases.
Keep feedback under 400 words.
```

### 8.3 Storage

- Generated feedback text is stored in `submissions.ai_feedback`.
- `submissions.ai_feedback_status` is updated: `pending` → `generating` → `done` (or `failed` on error).
- If generation fails: log error to CloudWatch, set `ai_feedback_status = 'failed'`, do not retry automatically.

### 8.4 Access

- AI feedback is **never returned to candidates** under any circumstance.
- Only accessible via `GET /admin/candidates/{user_id}/report/{submission_id}` (full field) or the SSE stream endpoint.

---

## 9. File Structure

```
backend/
├── main.py                        # FastAPI app + Mangum handler
├── requirements.txt
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 001_initial_schema.py
├── app/
│   ├── core/
│   │   ├── config.py              # Settings from env/Secrets Manager
│   │   ├── database.py            # SQLAlchemy async engine + session factory
│   │   ├── security.py            # JWT encode/decode, bcrypt helpers
│   │   └── dependencies.py        # get_current_user, require_admin, require_candidate
│   ├── models/
│   │   ├── base.py
│   │   ├── user.py
│   │   ├── skill.py
│   │   ├── problem.py
│   │   ├── session.py
│   │   ├── submission.py
│   │   └── badge.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── skill.py
│   │   ├── problem.py
│   │   ├── session.py
│   │   ├── submission.py
│   │   └── badge.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── skills.py
│   │   ├── sessions.py
│   │   ├── submissions.py
│   │   ├── history.py
│   │   └── admin/
│   │       ├── candidates.py
│   │       ├── scores.py
│   │       ├── leaderboard.py
│   │       ├── reports.py
│   │       └── badges.py
│   └── services/
│       ├── judge0_service.py      # Judge0 API client
│       ├── scoring_service.py     # Score computation + level unlock logic
│       ├── session_service.py     # Session creation, expiry, auto-submit
│       └── report_service.py      # Excel/CSV/PDF generation
├── infra/
│   ├── app.py                     # CDK app entry point
│   ├── cdk_stack.py               # CodingPlatformStack (all resources in one file)
│   └── requirements.txt
```

---

## 10. Environment Variables & Secrets

All sensitive values are stored in AWS Secrets Manager and injected into Lambda at runtime.

| Variable | Source | Description |
|---|---|---|
| `DB_SECRET_ARN` | CDK (Secrets Manager) | ARN of the RDS credentials secret (`coding-platform/db-credentials`) |
| `DB_HOST` | CDK (RDS endpoint) | PostgreSQL host address |
| `DB_PORT` | CDK (RDS endpoint) | PostgreSQL port |
| `DB_NAME` | CDK (hardcoded) | Database name — `codingplatform` |
| `JUDGE0_BASE_URL` | CDK (EC2 private IP) | Full base URL for Judge0 CE, e.g. `http://<private-ip>:2358` |
| `JWT_SECRET_KEY` | Secrets Manager (manual) | Secret for signing JWTs |
| `JWT_EXPIRE_HOURS` | Env | Default: `8` |
| `SCORE_PASS_THRESHOLD` | Env | Default: `70` (percent) |
| `MAX_ATTEMPTS_PER_LEVEL` | Env | Default: `5` |

**Secrets Manager secret name:** `coding-platform/db-credentials` (contains `username` and auto-generated `password`).

---

## 11. Error Handling

All error responses follow this shape:

```json
{
  "detail": "Human-readable error message"
}
```

| Status | Scenario |
|---|---|
| `400 Bad Request` | Validation error, malformed input |
| `401 Unauthorized` | Missing or invalid JWT |
| `403 Forbidden` | Valid JWT but wrong role, or accessing another user's resource |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Max attempts reached, session already submitted, duplicate badge assignment |
| `410 Gone` | Session has expired (submit after timer) |
| `422 Unprocessable Entity` | Unsupported language, missing required fields |
| `502 Bad Gateway` | Judge0 call failed |
| `500 Internal Server Error` | Unhandled exception — logged to CloudWatch |

---

## 12. Admin Permissions — Locked State

### What Admin CAN Do via API

- Read all candidate data, profiles, submissions, and reports
- Read AI feedback on any submission
- Read scores overview and leaderboard
- Create, view, and assign badges
- Generate and download reports (Excel, CSV, PDF)
- Filter/search all data

### What Admin CANNOT Do via API

These actions have no corresponding endpoint and are intentionally absent:

- Override or change a submission's score or status
- Reset a candidate's attempt count
- Disable or deactivate a candidate's account
- Create or edit problems (all AI-generated externally, seeded via migration)
- Modify any candidate profile field
- Send emails through the platform

> **Design Note:** The admin role is a read-only observer and reporter. All scoring is determined exclusively by Judge0 CE. This prevents result tampering and keeps the admin surface minimal.

---

## 13. Deployment

### CDK Stack Resources

| Resource | Details |
|---|---|
| VPC | 2 public + 2 private subnets across 2 AZs, 1 NAT Gateway |
| Lambda | Python 3.11, x86_64, 512MB memory, 30s timeout, private subnets |
| API Gateway | HTTP API, `/{proxy+}` + `/` catch-all routes |
| RDS | PostgreSQL 15, db.t4g.micro, private subnet, 20GB storage (auto-scale to 100GB) |
| EC2 (Judge0) | t3.small, Amazon Linux 2, private subnet, Docker + Docker Compose, Judge0 CE on port 2358 |
| Secrets Manager | `coding-platform/db-credentials` (username + auto-generated password) |
| CloudWatch | Default Lambda log group (managed by AWS) |

> **Note:** EventBridge session expiry sweep is **not yet implemented** in the CDK stack. The timeout auto-submit logic must be handled within the Lambda handler itself for now.

### Deploy Commands

```powershell
cd backend/infra
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cdk bootstrap    # first time only
cdk deploy
```

### Get API URL

```powershell
$API_URL = aws cloudformation describe-stacks `
  --stack-name CodingPlatformStack `
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" `
  --output text
```

### Database Migrations

Run Alembic migrations against RDS after deploy:

```bash
alembic upgrade head
```

Seed initial data (skills, beginner-level unlock for all users):

```bash
python scripts/seed.py
```

---

## 14. Common Failure Patterns

| Error | Cause | Resolution |
|---|---|---|
| `404 Candidate not found` | User ID does not exist in DB | Verify user was created |
| `404 Problem not found` | No problems seeded for skill+level | Run seed script |
| `409 Max attempts reached` | User has 5 sessions for this skill+level | Expected — no reset available in v1 |
| `422 Unsupported language` | Language not in Judge0 ID map | Add mapping in `judge0_service.py` |
| `502 Judge0 execution failed` | Network path broken or Judge0 not running | Check EC2 instance and security groups |
| `500 Failed to persist submission` | DB write failure | Check RDS connectivity and CloudWatch logs |
---

*End of Document — Internal Assessment Platform Backend PRD v1.0*