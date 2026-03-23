import { Navigate, Route, Routes } from "react-router-dom";

import Login from "../features/auth/Login";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import AdminDashboard from "../features/admin/AdminDashboard";
import CandidateDashboard from "../features/candidate/CandidateDashboard";
import AssessmentPage from "../features/assessment/AssessmentPage";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth/login" element={<Login />} />

      <Route element={<ProtectedRoute allowedRoles={["candidate"]} />}>
        <Route path="/dashboard" element={<CandidateDashboard />} />
        <Route path="/assessment" element={<AssessmentPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
