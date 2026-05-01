import axiosInstance from "../../api/axiosInstance";

import type { AdminCandidate, AdminCandidateFilters, DashboardStats } from "./types/admin";

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await axiosInstance.get<DashboardStats>("/admin/stats");
  return response.data;
};

export const getAdminCandidates = async (filters?: AdminCandidateFilters): Promise<AdminCandidate[]> => {
  const params: Record<string, string | number> = {};

  if (filters?.employeeId && filters.employeeId.trim() !== "") {
    params.employee_id = filters.employeeId.trim();
  }
  if (filters?.yearsMin !== null && filters?.yearsMin !== undefined) {
    params.years_min = filters.yearsMin;
  }
  if (filters?.yearsMax !== null && filters?.yearsMax !== undefined) {
    params.years_max = filters.yearsMax;
  }
  if (filters?.experienceMin !== null && filters?.experienceMin !== undefined) {
    params.exp_min = filters.experienceMin;
  }
  if (filters?.experienceMax !== null && filters?.experienceMax !== undefined) {
    params.exp_max = filters.experienceMax;
  }

  const response = await axiosInstance.get<{ candidates: AdminCandidate[] }>("/admin/candidates", {
    params,
  });
  return response.data.candidates;
};

