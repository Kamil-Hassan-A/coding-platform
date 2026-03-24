import axiosInstance from "../../api/axiosInstance";
import useUserStore from "../../stores/userStore";
import type { User, UserRole } from "../../types/user";

type LoginResponse = {
  access_token: string;
  expires_in: number;
  user: {
    user_id: number;
    role: string;
    name: string;
    email: string;
  };
};

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
    id: backendUser.user_id.toString(),
    name: backendUser.name,
    role: isValidRole(backendUser.role) ? backendUser.role : "candidate",
    department: "N/A",
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
    : "admin";

  const user: User = {
    id: "1",
    name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    role,
    department: role === "admin" ? "Engineering" : "Candidate Relations",
    token: "dummy-sso-token-12345",
  };

  useUserStore.getState().setUser(user);
  return user;
};

export const logout = async (): Promise<void> => {
  useUserStore.getState().clear();
  window.location.href = "/auth/login";
};
