# Backend Routes Reference

This document describes the routes that are currently mounted by the FastAPI app for frontend integration.

## Base URL

- Local: `http://127.0.0.1:8000`
- Dev/Deployed: API Gateway URL for your environment

## Authentication

- Auth type: Bearer JWT
- Header: `Authorization: Bearer <token>`
- Public routes:
  - `GET /`
  - `GET /health`
  - `GET /health/judge0`
  - `GET /health/judge0/smoke`
  - `GET /judge0/languages`
  - `GET /judge0/language`
  - `GET /judge0/docs`
  - `POST /auth/login`
- Shared-secret proxy routes (no JWT, but require proxy token header):
  - `GET|POST|PUT|PATCH|DELETE /proxy/judge0/{path}`
- Candidate-only routes:
  - `GET /skills`
  - `GET /user/progress`
  - `GET /skills/{skill_id}/levels`
  - `POST /sessions/start`
  - `GET /sessions/{session_id}`
  - `POST /sessions/{session_id}/draft`
  - `POST /sessions/{session_id}/submit`
  - `GET /submissions/{submission_id}/results`

- Admin-only routes:
  - `GET /admin/stats`

Error format:

```json
{
  "detail": "Human-readable message"
}
```

## Public Utility

### GET /

Response:

```json
{
  "message": "Coding Assessment Platform API is running"
}
```

### GET /health

Response:

```json
{
  "status": "healthy"
}
```

### GET /health/judge0

Public Judge0 reachability probe (calls Judge0 `/languages`).

Success response:

```json
{
  "status": "ok",
  "judge0_reachable": true,
  "judge0_base_url": "http://judge0-host:2358",
  "latency_ms": 42
}
```

Failure response (`503`):

```json
{
  "status": "down",
  "judge0_reachable": false,
  "judge0_base_url": "http://judge0-host:2358",
  "error": "..."
}
```

### GET /health/judge0/smoke

Public end-to-end Judge0 execution check (runs a tiny Python snippet).

Success response:

```json
{
  "status": "ok",
  "judge0_execution": true,
  "judge0_base_url": "http://judge0-host:2358",
  "latency_ms": 180,
  "passed_tests": 1,
  "total_tests": 1
}
```

Failure response (`503`):

```json
{
  "status": "down",
  "judge0_execution": false,
  "judge0_base_url": "http://judge0-host:2358",
  "error": "..."
}
```

### GET /judge0/languages (or /judge0/language)

Public proxy route to fetch Judge0 language catalog.

Success response:

```json
{
  "status": "ok",
  "judge0_base_url": "http://judge0-host:2358",
  "latency_ms": 57,
  "count": 90,
  "languages": [
    { "id": 71, "name": "Python (3.8.1)" }
  ]
}
```

Failure response (`503`):

```json
{
  "status": "down",
  "judge0_base_url": "http://judge0-host:2358",
  "error": "..."
}
```

### GET /judge0/docs

Public discovery route that returns Judge0 docs URLs and checks commonly useful endpoints.

Response:

```json
{
  "status": "ok",
  "judge0_base_url": "http://judge0-host:2358",
  "latency_ms": 105,
  "docs_url": "http://judge0-host:2358/docs",
  "openapi_url": "http://judge0-host:2358/openapi.json",
  "docs_reachable": true,
  "openapi_reachable": true,
  "available_endpoints": ["/languages", "/statuses", "/submissions"],
  "common_useful_endpoints": ["/languages", "/statuses", "/submissions", "/config_info", "/system_info"]
}
```

### GET|POST|PUT|PATCH|DELETE /proxy/judge0/{path}

Shared-secret protected generic proxy to internal Judge0 for external integrations.

Auth headers (one required):

- `X-Proxy-Token: <JUDGE0_PROXY_TOKEN>`
- `X-API-Key: <JUDGE0_PROXY_TOKEN>`

Path policy:

- Allowed prefixes are controlled by `JUDGE0_PROXY_ALLOWED_PREFIXES`.
- Default allowed prefixes: `submissions`, `languages`, `statuses`, `config_info`, `system_info`.

Examples:

```bash
# Create submission via backend proxy
curl -X POST "$API_URL/proxy/judge0/submissions?base64_encoded=false&wait=true" \
  -H "X-Proxy-Token: <shared-token>" \
  -H "Content-Type: application/json" \
  -d '{"source_code":"print(1)","language_id":71}'
```

