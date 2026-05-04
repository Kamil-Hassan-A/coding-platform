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
  latest_session_id?: string | null;
  latest_skill_name?: string | null;
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

export type AdminCandidateFilters = {
  employeeId?: string;
  yearsMin?: number | null;
  yearsMax?: number | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
};

export type Skill = {
  id: number;
  name: string;
  category: string;
  tag: string;
};

export type SkillCategory = {
  id: number;
  name: string;
};

export type SkillTag = "fe" | "be" | "db" | "qa" | "pm";

export type StatCard = {
  label: string;
  value: string | number;
  sub?: string;
};

export type TagConfig = {
  label: string;
  style: {
    background: string;
    color: string;
  };
};
