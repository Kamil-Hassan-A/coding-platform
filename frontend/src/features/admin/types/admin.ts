import type { CSSProperties } from "react";

export type SkillTag = "fe" | "be" | "db" | "qa" | "pm";

export type SkillCategory =
  | "Frontend"
  | "Backend"
  | "Database"
  | "QA"
  | "Process";

export type Skill = {
  id: number;
  name: string;
  category: SkillCategory;
  tag: SkillTag;
};

export type DashboardStats = {
  totalEmployees: number;
  totalAssessments: number;
  inProgress: number;
  completed: number;
  terminated: number;
  pendingReview: number;
};

export type AdminCandidate = {
  user_id: string;
  name: string;
  gender: string;
  dept: string;
  skill: string;
  score: number;
  status: "Pass" | "Fail" | "Pending";
};

export type AdminCredential = {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  expIndium: number;
  expOverall: number;
  verifiedSkills: string[];
  status: "Active" | "Inactive";
};

export type TagConfig = {
  label: string;
  style: CSSProperties;
};

export type StatCard = {
  key: keyof DashboardStats;
  label: string;
};

export type CategoryFilter = "All" | SkillCategory;

export type SortKey = keyof AdminCredential;

export type SortOrder = "asc" | "desc";

export type SkillCardProps = {
  skill: Skill;
};
