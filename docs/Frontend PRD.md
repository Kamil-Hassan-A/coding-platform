# Internal Assessment Platform
## Frontend Flow & Requirements Document

**Version 1.0 | March 2026 | Confidential**

---

## 1. Project Overview

The Internal Assessment Platform is a fully self-hosted web application designed to evaluate employees through AI-generated coding challenges. The platform supports proctored assessments, automated scoring via Judge0 CE, AI-powered code feedback, progression tracking, and admin analytics — all within a secure internal environment.

### 1.1 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React (TypeScript) |
| **Code Editor** | Monaco Editor |
| **Backend** | FastAPI + Mangum (Python) on AWS Lambda |
| **Code Execution** | Judge0 CE Self-Hosted on EC2 (t4g.micro) |
| **Primary Database** | Amazon RDS PostgreSQL (db.t4g.micro) |
| **Frontend Hosting** | Vercel |
| **API Gateway** | Amazon API Gateway (HTTP API) |
| **Networking** | Amazon VPC (Private Subnets Only) |
| **Security** | IAM Roles & Policies |
| **State Management** | Zustand |
| **API Layer** | TanStack React Query + Axios |
| **Styling** | Tailwind CSS + shadcn/ui |

### 1.2 User Roles

- **Candidate (Employee)** — takes assessments, views own results and history
- **Admin** — views all candidate data, reports, scores, leaderboard, proctoring flags

> **Important:** These are the only two roles. Routing is strictly role-guarded — candidates cannot access any admin routes and vice versa.

---

## 3. Complete Page List

### 3.1 Candidate Pages (6 pages)

| Route | Description |
|---|---|
| `/login` | Login screen — email + password, JWT auth, role-based redirect |
| `/dashboard` | Welcome screen with skill cards, unlocked/locked levels, attempt counts |
| `/assessment/[skillId]` | Level selection screen — shows 5 levels, attempts remaining per level, start confirmation modal |
| `/editor/[sessionId]` | Monaco editor, language selector, autosave indicator, server-synced countdown timer, run + submit |
| `/results/[submissionId]` | Score, per-test-case pass/fail, time, memory — NO AI feedback |
| `/history` | All past attempts — skill, level, date, score, duration, status |

### 3.2 Admin Pages (9 pages)

| Route | Description |
|---|---|
| `/admin/dashboard` | Overview stat cards — total candidates, pass rate, active tests, attempts today, pending flags |
| `/admin/candidates` | Filterable candidate table — skill, level, dept, score, status |
| `/admin/candidates/[id]` | Credential page — YOE (individual + overall), email, dept, skill progress, attempt list tabs |
| `/admin/candidates/[id]/report/[attemptId]` | Full attempt report — time, score, test cases, AI feedback, flags count with link, Excel/CSV download |
| `/admin/scores` | Visual scores overview — green/red circle ScoreBadge with score per candidate, filterable |
| `/admin/leaderboard` | Rankings by skill/level/batch — admin only |
| `/admin/reports` | Auto-generated reports list — downloadable as Excel, CSV, PDF |
| `/admin/badges` | Badge management — create, view, assign |
| `/admin/flags` | Standalone proctoring flags — event type, severity, timestamp, frame snapshot, admin notes, resolve |

---

## 4. Candidate Flow

### 4.1 Auth Flow

```
User visits platform
  → /login
  Enter email + password
  JWT returned from FastAPI
  Role decoded from token
  │
  ├── role = candidate → /dashboard
  └── role = admin    → /admin/dashboard
```

### 4.2 Dashboard

- Displays: 'Welcome, [name]'
- Shows all skill cards — each card shows skill name, 5 levels, current cleared level
- Locked levels are greyed out and unclickable
- Level 1 (Beginner) is unlocked for all candidates by default
- Clearing a level automatically unlocks the next one

### 4.3 Level Selection — `/assessment/[skillId]`

- Lists all 5 levels: Beginner, Intermediate 1, Intermediate 2, Specialist 1, Specialist 2
- Each level shows: difficulty label, estimated time, attempts remaining (X of 5)
- If attempts remaining = 0, button is disabled — 'Max attempts reached'
- Clicking an available level triggers a confirmation modal:
  - 'You have X attempts remaining. Start test?' — [Cancel] [Start]
