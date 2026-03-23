# Internal Assessment Platform — Frontend

## Project Overview

Internal assessment platform built for Indium Software. Provides a login interface (credentials + Microsoft SSO), role-based routing (candidate vs admin), and an admin dashboard displaying employee assessment statistics and a filterable skills catalogue.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.4 | UI framework |
| React DOM | 19.2.4 | DOM rendering |
| TypeScript | 5.9.3 | Type safety |
| Vite | 8.0.1 | Build tool / dev server |
| React Router DOM | 7.13.1 | Client-side routing |
| Zustand | 5.0.12 | State management (persisted) |
| Axios | 1.13.6 | HTTP client |
| TanStack React Query | 5.91.3 | Server state / data fetching |
| Tailwind CSS | 4.2.2 | Utility CSS (used in `index.css`, not in auth pages) |
| @tailwindcss/vite | 4.2.2 | Vite Tailwind plugin |
| @vitejs/plugin-react | 6.0.1 | React Fast Refresh for Vite |
| clsx | 2.1.1 | Conditional class utility |
| tailwind-merge | 3.5.0 | Tailwind class deduplication |
| class-variance-authority | 0.7.1 | Component variant API |
| lucide-react | 0.577.0 | Icon library |
| radix-ui | 1.4.3 | Accessible UI primitives |
| shadcn / shadcn-ui | 4.1.0 / 0.9.5 | Component scaffolding |
| tw-animate-css | 1.4.0 | Tailwind animation utilities |
| @fontsource-variable/geist | 5.2.8 | Geist font |

## Project Structure

```
src/
├── App.tsx                       # Root component, renders AppRoutes
├── main.tsx                      # Entry point: React.StrictMode, QueryClientProvider, BrowserRouter
├── index.css                     # Global styles and Tailwind imports
├── api/
│   └── axiosInstance.ts          # Axios instance with auth header injection and 401 handling
├── features/
│   ├── auth/
│   │   ├── Login.tsx             # Login page (credentials + SSO, inline-styled)
│   │   ├── SSOButton.tsx         # Microsoft SSO button component (inline-styled)
│   │   ├── ProtectedRoute.tsx    # Route guard — checks token + role, redirects if unauthorized
│   │   └── authService.ts       # loginWithCredentials, loginWithSSO (mocked), logout
│   └── dashboard/
│       ├── Dashboard.tsx         # Admin dashboard with nav, stat cards, skills list
│       ├── SkillCard.tsx         # Individual skill card with hover effect + category tag
│       ├── SkillsList.tsx        # Filterable skills grid with category tabs
│       └── dashboardService.ts   # Types, constants (SKILLS, STAT_CARDS), getDashboardStats (mocked)
├── lib/
│   └── utils.ts                  # cn() helper combining clsx and tailwind-merge
├── routes/
│   └── AppRoutes.tsx             # All route definitions with protected route wrappers
├── stores/
│   └── userStore.ts              # Zustand store with persist middleware for user session
└── types/
    └── user.ts                   # User and UserRole type definitions

public/
├── assets/
│   └── login-bg.png              # Login background image (currently unused after redesign)
├── indium-logo.png               # Dark background variant — used in dashboard navbar
└── indium-logo2.png              # Light background variant — used in login card
```

## Auth Flow

1. **Login page** (`/auth/login`) renders a form with username/password fields and a Microsoft SSO button.

2. **Credential login** — `handleCredentialLogin` calls `authService.loginWithCredentials(email, password)`, which POSTs to `/auth/login` via the Axios instance. On success, the returned `User` object (containing `id`, `name`, `role`, `department`, `token`) is stored in Zustand via `useUserStore.getState().setUser(user)`.

3. **SSO login** — `handleSSOLogin` calls `authService.loginWithSSO()`. **Currently mocked** — returns a hardcoded test user with a dummy token instead of performing a real SSO flow.

4. **JWT storage** — The Zustand `userStore` uses `persist` middleware, which serializes the entire store (including `token`) to `localStorage` under the key `"user-store"`. The token is therefore available across page refreshes.

5. **Auth header injection** — `axiosInstance` has a request interceptor that reads `useUserStore.getState().token` and attaches it as `Authorization: Bearer <token>` to every outgoing request.

6. **Route protection** — `ProtectedRoute` checks `token` and `role` from the store:
   - No token → redirect to `/auth/login`
   - Token exists but role not in `allowedRoles` → redirect to `/auth/login`
   - Otherwise → render child routes via `<Outlet />`

7. **401 handling** — `axiosInstance` has a response interceptor. On a 401 response, it clears the user store and redirects to `/auth/login`.

8. **Post-login redirect** — After successful login, the user is navigated by role: `admin` → `/admin/dashboard`, all others → `/dashboard`.

