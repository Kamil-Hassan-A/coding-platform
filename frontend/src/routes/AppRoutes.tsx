import { Navigate, Route, Routes } from "react-router-dom";

import Login from "../features/auth/Login";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import Dashboard from "../features/dashboard/Dashboard";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth/login" element={<Login />} />

      <Route element={<ProtectedRoute allowedRoles={["candidate"]} />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
