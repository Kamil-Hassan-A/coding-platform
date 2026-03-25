export type UserRole = "candidate" | "admin";

export type UserLevel = "Beginner" | "Intermediate 1" | "Intermediate 2" | "Specialist 1" | "Specialist 2";

export type User = {
  id: string | null;
  name: string | null;
  role: UserRole | null;
  level?: UserLevel | null;
  token: string | null;
  department: string | null;
};