9. **Logout** — calls `useUserStore.getState().clear()`, which resets the store to `initialState` (all `null`), then redirects to `/auth/login` via `window.location.href`. The persisted localStorage is also cleared by Zustand's persist middleware.

## State Management

**Store:** `userStore.ts` — Zustand store with `persist` middleware.

**Shape:**
```typescript
type UserStore = {
  id: string | null;
  name: string | null;
  role: "candidate" | "admin" | null;
  token: string | null;
  department: string | null;
  setUser: (user: User) => void;
  clear: () => void;
};
```

**Initial state:** All fields are `null`.

**Persistence:** Uses Zustand's `persist` middleware with storage key `"user-store"`. Defaults to `localStorage`. The entire store is serialized/deserialized automatically.

**Actions:**
- `setUser(user)` — spreads the `User` object into the store (sets id, name, role, token, department)
- `clear()` — resets all fields to `null` (initial state)

**Usage pattern:**
- Inside React components: `useUserStore((state) => state.field)` (selector pattern)
- Outside React components (services, interceptors): `useUserStore.getState().method()`

## API Layer

**File:** `src/api/axiosInstance.ts`

**Setup:**
- Creates an Axios instance with `baseURL` set from `import.meta.env.VITE_API_BASE_URL`

**Request interceptor:**
- Reads `token` from `useUserStore.getState()`
- If `token` exists, sets `Authorization: Bearer <token>` header on the outgoing request

**Response interceptor:**
- On 401 responses: clears the user store (`useUserStore.getState().clear()`) and redirects to `/auth/login` via `window.location.href` (hard redirect, not React Router)
- All other errors are passed through via `Promise.reject(error)`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes | Base URL for all API requests (e.g. `http://localhost:8000`) |

Create a `.env.local` file at the project root:
```
VITE_API_BASE_URL=http://localhost:8000
```

## How to Run Locally

```bash
# 1. Clone the repository
git clone <repo-url>
cd frontend

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.local.example .env.local
# Or manually create .env.local with:
# VITE_API_BASE_URL=http://localhost:8000

# 4. Start the dev server
npm run dev

# 5. Open in browser
# Default: http://localhost:5173
```

**Other commands:**
```bash
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview the production build locally
```

## Pages & Routes

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/auth/login` | `Login` | Public | Login page with credentials + SSO |
| `/dashboard` | `Dashboard` | `candidate` | Candidate dashboard |
| `/admin/dashboard` | `Dashboard` | `admin` | Admin dashboard |
| `*` (catch-all) | `Navigate` → `/auth/login` | All | Redirects unknown routes to login |

## Temporary/Mock Items to Replace Before Production

| # | File | Line(s) | What It Does | What to Replace With |
|---|------|---------|-------------|---------------------|
| 1 | `authService.ts` | 22–38 | `loginWithSSO()` returns a hardcoded mock user with `"dummy-sso-token-12345"` | Real Microsoft SSO/OAuth flow (MSAL or redirect-based) |
| 2 | `authService.ts` | 23, 27 | TEMPORARY comments marking the mock | Remove once real SSO is implemented |
| 3 | `dashboardService.ts` | 86–99 | `getDashboardStats()` returns zeroed-out stats object | Uncomment the API call: `axiosInstance.get<DashboardStats>("/admin/stats")` |

## Teammate Integration Notes

### For the Dashboard Team

1. **Dashboard component** is at `src/features/dashboard/Dashboard.tsx`. It uses inline styles—no Tailwind classes.

2. **Skills data** is hardcoded in `dashboardService.ts` (`SKILLS` array, 19 items). When the backend is ready, replace with an API call.

3. **Stat cards** use `STAT_CARDS` config from `dashboardService.ts` and `getDashboardStats()`. The API call is commented out—uncomment and remove the mock return when the backend `/admin/stats` endpoint is available.

4. **User data** (name, role, department) is read from `useUserStore` via selectors. Always use the selector pattern inside components: `useUserStore((state) => state.field)`.

5. **API calls** should go through `axiosInstance` (from `src/api/axiosInstance.ts`), which auto-injects the Bearer token and handles 401 redirects.

6. **Data fetching** uses TanStack React Query. Wrap async API calls in `useQuery` with a descriptive `queryKey`.

7. **The `/admin/dashboard` route** renders the same `Dashboard` component as `/dashboard`. Both candidate and admin roles see the same dashboard.

8. **Protected routes** use `<ProtectedRoute allowedRoles={[...]} />` as a wrapper. Add new protected routes inside the existing `<Route element={<ProtectedRoute>}>` blocks based on required role.

9. **Adding new routes:** Import your component in `AppRoutes.tsx` and add a `<Route>` inside the appropriate `ProtectedRoute` wrapper.

10. **Type safety:** The `User` type is defined in `src/types/user.ts`. Extend it there if you need additional user fields.
