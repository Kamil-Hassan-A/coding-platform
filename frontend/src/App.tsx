/**
 * App.tsx — Updated routing with RoleSelection gate
 *
 * Place this file at: src/App.tsx
 * Make sure to install react-router-dom if not already:  npm install react-router-dom
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Auth & Role gate
import RoleSelection from "./features/auth/RoleSelection";
import Login from "./features/auth/Login";

// Admin pages
import AdminDashboard from "./features/admin/AdminDashboard";
import Dashboard from "./features/admin/Dashboard";
import CredentialsPage from "./features/admin/CredentialsPage";   // ← NEW
import SkillsList from "./features/admin/SkillsList";
import SkillDetail from "./features/admin/SkillDetail";

// Candidate / Assessment pages
import CandidateDashboard from "./features/candidate/CandidateDashboard";
import Editor from "./features/assessment/components/Editor"; // your existing layout
import PastScores from "./features/assessment/PastScores";  // ← NEW

export default function App() {
  return (
      <Routes>

        {/* ── 1. ROLE SELECTION ─────────────────────────────────────────── */}
        {/* This is the first page the user sees before any auth/role split  */}
        <Route path="/" element={<RoleSelection />} />
        <Route path="/login" element={<Login />} />

        {/* ── 2. ADMIN ROUTES ───────────────────────────────────────────── */}
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="credentials"  element={<CredentialsPage />} />  {/* ← NEW */}
          <Route path="skills"       element={<SkillsList />} />
          <Route path="skills/:id"   element={<SkillDetail />} />
          {/* Add your other existing admin routes here */}
        </Route>

        {/* ── 3. CANDIDATE / ASSESSMENT ROUTES ─────────────────────────── */}
        <Route path="/candidate">
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"  element={<CandidateDashboard />} />
          <Route path="assessment" element={<Editor />} />
          <Route path="scores"     element={<PastScores />} />
        </Route>

        {/* ── 4. FALLBACK ───────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
  );
}

/**
 * HOW TO WIRE THE SIDEBAR LINKS
 * ─────────────────────────────
 * In Sidebar.tsx (admin), add a nav item for Credentials:
 *
 *   { label: "Credentials", path: "/admin/credentials", icon: <IdCardIcon /> }
 *
 * In the candidate assessment tab bar, add a "Past Scores" tab:
 *
 *   { label: "Past Scores", path: "/candidate/scores" }
 *
 * Or if you're using tab state instead of routes for the assessment view:
 *
 *   {activeTab === "past-scores" && <PastScores />}
 */
