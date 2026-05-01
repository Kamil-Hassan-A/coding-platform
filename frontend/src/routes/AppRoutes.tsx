import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ErrorBoundary from "../components/ErrorBoundary";
import ProtectedRoute from "../features/auth/ProtectedRoute";

const Login = lazy(() => import("../features/auth/Login"));
const AdminDashboardOverview = lazy(() => import("../features/admin/screens/OverviewPage"));
const AdminCandidatesView = lazy(() => import("../features/admin/screens/CandidatesPage"));

const CandidateHomeScreen = lazy(() => import("../features/candidate/screens/DashboardPage"));
const CandidateBadgesScreen = lazy(() => import("../features/candidate/screens/BadgesPage"));
const CandidateInstructions = lazy(() => import("../features/candidate/screens/InstructionsPage"));
const ThankYouPage = lazy(() => import("../features/candidate/screens/ThankYouPage"));
const AssessmentPage = lazy(() => import("../features/assessment/AssessmentPage"));
const PastScores = lazy(() => import("../features/assessment/PastScoresPage"));

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-admin-bg font-['Segoe_UI',sans-serif]">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-admin-orange/30 border-t-admin-orange"></div>
      <div className="text-sm font-semibold text-admin-text-muted">Loading app...</div>
    </div>
  </div>
);

import DashboardLayout from "../components/layout/DashboardLayout";

const AppRoutes = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute allowedRoles={["candidate"]} />}>
            <Route path="/candidate" element={<DashboardLayout role="candidate" />}>
              <Route path="dashboard" element={<CandidateHomeScreen />} />
              <Route path="badges" element={<CandidateBadgesScreen />} />
              <Route path="scores" element={<PastScores />} />
            </Route>
            <Route path="/candidate/instructions" element={<CandidateInstructions />} />
            <Route path="/candidate/assessment" element={<AssessmentPage />} />
            <Route path="/candidate/thankyou" element={<ThankYouPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<DashboardLayout role="admin" />}>
              <Route path="dashboard" element={<AdminDashboardOverview />} />
              <Route path="candidates" element={<AdminCandidatesView />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default AppRoutes;
