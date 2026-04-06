import axiosInstance from "../../api/axiosInstance";
import type { CandidateBadge, Skill, SkillProgress } from "./types/candidate";

export type {
  CandidateBadge,
  ProgressLevel,
  Skill,
  SkillProgress,
} from "./types/candidate";

export const getSkills = async (): Promise<Skill[]> => {
  const response = await axiosInstance.get<Skill[]>("/skills");
  return response.data;
};

export const getUserProgress = async (): Promise<SkillProgress[]> => {
  const response = await axiosInstance.get<SkillProgress[]>("/user/progress");
  return response.data;
};

export const getUserBadges = async (): Promise<CandidateBadge[]> => {
  const response = await axiosInstance.get<CandidateBadge[]>("/user/badges");
  return response.data;
};
