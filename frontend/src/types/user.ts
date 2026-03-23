export type UserRole = "candidate" | "admin";

export type User = {
  id: string | null;
  name: string | null;
  role: UserRole | null;
  token: string | null;
  department: string | null;
};
