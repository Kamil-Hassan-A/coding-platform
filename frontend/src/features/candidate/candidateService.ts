import axiosInstance from "../../api/axiosInstance";

export type Skill = {
  skill_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
};

export const getSkills = async (): Promise<Skill[]> => {
  const response = await axiosInstance.get<Skill[]>("/skills");
  return response.data;
};