- Confirming starts the assessment and consumes one attempt slot

### 4.4 Editor — `/editor/[sessionId]`

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  Problem Title          [Timer: 45:00]    [Submit]   │
├───────────────────────┬──────────────────────────────┤
│                       │                              │
│  Problem Description  │  Monaco Editor               │
│  (markdown render)    │  Language selector           │
│                       │  Autosave indicator          │
│  Examples             │                              │
│                       ├──────────────────────────────┤
│  Constraints          │  [Run] → sample test output  │
│                       │                              │
└───────────────────────┴──────────────────────────────┘
  Webcam indicator in bottom corner (if proctored)
```

- Timer is server-side — frontend syncs with server on load
- Autosave fires every 2–3 seconds (debounced) — POST to `/sessions/{session_id}/draft`
- If tab is closed and timer expires: auto-submitted with last autosaved code
- Counts as 1 attempt used regardless of tab close or timeout
- Paste events are captured and sent to proctoring service
- Right-click context menu disabled in proctored mode

### 4.5 Results — `/results/[submissionId]`

- Results are returned directly in the submission response. Show loading state while `POST /sessions/{session_id}/submit` is in flight: 'Running your code...'
- On response, render results immediately

**Displayed to candidate:**

- Score: X / Y test cases passed
- Status badge: Cleared / Failed / Timed Out / Auto-submitted
- Per test case: pass/fail icon, time taken (ms), memory used (KB)
- Attempts used: X of 5
- **NO AI feedback shown to candidate**

**Outcome actions:**

- Cleared → '🎉 Next level unlocked!' → back to dashboard
- Failed + attempts remaining → 'Try again' button
- Failed + 0 attempts remaining → 'Max attempts reached' — no retry

### 4.6 History — `/history`

- Table of all past attempts across all skills and levels
- Columns: Skill, Level, Date, Score, Duration, Status (Cleared / Failed / Timed Out)
- Click row → expand to see test case breakdown for that attempt
- No AI feedback visible in history — candidate view only

---

## 5. Admin Flow

### 5.1 Admin Dashboard — `/admin/dashboard`

- Stat cards: Total candidates, Active assessments, Average pass rate, Attempts today, Pending flag reviews
- Quick filters: by batch, by skill, by date range
- Recent activity feed

> **Note:** A dedicated `GET /admin/dashboard/stats` endpoint is needed in the backend to serve the stat card values (total candidates, pass rate, active sessions, attempts today, pending flag count). This endpoint is not yet defined in the backend PRD and should be added before building this page.

### 5.2 Candidates Table — `/admin/candidates`

- Full candidate table with columns: Name, Dept, Skill, Level, Status, Score, Feedback, Actions
- Filters: Skill | Level Cleared | Department | Status
- Click a candidate row → navigates to `/admin/candidates/[id]`

### 5.3 Candidate Credential Page — `/admin/candidates/[id]`

- Profile: Name, Email, Department
- Years of Experience — individual (in role) + overall
- Skill progress overview: which levels cleared per skill
- Tabs: [Attempts] [Proctoring Flags link]
- Attempts tab: list of all attempts with skill, level, date, score, status
- Click any attempt row → `/admin/candidates/[id]/report/[attemptId]`

### 5.4 Full Attempt Report — `/admin/candidates/[id]/report/[attemptId]`

- Start time, End time, Duration
- Score and Status (Cleared / Failed / Timed Out / Auto-submitted)
- Per test case: pass/fail, time (ms), memory (KB)
- AI code review and feedback — visible here only (not to candidate)
- Proctoring: 'X flags raised' with a link to `/admin/flags?candidateId=X&attemptId=Y`
- Download buttons: [Excel] [CSV] [PDF]
- Read-only — no override, reset, or disable actions

### 5.5 Scores Overview — `/admin/scores`

- Visual overview of all candidate scores across skills and levels
- Each row shows candidate name with a ScoreBadge component:
  - Green filled circle = Passed
  - Red filled circle = Failed
  - Score percentage shown next to or inside the circle
- Filterable by: Skill, Level, Batch, Date range

> **Note:** "Batch" filtering is referenced here and in the Leaderboard view but is not yet defined in the data model. A `batch` field will need to be added to the `users` table (e.g., a cohort or intake label) before this filter can be implemented. Treat as a v1.1 item until the schema is updated.
- Designed for at-a-glance admin review of cohort performance

> **ScoreBadge Component**
> Reusable component used across admin panel. Props: `score` (number), `passed` (boolean). Renders a filled circle — green (`#4CAF50`) if passed, red (`#F44336`) if failed — with the score value displayed.

