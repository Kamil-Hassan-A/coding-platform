# Internal Assessment Platform — Frontend

## Project Overview

A modern, high-performance internal assessment platform built for Indium Software. This frontend application provides a secure login interface (supporting both credentials and Microsoft SSO), role-based routing (Admin vs. Candidate), and a rich Admin Dashboard featuring real-time data visualization of employee assessment statistics.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.4 | Core UI library |
| **Vite** | 8.0.1 | Next-generation frontend build tool |
| **TypeScript** | 5.9.3 | Static typing for enterprise-grade reliability |
| **Zustand** | 5.0.12 | Lightweight, persisted state management |
| **React Router DOM** | 7.13.1 | Declarative, client-side routing |
| **Axios** | 1.13.6 | Promise-based HTTP client with interceptors |
| **Recharts**| 3.8.0 | Composable charting library for data visualization |
| **Tailwind CSS** | 4.2.2 | Utility-first CSS framework (v4) |
| **Lucide React** | 0.577.0 | Beautiful & consistent icon library |
| **Zustand Persist** | — | Automatic localStorage session persistence |

## Project Structure (Key Directories)

```text
src/
├── App.tsx                   # Root component rendering AppRoutes
├── main.tsx                  # Application entry point & provider setup
├── index.css                 # Global styles and Tailwind v4 configuration
├── components/
│   └── layout/
│       └── Sidebar.tsx       # Reusable, configurable side navigation
├── features/
│   ├── admin/
│   │   ├── AdminDashboard.tsx # Comprehensive admin view (Recharts)
│   │   └── Dashboard.tsx      # Filterable stats & candidate table
│   ├── assessment/
│   │   ├── AssessmentPage.tsx # Main entry for coding assessments
│   │   ├── components/        # Editor, ProblemPanel, TestCases, Toolbar
│   │   ├── hooks/             # useEditor (In-progress)
│   │   ├── services/          # assessmentService (API logic)
│   │   └── types/             # assessment.ts (Core types)
│   ├── auth/
│   │   ├── Login.tsx          # Login page (Credentials + Mock SSO)
│   │   ├── authService.ts     # Auth logic & dynamic role switching
│   │   └── ProtectedRoute.tsx # Route guard for role-based access
│   ├── candidate/
│   │   └── CandidateDashboard.tsx # Dash with sidebar & skill selection
│   └── dashboard/
│       └── (Merged into Admin/Candidate dashboards)
├── routes/
│   └── AppRoutes.tsx         # Central routing configuration
├── stores/
│   └── userStore.ts          # Zustand store for user session
└── types/
    └── user.ts               # User and UserRole definitions
```

## Core Logic & Context

### 1. Authentication & Session Management
- **Persistence**: User accounts are stored in `userStore.ts` using Zustand's `persist` middleware.
- **Dynamic Role Switching**: `authService.ts` supports testing different personas by reading from `localStorage.getItem("test_role")`. If nothing is set, it defaults to **"admin"**.
- **Axios Interceptor**: `axiosInstance.ts` injects the current JWT into all outgoing requests.

### 2. Layout & Reusable Side Navigation
- **Sidebar Component**: Centralized in `src/components/layout/Sidebar.tsx`, this component handles the side-nav branding, icons, and active-state highlighting.
- **Unified Look**: Both Admin and Candidate dashboards now utilize the same `Sidebar` component with unique menu configurations (`NAV` vs `CANDIDATE_MENU`).
- **Profile Head**: Both dashboards include a professional user profile section in the top-right header with a functional **Logout** dropdown.

### 3. Feature Modules
- **Admin Dashboard**: Advanced analytics via **Recharts** (Pass/Fail Breakdown, Skill Density) and a searchable candidate management table.
- **Candidate Assessment**: A work-in-progress module (`/assessment`) designed for hands-on coding. It is scaffolded with a split-pane layout to support a Monaco-based editor, problem description, and test case results.

## Environment Configuration

Create a `.env.local` file in the root directory:
```env
VITE_API_BASE_URL=http://localhost:8000
```

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Run development server**:
    ```bash
    npm run dev
    ```

## Development Patterns
- **Styles**: Mix of Tailwind CSS (v4) and inline React styles for layout precision.
- **Icons**: Sourced from `lucide-react`.
- **API**: Always use `axiosInstance`.
