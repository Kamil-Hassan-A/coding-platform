import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";

import useUserStore from "../../stores/userStore";
import type { ProtectedRouteProps } from "./types/auth";

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const token = useUserStore((state) => state.token);
  const role = useUserStore((state) => state.role);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) return null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