### 5.6 Leaderboard — `/admin/leaderboard`

- Admin-only — not visible to candidates under any circumstances
- Ranked table: Rank, Name, Dept, Skill, Level, Score, Time Taken, Status
- Filters: Skill, Level, Batch, Date range

### 5.7 Reports — `/admin/reports`

- List of all auto-generated reports stored in the platform
- Columns: Report name, Batch/Skill, Generated at, Type
- No email functionality — download only
- Download formats available: Excel, CSV, PDF
- Manual trigger available: 'Generate report now' button

### 5.8 Badges — `/admin/badges`

- View all existing badges with criteria
- Create new badge: name, criteria, icon
- View which candidates have earned each badge

### 5.9 Proctoring Flags — `/admin/flags`

- Standalone page — not embedded in any other view
- Columns: Candidate, Assessment, Event type, Severity, Timestamp, Status
- Filters: Severity (low/medium/high), Reviewed/Unreviewed, Date range
- Click flag → expand detail:
  - Event type description
  - Frame snapshot (if available from proctoring capture)
  - Admin notes input field
  - Actions: Mark as reviewed / Escalate

---

## 6. Component Map

### 6.1 Candidate Components

| Component | Purpose |
|---|---|
| `WelcomeBanner` | Displays 'Welcome, [name]' on dashboard |
| `SkillCard` | Skill tile with locked/unlocked visual state |
| `LevelBadge` | Shows 5 levels, cleared state, attempts remaining |
| `AssessmentTimer` | Server-synced countdown, auto-submits on expiry |
| `MonacoEditor` | Code editor with language selector |
| `AutosaveIndicator` | 'Saved' / 'Saving...' status display |
| `SubmitButton` | Triggers submission flow with loading state |
| `TestCaseResultPanel` | Per test case pass/fail, time, memory |
| `AttemptHistoryTable` | Past attempts table with expandable rows |

### 6.2 Admin Components

| Component | Purpose |
|---|---|
| `CandidateTable` | Filterable candidate list table |
| `CandidateCredentialCard` | YOE, email, dept card |
| `AttemptReportTable` | Start/end time, duration, score, questions |
| `TestCaseSolutionViewer` | Test cases + solution viewer per attempt |
| `ScoreBadge` | Green/red circle with score — reused across admin |
| `DownloadButton` | Export Excel / CSV / PDF per report or attempt |
| `LeaderboardTable` | Rankings table — admin only |
| `ReportsList` | Auto-generated reports with download actions |
| `BadgeManager` | Create, assign, view badges |
| `ProctoringFlagReview` | Flag list, severity, snapshots, notes, resolve |
| `StatCard` | Reusable metric card for dashboard overview |
| `FilterBar` | Reusable filter: skill, level, dept, date range |

### 6.3 Shared / Base Components

| Component | Purpose |
|---|---|
| `Navbar` | Role-aware navigation (candidate vs admin) |
| `ProtectedRoute` | Redirects unauthenticated users to `/login` |
| `RoleGuardRoute` | Redirects wrong-role users to their dashboard |
| `Avatar` | User initials or profile icon |
| `StatusBadge` | Cleared / Failed / In Progress / Timed Out labels |
| `Modal` | Reusable dialog — used for start confirmation, etc. |
| `Toast` | Success and error notification system |
| `Spinner / Skeleton` | Loading states for async data |
| `EmptyState` | 'No attempts yet', 'No candidates found' etc. |

---

## 7. Global State & API Layer

### 7.1 Zustand Stores

