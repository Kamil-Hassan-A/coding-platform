import { Navigate, Outlet } from "react-router-dom";

import useUserStore from "../../stores/userStore";
import type { ProtectedRouteProps } from "./types/auth";

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const token = useUserStore((state) => state.token);
  const role = useUserStore((state) => state.role);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
