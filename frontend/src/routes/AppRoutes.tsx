import { Navigate, Route, Routes } from "react-router-dom";

import RoleSelection from "../features/auth/RoleSelection";
import Login from "../features/auth/Login";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import AdminDashboard from "../features/admin/AdminDashboard";
import CandidateDashboard from "../features/candidate/CandidateDashboard";
import AssessmentPage from "../features/assessment/AssessmentPage";
import PastScores from "../features/assessment/PastScores";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<RoleSelection />} />
      <Route path="/login" element={<Login />} />
      <Route path="/assessment" element={<AssessmentPage />} />

      <Route element={<ProtectedRoute allowedRoles={["candidate"]} />}>
        <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
        <Route path="/candidate/assessment" element={<AssessmentPage />} />
        <Route path="/candidate/scores" element={<PastScores />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
