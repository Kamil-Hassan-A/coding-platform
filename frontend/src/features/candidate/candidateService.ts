import axiosInstance from "../../api/axiosInstance";

export type Skill = {
  skill_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
};

export type ProgressLevel = {
  level: string;
  label: string;
  unlocked: boolean;
  cleared: boolean;
  attempts_used: number;
  attempts_remaining: number;
};

export type SkillProgress = {
  skill_id: string;
  skill_name: string;
  levels: ProgressLevel[];
};

export const getSkills = async (): Promise<Skill[]> => {
  const response = await axiosInstance.get<Skill[]>("/skills");
  return response.data;
};

export const getUserProgress = async (): Promise<SkillProgress[]> => {
  const response = await axiosInstance.get<SkillProgress[]>("/user/progress");
  return response.data;
};
