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
  employee_id?: string;
  employeeId?: string;
  name: string;
  gender: string;
  dept: string;
  latest_session_id?: string | null;
  latest_skill_name?: string | null;
  exp_indium_years?: number;
  expIndium?: number;
  exp_overall_years?: number;
  expOverall?: number;
  skill: string;
  score: number;
  latest_submitted_at?: string | null;
  status: "Pass" | "Fail" | "Pending";
};
