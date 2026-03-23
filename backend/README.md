# Backend - Coding Platform

This backend is a FastAPI app deployed on AWS Lambda through Mangum, exposed by API Gateway HTTP API, backed by RDS PostgreSQL, and connected to a self-hosted Judge0 CE instance running on EC2.

For frontend integration contracts (current mounted routes, auth requirements, request/response payloads), see `ROUTES.md`.

## What this stack contains

The CDK stack in `backend/infra` creates:

- VPC with public and private subnets
- Lambda function for the FastAPI app (`main.handler`)
- API Gateway HTTP API (`/{proxy+}` and `/`)
- RDS PostgreSQL database (private)
- Secrets Manager secret for DB credentials
- EC2 instance for Judge0 CE (private)

Runtime flow:

1. `curl` hits API Gateway.
2. API Gateway invokes Lambda.
3. Lambda routes request through FastAPI endpoints.
4. Lambda reads/writes candidate/question/submission data in Postgres.
5. For `/submit`, Lambda calls Judge0 to run code and stores execution result.

## Prerequisites

- Python 3.11+
- AWS CLI configured (`aws configure`)
- AWS account permissions for CDK/Lambda/RDS/EC2/API Gateway/CloudWatch/Secrets Manager

## Deploy the backend stack

From the repo root:

```powershell
cd backend/infra

# Create and activate virtual environment (first time)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install infra dependencies
pip install -r requirements.txt

# Bootstrap CDK in account/region (first time per env)
cdk bootstrap

# Deploy
cdk deploy
```

Get the API URL output:

```powershell
aws cloudformation describe-stacks `
  --stack-name CodingPlatformStack `
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" `
  --output text
```

Save it for quick use:

```powershell
$API_URL = aws cloudformation describe-stacks `
  --stack-name CodingPlatformStack `
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" `
  --output text
```

## Local app execution (optional)

If you want to run FastAPI locally (without API Gateway/Lambda):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Set DB env vars or DATABASE_URL first
uvicorn main:app --reload --port 8000
```

Seed local test data (users, skills, problems, and progress):

```powershell
python scripts/seed.py
```

Health check:

```powershell
curl http://127.0.0.1:8000/health
```

## API quick checks with curl

Health endpoint:

```powershell
curl "$API_URL/health"
```

Root endpoint:

```powershell
curl "$API_URL/"
```

Get candidate:

```powershell
curl "$API_URL/candidates/<candidate_id>"
```

Submit code (example):

```powershell
curl -X POST "$API_URL/submit" `
  -H "Content-Type: application/json" `
  -d '{
    "candidate_id": "cand-001",
    "question_id": "q-001",
    "code": "print(input())",
    "language": "python"
  }'
```

Note: `/submit` expects candidate/question records to exist in DB.

## Debugging curl and backend issues

When debugging, always do three things together:

1. Send verbose curl output.
2. Tail Lambda logs in CloudWatch.
3. Inspect stack/resource status if something infrastructure-related failed.

### 1) Use verbose curl

```powershell
curl -v -i "$API_URL/health"
```

For POST payload debugging:

```powershell
curl -v -i -X POST "$API_URL/submit" `
  -H "Content-Type: application/json" `
  -d '{"candidate_id":"cand-001","question_id":"q-001","code":"print(1)","language":"python"}'
```

What to look for:

- HTTP status code (`2xx`, `4xx`, `5xx`)
- Response body `detail` field
- API Gateway headers like request IDs

### 2) Tail Lambda logs live

Get the physical Lambda function name from CloudFormation:

```powershell
$LAMBDA_NAME = aws cloudformation describe-stack-resource `
  --stack-name CodingPlatformStack `
  --logical-resource-id BackendLambda `
  --query "StackResourceDetail.PhysicalResourceId" `
  --output text
```

Tail logs:

```powershell
aws logs tail "/aws/lambda/$LAMBDA_NAME" --since 15m --follow
```

Then rerun your `curl` in a second terminal and correlate:

- `5xx` from API + Lambda exception trace in logs => app/runtime problem
- `502` with Judge0 details => Judge0 host or network path issue
- DB connection errors => DB credentials/security group/connectivity issue

### 3) Check Lambda invocation metrics quickly

```powershell
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Errors `
  --dimensions Name=FunctionName,Value=$LAMBDA_NAME `
  --start-time (Get-Date).AddHours(-1).ToUniversalTime().ToString("s") `
  --end-time (Get-Date).ToUniversalTime().ToString("s") `
  --period 300 `
  --statistics Sum
```

### 4) Check stack events if deploy/update fails

```powershell
aws cloudformation describe-stack-events --stack-name CodingPlatformStack
```

## Common failure patterns

- `404 Candidate not found` or `404 Question not found`:
  Data does not exist in RDS.
- `422 Unsupported language`:
  The language is not mapped in `judge0_service.py`.
- `502 Judge0 execution failed`:
  Lambda reached backend logic but Judge0 call failed (network, host, API error, or timeout).
- `500 Failed to persist submission`:
  Database write failed.

## Destroy stack

From `backend/infra`:

```powershell
cdk destroy
```
