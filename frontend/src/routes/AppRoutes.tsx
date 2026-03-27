import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ErrorBoundary from "../components/layout/ErrorBoundary";
import ProtectedRoute from "../features/auth/ProtectedRoute";

const Login = lazy(() => import("../features/auth/Login"));
const AdminDashboard = lazy(() => import("../features/admin/AdminDashboard"));
const CandidateDashboard = lazy(() => import("../features/candidate/CandidateDashboard"));
const AssessmentPage = lazy(() => import("../features/assessment/AssessmentPage"));
const PastScores = lazy(() => import("../features/assessment/PastScores"));

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-admin-bg font-['Segoe_UI',sans-serif]">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-admin-orange/30 border-t-admin-orange"></div>
      <div className="text-sm font-semibold text-admin-text-muted">Loading app...</div>
    </div>
  </div>
);

const AppRoutes = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute allowedRoles={["candidate"]} />}>
            <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
            <Route path="/candidate/assessment" element={<AssessmentPage />} />
            <Route path="/candidate/scores" element={<PastScores />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default AppRoutes;
