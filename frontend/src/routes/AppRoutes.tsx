import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ErrorBoundary from "../components/ErrorBoundary";
import ProtectedRoute from "../features/auth/ProtectedRoute";

const Login = lazy(() => import("../features/auth/Login"));
const AdminDashboard = lazy(() => import("../features/admin/AdminDashboard"));
// const CandidateDashboard = lazy(() => import("../features/candidate/CandidateDashboard")); // Using DashboardLayout instead
// const ThankYouPage = lazy(() => import("../features/candidate/ThankYouPage")); // Using AssessmentThankYouPage instead
const OverviewPage = lazy(() => import("../features/admin/screens/OverviewPage"));
const CandidatesPage = lazy(() => import("../features/admin/screens/CandidatesPage"));

const DashboardPage = lazy(() => import("../features/candidate/screens/DashboardPage"));
const BadgesPage = lazy(() => import("../features/candidate/screens/BadgesPage"));
const InstructionsPage = lazy(() => import("../features/assessment/InstructionsPage"));
const AssessmentThankYouPage = lazy(() => import("../features/assessment/ThankYouPage"));
const AssessmentPage = lazy(() => import("../features/assessment/AssessmentPage"));
const AgileAnalysisPage = lazy(() => import("../features/assessment/AgileAnalysisPage"));
// const PastScores = lazy(() => import("../features/assessment/PastScores")); // Using PastScoresPage instead
const PastScoresPage = lazy(() => import("../features/candidate/screens/PastScoresPage"));

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
            <Route path="/candidate/dashboard" element={<DashboardLayout role="candidate" />}>
              <Route index element={<DashboardPage />} />
            </Route>
            <Route path="/candidate/assessment" element={<AssessmentPage />} />
            <Route path="/candidate/agile-analysis" element={<AgileAnalysisPage />} />
            <Route path="/candidate" element={<DashboardLayout role="candidate" />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="badges" element={<BadgesPage />} />
              <Route path="scores" element={<PastScoresPage />} />
            </Route>
            <Route path="/candidate/instructions" element={<InstructionsPage />} />
            <Route path="/candidate/assessment/:sessionId" element={<AssessmentPage />} />
            <Route path="/candidate/thankyou" element={<AssessmentThankYouPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<DashboardLayout role="admin" />}>
              <Route path="dashboard" element={<OverviewPage />} />
              <Route path="candidates" element={<CandidatesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default AppRoutes;
