import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "../../components/layout/Sidebar";
import { logout } from "../auth/authService";
import useUserStore from "../../stores/userStore";
import PastAssessmentsScreen from "./PastAssessmentsScreen.tsx";
import { getSkills, getUserProgress } from "./candidateService";
import type {
  BackendLevel,
  CandidateScreen,
  CandidateSelection,
  CandidateSelectionIds,
  ConfirmedScreenProps,
  HomeScreenProps,
  SkillWithProgress,
} from "./types/candidate";
import { useStartSession } from "../assessment/hooks/useAssessment";

const CANDIDATE_MENU = [
  { id: "dashboard", label: "Dashboard" },
  { id: "past_assessments", label: "Past Assessments" },
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

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const user = useUserStore();
  const [confirmed, setConfirmed] = useState<CandidateSelection | null>(null);
  const [confirmedIds, setConfirmedIds] =
    useState<CandidateSelectionIds | null>(null);
  const [screen, setScreen] = useState<CandidateScreen>("home");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { mutate: startSession, isPending: isStarting } = useStartSession();

  const {
    data: apiSkills,
    isLoading: isSkillsLoading,
    isError: isSkillsError,
  } = useQuery({
    queryKey: ["skills"],
    queryFn: getSkills,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: progress,
    isLoading: isProgressLoading,
    isError: isProgressError,
  } = useQuery({
    queryKey: ["user-progress"],
    queryFn: getUserProgress,
    staleTime: 1000 * 60,
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleConfirm = (
    skill: string,
    level: BackendLevel,
    levelLabel: string,
    skill_id: string,
  ) => {
    const skillObj = skillsList.find((s) => s.skill_id === skill_id);
    setConfirmed({ 
      skill, 
      levelLabel, 
      allowedLanguages: skillObj?.allowed_languages || [] 
    });
    setConfirmedIds({ skill_id, level });
    setScreen("confirmed");
  };

  const handleLogout = () => {
    logout();
  };

  const handleBeginAssessment = () => {
    if (!confirmedIds || !confirmed) return;
    const activeConfirmed = confirmed;

    startSession(confirmedIds, {
      onSuccess: (data) => {
        navigate("/candidate/assessment", {
          state: { 
            session_id: data.session_id, 
            problem: data.problem, 
            skill_name: activeConfirmed.skill, 
            allowed_languages: activeConfirmed.allowedLanguages 
          },
        });
      },
      onError: () => {
        alert("Failed to start assessment session. The backend service may be down. Please try again.");
      },
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden font-['Segoe_UI',sans-serif]">
      <Sidebar
        items={CANDIDATE_MENU}
        active={
          screen === "past_assessments" ? "past_assessments" : "dashboard"
        }
        onChange={(id) => {
          if (id === "past_assessments") setScreen("past_assessments");
          else setScreen("home");
        }}
      />

      <div className="flex flex-1 flex-col overflow-hidden bg-admin-bg">
        <header className="flex h-[60px] shrink-0 items-center justify-end border-b border-slate-200 bg-white px-7">
          <div className="relative" ref={menuRef}>
            <div
              onClick={() => setShowMenu((prev) => !prev)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-admin-orange text-[16px] font-bold text-white"
            >
              {(user?.name?.trim()?.[0] || "C").toUpperCase()}
            </div>

            {showMenu && (
              <div className="absolute right-0 top-12 z-[100] w-60 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                <div className="border-b border-slate-200 px-5 py-4">
                  <p className="m-0 text-[14px] font-semibold text-[#111]">
                    {user?.name || "Candidate User"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {user?.department || "candidate@indium.com"}
                  </p>
                </div>
                <div
                  onClick={() => {
                    setShowMenu(false);
                    handleLogout();
                  }}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 text-[14px] text-red-600"
                >
                  <LogOut size={16} /> Sign Out
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-10">
          {(isSkillsLoading || isProgressLoading) && (
            <div className="mt-10 text-center text-slate-500">
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
          ) : screen === "past_assessments" ? (
            <PastAssessmentsScreen />
          ) : (
            confirmed && (
              <ConfirmedScreen
                confirmed={confirmed}
                onChangeSkill={() => setScreen("home")}
                onBegin={handleBeginAssessment}
                isStarting={isStarting}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
}

function HomeScreen({ skillsList, onStart }: HomeScreenProps) {
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
    <div className="w-full max-w-[900px] pb-14">
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-admin-orange to-orange-600 p-8 text-white shadow-[0_4px_12px_rgba(249,115,22,0.15)]">
        <h1 className="mb-2 mt-0 text-[28px] font-bold">
          Welcome back, {user?.name ? user.name.split(" ")[0] : "Candidate"} .
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
          {filteredSkills.length === 0 && (
            <div className="w-full py-5 text-center text-[14px] text-slate-400">
              No skills found.
            </div>
          )}
          {filteredSkills.map((skill) => {
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

function ConfirmedScreen({
  confirmed,
  onChangeSkill,
  onBegin,
  isStarting,
}: ConfirmedScreenProps) {
  return (
    <div className="w-full max-w-[600px] text-center">
      <div className="rounded-[20px] bg-white px-12 py-14 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
        <div className="mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-green-500/10 text-[32px]">
          ✅
        </div>

        <h2 className="mb-2 text-[22px] font-extrabold text-[#111]">
          You're all set!
        </h2>
        <p className="mb-8 text-[14px] text-[#888]">
          Your assessment is ready. The editor will be launched by your proctor.
        </p>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-4 rounded-xl bg-[#f8f9fa] p-6">
          <div className="flex flex-col items-center px-4">
            <span className="text-[10px] font-semibold tracking-[0.8px] text-[#999]">
              SKILL
            </span>
            <span className="mt-1 text-[16px] font-extrabold text-admin-orange">
              {confirmed.skill}
            </span>
          </div>
          <div className="self-stretch w-px bg-[#e0e0e0]" />
          <div className="flex flex-col items-center px-4">
            <span className="text-[10px] font-semibold tracking-[0.8px] text-[#999]">
              LEVEL
            </span>
            <span className="mt-1 text-[16px] font-extrabold text-[#111]">
              {confirmed.levelLabel}
            </span>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-[10px] border border-admin-orange/20 bg-admin-orange/10 px-5 py-3.5">
          <PulsingDot />
          <span className="text-[13px] text-[#555]">
            Waiting for Monaco Editor to be launched...
          </span>
        </div>

        <button
          onClick={onBegin}
          disabled={isStarting}
          className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-[10px] border-none bg-admin-orange px-4 py-4 text-[16px] font-bold text-white shadow-admin-orange/25 shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isStarting ? (
            <>
              <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Starting Session...</span>
            </>
          ) : (
            "Begin Assessment →"
          )}
        </button>

        <button
          onClick={onChangeSkill}
          className="cursor-pointer rounded-lg border-[1.5px] border-[#ddd] bg-transparent px-7 py-[11px] text-[13px] text-[#777]"
        >
          ← Change Skill / Level
        </button>
      </div>
    </div>
  );
}

function PulsingDot() {
  return (
    <div className="h-2.5 w-2.5 shrink-0 animate-pulse-fast rounded-full bg-admin-orange" />
  );
}
