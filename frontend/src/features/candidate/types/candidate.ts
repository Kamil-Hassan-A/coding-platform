export type BackendLevel =
  | "beginner"
  | "intermediate_1"
  | "intermediate_2"
  | "specialist_1"
  | "specialist_2";

export type CandidateScreen = "home" | "confirmed" | "past_assessments";

export type AllowedLanguage = {
  id: number;
  name: string;
  monaco: string;
};

export type Skill = {
  skill_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  allowed_languages: AllowedLanguage[];
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

export type SkillWithProgress = Skill & {
  levels: ProgressLevel[];
};

export type CandidateSelection = {
  skill: string;
  levelLabel: string;
  allowedLanguages: AllowedLanguage[];
};

export type CandidateSelectionIds = {
  skill_id: string;
  level: BackendLevel;
};

export type HomeStartData = {
  skill: string;
  level: BackendLevel;
  levelLabel: string;
  skill_id: string;
};

export type HomeScreenProps = {
  skillsList: SkillWithProgress[];
  onStart: (data: HomeStartData) => void;
};

export type ConfirmedScreenProps = {
  confirmed: CandidateSelection;
  onChangeSkill: () => void;
  onBegin: () => void;
  isStarting: boolean;
};

export type LevelOption = {
  id: string;
  label: string;
  desc: string;
  color: string;
};

export type SkillModalProps = {
  skills: Skill[];
  levels: LevelOption[];
  onClose: () => void;
  onConfirm: (
    skill_name: string,
    level_label: string,
    skill_id: string,
    level: BackendLevel,
  ) => void;
};
