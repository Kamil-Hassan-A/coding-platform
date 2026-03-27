import type { UserRole } from "../../../types/user";

export type LoginResponse = {
  access_token: string;
  expires_in: number;
  user: {
    user_id: string;
    role: string;
    name: string;
    email: string;
    department?: string | null;
  };
};

export type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
};

export type SSOButtonProps = {
  onClick: () => void;
  loading: boolean;
};