```bash
# Poll submission token via backend proxy
curl -X GET "$API_URL/proxy/judge0/submissions/<token>?base64_encoded=false" \
  -H "X-Proxy-Token: <shared-token>"
```

Error cases:

- `401` invalid or missing proxy token
- `403` proxy path not allowed by policy
- `503` proxy token not configured on backend
- `502` upstream Judge0 unreachable
- `504` upstream request timeout

## Auth

### POST /auth/login

Request:

```json
{
  "email": "candidate@example.com",
  "password": "Passw0rd!"
}
```

Response:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 28800,
  "user": {
    "user_id": "uuid",
    "role": "candidate",
    "name": "Local Candidate",
    "email": "candidate@example.com"
  }
}
```

Possible errors:

- `401` invalid email/password

## Skills and Progress

### GET /skills

Auth: candidate

Response:

```json
[
  {
    "skill_id": "uuid",
    "name": "Python",
    "description": "Core Python programming",
    "icon_url": null
  }
]
```

### GET /user/progress

Auth: candidate

Response:

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
        "cleared": false,
        "attempts_used": 0,
        "attempts_remaining": 5
      }
    ]
  }
]
```

### GET /skills/{skill_id}/levels

Auth: candidate

Response shape is the same as one item in `GET /user/progress`.

Possible errors:

- `404` skill not found

## Sessions

### POST /sessions/start

Auth: candidate

Request:

```json
{
  "skill_id": "uuid",
  "level": "beginner"
}
```

Response:

```json
{
  "session_id": "uuid",
  "problem_id": "uuid",
  "expires_at": "2026-03-23T12:00:00Z",
  "attempt_number": 1,
  "attempts_remaining": 4,
  "problem": {
    "title": "Python - Echo Input",
    "description": "Read stdin and print exactly the same value.",
    "sample_test_cases": [
      {
        "stdin": "hello",
        "expected_output": "hello",
        "explanation": "Echo text"
      }
    ],
    "time_limit_minutes": 45
  }
}
```

Possible errors:

- `403` level is locked
- `404` problem not found
- `409` max attempts reached

### GET /sessions/{session_id}

Auth: candidate (owner only)

Response:

```json
{
  "session_id": "uuid",
  "status": "active",
  "expires_at": "2026-03-23T12:00:00Z",
  "seconds_remaining": 2400,
  "problem": {
    "title": "Python - Echo Input",
    "description": "...",
    "sample_test_cases": [],
    "time_limit_minutes": 45
  },
  "last_draft_code": "print(input())",
  "last_draft_lang": "python"
}
```

Possible errors:

- `403` session not owned by current user
- `404` session not found

### POST /sessions/{session_id}/draft

Auth: candidate (owner only)

Request:

```json
{
  "code": "print(input())",
  "language": "python"
}
```

Response:

```json
{
  "saved_at": "2026-03-23T11:32:10Z"
}
```

Possible errors:

- `403` session not owned by current user
- `404` session not found
- `409` session is not active

### POST /sessions/{session_id}/submit

Auth: candidate (owner only)

Request:

```json
{
  "code": "print(input())",
  "language": "python"
}
```

Response:

```json
{
  "submission_id": "uuid",
  "session_id": "uuid",
  "status": "cleared",
  "score": 100,
  "passed_tests": 1,
  "total_tests": 1,
  "time_taken_seconds": 120,
  "cases": [
    {
      "token": "...",
      "stdin": "abc",
      "expected_output": "abc",
      "stdout": "abc",
      "stderr": null,
      "compile_output": null,
      "message": null,
      "status": { "id": 3, "description": "Accepted" },
      "time": "0.001",
      "memory": 3200,
      "passed": true
    }
  ]
}
```

Possible errors:

- `403` session not owned by current user
- `404` session not found
- `409` session already closed
- `410` session expired and draft auto-submitted
- `422` unsupported language
- `502` Judge0 execution failed

## Submission Results

### GET /submissions/{submission_id}/results

Auth: candidate (owner only)

Response:

```json
{
  "submission_id": "uuid",
  "status": "cleared",
  "score": 100,
  "passed_tests": 1,
  "total_tests": 1,
  "time_taken_seconds": 120,
  "attempts_used": 1,
  "attempts_remaining": 4,
  "next_level_unlocked": true,
  "cases": [
    {
      "stdin": "abc",
      "expected_output": "abc",
      "stdout": "abc",
      "status": { "id": 3, "description": "Accepted" },
      "passed": true
    }
  ]
}
```

Possible errors:

- `403` submission not owned by current user
- `404` submission not found
