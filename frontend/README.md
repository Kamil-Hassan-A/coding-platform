# Internal Assessment Platform — Frontend

## 🚀 Project Overview
A modern, enterprise-grade assessment platform built for **Indium Software**. This React-based frontend manages the end-to-end lifecycle of internal skill evaluations, from authentication to candidate management and live coding assessments.

---

## 🛠️ Core Tech Stack

| Layer | Technology | Version | Key Purpose |
| :--- | :--- | :--- | :--- |
| **UI Library** | React | 19.2.4 | Component-based architecture |
| **Build Tool** | Vite | 8.0.1 | HMR and optimized production builds |
| **Language** | TypeScript | 5.9.3 | Type safety across features |
| **State** | Zustand | 5.0.12 | Global store with persistence |
| **Data Fetching**| React Query | 5.66.9 | Server state management & caching |
| **Routing** | React Router | 7.13.1 | Declarative, role-based navigation |
| **HTTP Client** | Axios | 1.13.6 | Interceptor-driven API communication |
| **Charts** | Recharts | 3.8.0 | SVG-based data visualization |
| **Styles** | Tailwind CSS | 4.2.2 | Utility-first styling (v4) |

---

## 📂 Project Architecture

The project follows a **Feature-Based Module** approach, ensuring logic is encapsulated near the UI it serves.

```text
src/
├── api/
│   └── axiosInstance.ts      # Global Axios setup (Auth headers + 401 handling)
├── components/
│   └── layout/
│       └── Sidebar.tsx       # Reusable navigation for all dashboards
├── features/
│   ├── admin/                # Admin views, Recharts logic, Candidate management
│   ├── assessment/           # Coding environment (Monaco, Split-pane)
│   ├── auth/                 # Login, Protected routes, Auth services
│   └── candidate/            # Candidate-specific dashboards & services
├── routes/
│   └── AppRoutes.tsx         # Central Routing (Role-guarded)
├── stores/
│   └── userStore.ts          # Zustand store (User session + Token)
└── types/
    └── user.ts               # Core interface definitions
```

---

## 🧠 Logical Implementation Details

### 1. Authentication & Role-Based Access
*   **Persistent Session**: Managed via `userStore.ts` utilizing Zustand's `persist` middleware (localSync).
*   **Auth Service (`authService.ts`)**:
    *   `loginWithCredentials`: Maps backend response to frontend `User` model safely.
    *   `loginWithSSO`: Mock implementation for development; reads `test_role` from `localStorage` for persona switching.
*   **Route Guards**: `ProtectedRoute.tsx` wraps specific routes, intercepting unauthorized access and redirecting based on `UserRole`.

### 2. API Integration & Server State
*   **Axios Interceptor**: 
    *   **Request**: Automatically attaches `Authorization: Bearer <token>` to all calls.
    *   **Response**: Catches `401 Unauthorized`, clears local state, and redirects to `/auth/login`.
*   **React Query Patterns**:
    *   Used in `CandidateDashboard.tsx` and `AdminDashboard.tsx`.
    *   Implements `staleTime` (5m) for efficient caching.
    *   **Safe Fallbacks**: All API-driven UI includes a `MOCK_DATA` fallback to maintain a functional UI if the backend is unavailable.

### 3. Feature Capabilities
*   **Admin Dashboard**:
    *   Real-time analytics using **Recharts**.
    *   Candidate Management table with filtering by Gender, Department, and Skill.
    *   Stat Cards derived from API summary counters.
*   **Candidate Dashboard**:
    *   Dynamic skill loading from `GET /skills`.
    *   Recursive `SkillModal` for technology and proficiency level selection.
    *   Visual pulse indicators for assessment readiness.
*   **Coding Assessment (Alpha)**:
    *   Split-pane layout separating "Problem Description" from "Code Editor".
    *   Mock proctoring logic and timed evaluation status.

---

## 🛠️ Environment Setup

Create `.env.local` in the `frontend` root:
```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🏃 Getting Started

```bash
# 1. Install
npm install

# 2. Run Dev
npm run dev
```

## 📜 Development Rules
1. **API**: Never call `axios` or `fetch` in components; use services in `features/<module>/service.ts`.
2. **State**: Prefer `local state` for UI toggles, and `Zustand` for global user session. Use `React Query` for all server data.
3. **Styles**: Use Tailwind v4 primary classes. Maintain the **Indium Orange** (`#f97316`) theme consistency.