| Store | Contains |
|---|---|
| `userStore` | id, name, role, token, department |
| `assessmentStore` | active problem, timer value, attempt count, session status |
| `editorStore` | source code, selected language, saved status, last saved timestamp |

### 7.2 API Calls Per Page (React Query)

| Page | API Calls |
|---|---|
| `/dashboard` | `GET /skills` + `GET /user/progress` |
| `/assessment/[skillId]` | `GET /skills/[id]/levels` + `GET /user/attempts` |
| `/editor/[sessionId]` | `GET /sessions/[id]` (problem + timer state on load) + `POST /sessions/[id]/draft` (autosave) + `POST /sessions/[id]/submit` |
| `/results/[submissionId]` | `GET /submissions/[id]/results` |
| `/history` | `GET /user/attempts` |
| `/admin/candidates` | `GET /admin/candidates` (paginated + filtered) |
| `/admin/candidates/[id]` | `GET /admin/candidates/[id]` (includes attempts inline) |
| `/admin/candidates/[id]/report/[attemptId]` | `GET /admin/candidates/[id]/report/[attemptId]` + `GET /submissions/[id]/feedback` (SSE — admin only) |
| `/admin/scores` | `GET /admin/scores` (filterable) |
| `/admin/leaderboard` | `GET /admin/leaderboard` |
| `/admin/reports` | `GET /admin/reports` + `POST /admin/reports/generate` |
| `/admin/flags` | `GET /admin/flags` + `PATCH /admin/flags/[id]` |

---

## 8. Frontend File Structure

```
apps/frontend/
├── src/
│   ├── app/                        # React Router routing
│   │   ├── (auth)/login/
│   │   ├── (candidate)/
│   │   │   ├── dashboard/
│   │   │   ├── assessment/[skillId]/
│   │   │   ├── editor/[sessionId]/
│   │   │   ├── results/[submissionId]/
│   │   │   └── history/
│   │   └── (admin)/
│   │       ├── dashboard/
│   │       ├── candidates/
│   │       │   └── [id]/report/[attemptId]/
│   │       ├── scores/
│   │       ├── leaderboard/
│   │       ├── reports/
│   │       ├── badges/
│   │       └── flags/
│   ├── components/
│   │   ├── ui/                     # Base components
│   │   ├── editor/                 # Monaco + toolbar
│   │   ├── assessment/             # Problem display, timer, results
│   │   ├── proctoring/             # Webcam feed, status indicator
│   │   ├── dashboard/              # Skill cards, badges, progress
│   │   └── admin/                  # Tables, reports, flags, scores
│   ├── hooks/
│   │   ├── useSubmission.ts
│   │   ├── useEditorDraft.ts
│   │   ├── useProctoring.ts
│   │   └── useAssessmentTimer.ts
│   ├── stores/
│   │   ├── userStore.ts
│   │   ├── editorStore.ts
│   │   └── assessmentStore.ts
│   ├── lib/
│   │   ├── api.ts                  # Axios instance
│   │   └── constants.ts
│   └── types/
│       ├── user.ts
│       ├── assessment.ts
│       ├── submission.ts
│       └── problem.ts
```

---

## 9. Admin Permissions — Final Locked State

### 9.1 What Admin CAN Do

- View all candidate attempts, credentials, and reports
- View AI feedback on any submission (exclusive to admin)
- View and action proctoring flags (review, add notes, escalate)
- View scores overview with green/red ScoreBadge indicators
- View leaderboard (exclusive to admin)
- Manage badges (create, view, assign)
- Download reports and attempt data as Excel, CSV, or PDF
- Filter candidates by skill, level, department, status, date range

### 9.2 What Admin CANNOT Do

- Override or manually set a pass/fail result
- Reset a candidate's attempt count
- Disable a candidate's access
- Create or edit problems (all AI-generated, auto live)
- Modify any candidate profile data
- Send or receive emails through the platform

> **System Design Note:** The admin is a read-only observer and reporter — not an operator. All execution results are determined entirely by Judge0 CE. This is intentional to prevent result tampering and simplifies the admin UI significantly.

---

*End of Document — Internal Assessment Platform Frontend Flow v1.0*