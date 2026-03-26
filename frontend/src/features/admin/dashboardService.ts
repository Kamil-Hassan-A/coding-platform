import axiosInstance from "../../api/axiosInstance";

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

export const SKILLS: Skill[] = [
  { id: 1, name: "Agile", category: "Process", tag: "pm" },
  { id: 2, name: "HTML, CSS, JS", category: "Frontend", tag: "fe" },
  { id: 3, name: "React JS", category: "Frontend", tag: "fe" },
  { id: 4, name: "React JS with Redux", category: "Frontend", tag: "fe" },
  { id: 5, name: "TypeScript", category: "Frontend", tag: "fe" },
  { id: 6, name: "Next JS", category: "Frontend", tag: "fe" },
  { id: 7, name: "Angular", category: "Frontend", tag: "fe" },
  { id: 8, name: "Python with Flask", category: "Backend", tag: "be" },
  { id: 9, name: "Python with Django", category: "Backend", tag: "be" },
  { id: 10, name: "Python for Data Science", category: "Backend", tag: "be" },
  { id: 11, name: "Java", category: "Backend", tag: "be" },
  { id: 12, name: "Java Springboot", category: "Backend", tag: "be" },
  { id: 13, name: ".NET, C#", category: "Backend", tag: "be" },
  { id: 14, name: ".NET, VB.NET", category: "Backend", tag: "be" },
  { id: 15, name: "SQL", category: "Database", tag: "db" },
  { id: 16, name: "MongoDB", category: "Database", tag: "db" },
  { id: 17, name: "PostgreSQL DB", category: "Database", tag: "db" },
  { id: 18, name: "Java Selenium", category: "QA", tag: "qa" },
  { id: 19, name: "Python Selenium", category: "QA", tag: "qa" },
];

type TagConfig = {
  label: string;
  style: CSSProperties;
};

export const TAG_CONFIG: Record<SkillTag, TagConfig> = {
  fe: { label: "Frontend", style: { background: "#fff7ed", color: "#c2410c" } },
  be: { label: "Backend", style: { background: "#f0fdf4", color: "#15803d" } },
  db: { label: "Database", style: { background: "#eff6ff", color: "#1d4ed8" } },
  qa: { label: "QA", style: { background: "#fdf2f8", color: "#9d174d" } },
  pm: { label: "Process", style: { background: "#f5f3ff", color: "#6d28d9" } },
};

export const CATEGORIES: Array<"All" | SkillCategory> = [
  "All",
  "Frontend",
  "Backend",
  "Database",
  "QA",
  "Process",
];

type StatCard = {
  key: keyof DashboardStats;
  label: string;
};

export const STAT_CARDS: StatCard[] = [
  { key: "totalEmployees", label: "Total Employees" },
  { key: "totalAssessments", label: "Total Assessments" },
  { key: "inProgress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "terminated", label: "Terminated" },
  { key: "pendingReview", label: "Pending Review" },
];

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await axiosInstance.get<DashboardStats>("/admin/stats");
  return response.data;
};

export const getAdminCandidates = async (): Promise<AdminCandidate[]> => {
  const response = await axiosInstance.get<{ candidates: AdminCandidate[] }>("/admin/candidates");
  return response.data.candidates;
};

export const getAdminCredentials = async (): Promise<AdminCredential[]> => {
  const response = await axiosInstance.get<{ credentials: AdminCredential[] }>("/admin/credentials");
  return response.data.credentials;
};
