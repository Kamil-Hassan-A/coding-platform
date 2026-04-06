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

  const user: User = {
    id: role === "candidate" ? "b150f408-9876-454b-ba44-6317179698d6" : "6f2f373d-aaa3-4472-a0e2-b3ecd9806d3d",
    name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    role,
    level: role === "candidate" ? "Beginner" : null,
    department: role === "admin" ? "Engineering" : "Candidate Relations",       
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiMTUwZjQwOC05ODc2LTQ1NGItYmE0NC02MzE3MTc5Njk4ZDYiLCJleHAiOjE3NzU0ODAzNTQsInJvbGUiOiJjYW5kaWRhdGUiLCJuYW1lIjoiVGVzdCBDYW5kaWRhdGUiLCJlbWFpbCI6ImNhbmRpZGF0ZUBleGFtcGxlLmNvbSJ9.yYKvmGPMCbFs3Nyk1nOoRTjl8_HfaE1IqlSM0wjlzig",
  };

  useUserStore.getState().setUser(user);
  localStorage.removeItem("test_role");
  return user;
};

export const logout = async (): Promise<void> => {
  useUserStore.getState().clear();
  window.location.href = "/";
};
