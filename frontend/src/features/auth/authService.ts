import axiosInstance from "../../api/axiosInstance";
import useUserStore from "../../stores/userStore";
import type { User } from "../../types/user";

type LoginResponse = User;

export const loginWithCredentials = async (
  email: string,
  password: string,
): Promise<User> => {
  const response = await axiosInstance.post<LoginResponse>("/auth/login", {
    email,
    password,
  });

  const user = response.data;
  useUserStore.getState().setUser(user);

  return user;
};

export const loginWithSSO = async (): Promise<User> => {
  // --- TEMPORARY: REMOVE WHEN REAL SSO IS READY ---
  // Simulate async SSO flow so UI/loading logic behaves like production.
  await Promise.resolve();

  // --- TEMPORARY: REMOVE WHEN REAL SSO IS READY ---
  // Change role to "admin" here to verify admin route handling.
  const user: User = {
    id: "1",
    name: "Test User",
    role: "candidate",
    department: "Engineering",
    token: "dummy-sso-token-12345",
  };

  useUserStore.getState().setUser(user);
  return user;
};

export const logout = async (): Promise<void> => {
  useUserStore.getState().clear();
  window.location.href = "/auth/login";
};
