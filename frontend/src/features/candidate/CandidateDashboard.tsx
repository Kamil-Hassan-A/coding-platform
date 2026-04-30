import { useMemo, useState } from "react";
import { Award, Clock, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Sidebar from "../../components/layout/Sidebar";
import useUserStore from "../../stores/userStore";
import BadgesScreen from "./BadgesScreen";
import PastAssessmentsScreen from "./PastAssessmentsScreen";
import { getSkills, getUserBadges, getUserProgress } from "./candidateService";
import type {
  BackendLevel,
  CandidateScreen,
  HomeScreenProps,
  SkillWithProgress,
} from "./types/candidate";
import { useStartSession } from "../assessment/hooks/useAssessment";

const CANDIDATE_MENU = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutGrid size={15} strokeWidth={2} /> },
  { id: "badges", label: "Badges", icon: <Award size={15} strokeWidth={2} /> },
  { id: "past_assessments", label: "Past Assessments", icon: <Clock size={15} strokeWidth={2} /> },
];

const LEVEL_META: Record<
  string,
  { label: string; desc: string; color: string }
> = {
  beginner: {
    label: "Beginner",
    desc: "Foundational concepts and basics",
    color: "#22c55e",
  },
  intermediate_1: {
    label: "Intermediate 1",
    desc: "Core proficiency with common patterns",
    color: "#3b82f6",
  },
  intermediate_2: {
    label: "Intermediate 2",
    desc: "Advanced problem solving and application",
    color: "#8b5cf6",
  },
  specialist_1: {
    label: "Specialist 1",
    desc: "Expert-level depth and architecture",
    color: "#f59e0b",
  },
  specialist_2: {
    label: "Specialist 2",
    desc: "Master-level execution and mentorship",
    color: "#E8620A",
  },
};

const resolveActiveMenu = (screen: CandidateScreen) => {
  if (screen === "past_assessments") return "past_assessments";
  if (screen === "badges") return "badges";
  return "dashboard";
};

