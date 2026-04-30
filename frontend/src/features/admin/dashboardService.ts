import axiosInstance from "../../api/axiosInstance";

import type {
  AdminCandidate,
  AdminCredential,
  DashboardStats,
  Skill,
  SkillCategory,
  SkillTag,
  StatCard,
  TagConfig,
} from "./types/admin";

export type {
  AdminCandidate,
  AdminCredential,
  DashboardStats,
  Skill,
  SkillCategory,
  SkillTag,
} from "./types/admin";

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
