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
  throw new Error("SSO is not configured on the backend.");
};

export const logout = async (): Promise<void> => {
  useUserStore.getState().clear();
  window.location.href = "/auth/login";
};
