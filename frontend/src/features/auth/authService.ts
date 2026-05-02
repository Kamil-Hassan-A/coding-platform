import axiosInstance from "../../api/axiosInstance";
import useUserStore from "../../stores/userStore";
import type { User, UserRole } from "../../types/user";
import type { LoginResponse } from "./types/auth";

export const loginWithCredentials = async (
  email: string,
  password: string,
): Promise<User> => {
  const response = await axiosInstance.post<LoginResponse>("/auth/login", {
    email,
    password,
  });

  const { access_token, user: backendUser } = response.data;

  const isValidRole = (role: string): role is UserRole => {
    return role === "admin" || role === "candidate";
  };

  const user: User = {
    id: backendUser.user_id,
    name: backendUser.name,
    role: isValidRole(backendUser.role) ? backendUser.role : "candidate",
    department: backendUser.department ?? "N/A",
    token: access_token,
  };

  useUserStore.getState().setUser(user);

  return user;
};

export const loginWithSSO = async (): Promise<User> => {
  // --- TEMPORARY: REMOVE WHEN REAL SSO IS READY ---
  // Simulate async SSO flow so UI/loading logic behaves like production.
  await Promise.resolve();

  // --- TEMPORARY: REMOVE WHEN REAL SSO IS READY ---
  // Read role from localStorage for testing (defaults to "admin")
  const storedRole = localStorage.getItem("test_role");
  const role: UserRole = (storedRole === "admin" || storedRole === "candidate") 
    ? storedRole
    : "candidate";

  // For dev SSO, exchange role for known seeded credentials so token is always fresh.
  const creds =
    role === "admin"
      ? { email: "admin@example.com", password: "AdminPass123!" }
      : { email: "candidate@example.com", password: "Passw0rd!" };

  const user = await loginWithCredentials(creds.email, creds.password);
  localStorage.removeItem("test_role");
  return user;
};

export const logout = async (): Promise<void> => {
  useUserStore.getState().clear();
  window.location.href = "/";
};