const resolveScreenFromMenu = (id: string): CandidateScreen => {
  if (id === "past_assessments") return "past_assessments";
  if (id === "badges") return "badges";
  return "home";
};

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<CandidateScreen>("home");

  useStartSession();

  const {
    data: apiSkills,
    isLoading: isSkillsLoading,
    isError: isSkillsError,
  } = useQuery({
    queryKey: ["skills"],
    queryFn: getSkills,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
  });

  const {
    data: progress,
    isError: isProgressError,
  } = useQuery({
    queryKey: ["user-progress"],
    queryFn: getUserProgress,
    staleTime: 1000 * 60,
  });

  const {
    data: badges = [],
    isLoading: isBadgesLoading,
    isError: isBadgesError,
  } = useQuery({
    queryKey: ["user-badges"],
    queryFn: getUserBadges,
    staleTime: 0,
  });

  const skillsList: SkillWithProgress[] = useMemo(() => {
    const progressBySkill = new Map(
      (progress ?? []).map((item) => [item.skill_id, item.levels]),
    );
    return (apiSkills ?? []).map((skill) => ({
      ...skill,
      levels: progressBySkill.get(skill.skill_id) ?? [],
    }));
  }, [apiSkills, progress]);

  const handleConfirm = (
    skill: string,
    level: BackendLevel,
    levelLabel: string,
    skill_id: string,
  ) => {
    const skillObj = skillsList.find((s) => s.skill_id === skill_id);
    const selection = {
      skill,
      levelLabel,
      allowedLanguages: skillObj?.allowed_languages || [],
    };
    const selectionIds = { skill_id, level };

    navigate("/candidate/instructions", {
      state: {
        confirmed: selection,
        confirmedIds: selectionIds,
      },
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden font-['Segoe_UI',sans-serif]">
      <Sidebar
        items={CANDIDATE_MENU}
        active={resolveActiveMenu(screen)}
        onChange={(id) => setScreen(resolveScreenFromMenu(id))}
      />

      <main className="flex-1 overflow-y-auto bg-admin-bg px-6 py-10">
          <>
        {isSkillsLoading && (
          <div className="mt-10 text-left text-slate-500">
            Loading your skills...
          </div>
        )}

        {(isSkillsError || isProgressError) && (
          <div className="mx-auto max-w-[900px] rounded-xl border border-red-200 bg-rose-50 px-5 py-4 text-[14px] text-red-700">
            Failed to load dashboard data from backend. Please try again.
          </div>
        )}

        {screen === "home" ? (
          <HomeScreen
            isSkillsLoading={isSkillsLoading}
            skillsList={skillsList}
            onStart={(data) => {
              handleConfirm(
                data.skill,
                data.level,
                data.levelLabel,
                data.skill_id,
              );
            }}
          />
        ) : screen === "badges" ? (
          <BadgesScreen
            badges={badges}
            allSkillNames={skillsList.map((skill) => skill.name)}
            isBadgesLoading={isBadgesLoading}
            isBadgesError={isBadgesError}
          />
        ) : screen === "past_assessments" ? (
          <PastAssessmentsScreen />
        ) : null}
          </>
        </main>
    </div>
  );
}

function HomeScreen({ isSkillsLoading, skillsList, onStart }: HomeScreenProps & { isSkillsLoading: boolean }) {
  const user = useUserStore();
  const [search, setSearch] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<BackendLevel | null>(null);

  const filteredSkills = useMemo(
    () =>
      skillsList.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [skillsList, search],
  );

  const selectedSkill = useMemo(
    () => skillsList.find((item) => item.skill_id === selectedSkillId) ?? null,
    [skillsList, selectedSkillId],
  );

  const handleStart = () => {
    if (!selectedSkill || !selectedLevel) return;

    onStart({
      skill: selectedSkill.name,
      level: selectedLevel,
      levelLabel: LEVEL_META[selectedLevel]?.label ?? selectedLevel,
      skill_id: selectedSkill.skill_id,
    });
  };

  return (
    <div className="mx-auto w-full max-w-[900px] pb-14">
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-admin-orange to-orange-600 p-8 text-white shadow-[0_4px_12px_rgba(249,115,22,0.15)]">
        <h1 className="mb-2 mt-0 text-[28px] font-bold">
          Welcome back, {user?.name ? user.name : "Candidate"} .
          👋
        </h1>
        <p className="m-0 text-[16px] text-white/90">
          Ready to take your next assessment? Select a skill and level below.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="mb-6">
          <input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[10px] border border-slate-200 px-4 py-3 text-[14px] outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          {isSkillsLoading && Array.from({ length: 8 }).map((_, index) => (
            <button
              key={`skill-placeholder-${index}`}
              disabled
              className="cursor-default rounded-full border border-slate-200 px-[18px] py-2.5 text-[13px] font-semibold transition-all"
              style={{
                background: "#e2e8f0",
                color: "transparent",
                cursor: "default",
                width: index % 2 === 0 ? 80 : 120,
              }}
            >
              Loading
            </button>
          ))}

          {!isSkillsLoading && filteredSkills.length === 0 && (
            <div className="w-full py-5 text-center text-[14px] text-slate-400">
              No skills found.
            </div>
          )}
          {!isSkillsLoading && filteredSkills.map((skill) => {
            const isSelected = selectedSkillId === skill.skill_id;
            return (
              <button
                key={skill.skill_id}
                onClick={() => {
                  setSelectedSkillId(skill.skill_id);
                  setSelectedLevel(null);
                }}
                className={`cursor-pointer rounded-full px-[18px] py-2.5 text-[13px] font-semibold transition-all ${
                  isSelected
                    ? "border border-admin-orange bg-admin-orange text-white shadow-[0_4px_12px_rgba(249,115,22,0.25)]"
                    : "border border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {skill.name}
              </button>
            );
          })}
        </div>
      </div>

      {selectedSkill && (
        <div className="animate-slide-in">
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col gap-3">
              {selectedSkill.levels.length === 0 && (
                <div className="py-3 text-center text-slate-400">
                  No level data available for this skill.
                </div>
              )}

              {selectedSkill.levels.map((lvl) => {
                const meta = LEVEL_META[lvl.level] ?? {
                  label: lvl.label,
                  desc: "",
                  color: "#64748b",
                };
                const backendLevel = lvl.level as BackendLevel;
                const isSelected = selectedLevel === backendLevel;

                return (
                  <div
                    key={lvl.level}
                    onClick={() => {
                      if (lvl.unlocked) setSelectedLevel(backendLevel);
                    }}
                    className="flex items-center rounded-xl px-5 py-4 transition-all"
                    style={{
                      /* dynamic — intentionally inline */
                      border: isSelected
                        ? `2px solid ${meta.color}`
                        : "1px solid #e2e8f0",
                      background: lvl.unlocked
                        ? isSelected
                          ? `${meta.color}08`
                          : "#fff"
                        : "#f8fafc",
                      cursor: lvl.unlocked ? "pointer" : "not-allowed",
                      opacity: lvl.unlocked ? 1 : 0.6,
                    }}
                  >
                    {!lvl.unlocked && (
                      <div className="mr-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[16px]">
                        🔒
                      </div>
                    )}

                    {lvl.unlocked && (
                      <div
                        className="mr-4 h-5 w-5 rounded-full bg-white transition-all"
                        style={{
                          /* dynamic — intentionally inline */
                          border: isSelected
                            ? `6px solid ${meta.color}`
                            : "2px solid #cbd5e1",
                        }}
                      />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className="m-0 text-[15px] font-bold"
                          style={{
                            /* dynamic — intentionally inline */
                            color: lvl.unlocked ? meta.color : "#64748b",
                          }}
                        >
                          {meta.label}
                        </h3>
                        {lvl.cleared && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-green-700">
                            Cleared
                          </span>
                        )}
                      </div>
                      <p className="mb-0 mt-1 text-[12px] text-slate-500">
                        {meta.desc || ""} Attempts left:{" "}
                        {lvl.attempts_remaining}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            disabled={!selectedSkill || !selectedLevel}
            onClick={handleStart}
            className={`w-full rounded-xl border-none px-4 py-4 text-[16px] font-bold transition-all ${
              !selectedSkill || !selectedLevel
                ? "cursor-not-allowed bg-slate-200 text-slate-400 shadow-none"
                : "cursor-pointer bg-admin-orange text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)]"
            }`}
          >
            Pass Assessment
          </button>
        </div>
      )}
    </div>
  );
}

