import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "../../components/layout/Sidebar";
import { logout } from "../auth/authService";
import useUserStore from "../../stores/userStore";
import PastAssessmentsScreen from "./PastAssessmentsScreen.tsx";
import {
  getSkills,
  getUserProgress,
  type ProgressLevel,
  type Skill,
} from "./candidateService";
import { useStartSession } from "../assessment/hooks/useAssessment";

const CANDIDATE_MENU = [
  { id: "dashboard", label: "Dashboard" },
  { id: "past_assessments", label: "Past Assessments" },
];

type Screen = "home" | "confirmed" | "past_assessments";
type BackendLevel = "beginner" | "intermediate_1" | "intermediate_2" | "specialist_1" | "specialist_2";

type SkillWithProgress = Skill & {
  levels: ProgressLevel[];
};

const LEVEL_META: Record<string, { label: string; desc: string; color: string }> = {
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
  const [confirmed, setConfirmed] = useState<{ skill: string; levelLabel: string } | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<{ skill_id: string; level: BackendLevel } | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
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
    const progressBySkill = new Map((progress ?? []).map((item) => [item.skill_id, item.levels]));
    return (apiSkills ?? []).map((skill) => ({
      ...skill,
      levels: progressBySkill.get(skill.skill_id) ?? [],
    }));
  }, [apiSkills, progress]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleConfirm = (skill: string, level: BackendLevel, levelLabel: string, skill_id: string) => {
    setConfirmed({ skill, levelLabel });
    setConfirmedIds({ skill_id, level });
    setScreen("confirmed");
  };

  const handleLogout = () => {
    logout();
    navigate("/auth/login");
  };

  const handleBeginAssessment = () => {
    if (!confirmedIds) return;
    startSession(confirmedIds, {
      onSuccess: (data) => {
        navigate("/candidate/assessment", {
          state: { session_id: data.session_id, problem: data.problem },
        });
      },
      onError: () => {
        alert("Failed to start session. Please try again.");
      },
    });
  };

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Segoe UI', sans-serif" }}>
      <Sidebar
        items={CANDIDATE_MENU}
        active={screen === "past_assessments" ? "past_assessments" : "dashboard"}
        onChange={(id) => {
          if (id === "past_assessments") setScreen("past_assessments");
          else setScreen("home");
        }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f8fafc" }}>
        <header style={{
          background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 28px",
          height: 60, display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0,
        }}>
          <div style={{ position: "relative" }} ref={menuRef}>
            <div
              onClick={() => setShowMenu(prev => !prev)}
              style={{
                width: 36, height: 36, borderRadius: "50%", background: "#F97316",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontWeight: 700, fontSize: 16,
              }}
            >
              {(user?.name?.trim()?.[0] || "C").toUpperCase()}
            </div>
            {showMenu && (
              <div style={{
                position: "absolute", top: 48, right: 0, width: 240, background: "#fff",
                borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                border: "1px solid #e2e8f0", overflow: "hidden", zIndex: 100,
              }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                  <p style={{ margin: 0, fontWeight: 600, color: "#111", fontSize: 14 }}>{user?.name || "Candidate User"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>{user?.department || "candidate@indium.com"}</p>
                </div>
                <div
                  onClick={() => {
                    setShowMenu(false);
                    handleLogout();
                  }}
                  style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14, color: "#dc2626" }}
                >
                  <LogOut size={16} /> Sign Out
                </div>
              </div>
            )}
          </div>
        </header>

        <main style={{
          flex: 1,
          padding: "40px 24px",
          overflowY: "auto",
        }}>
          {(isSkillsLoading || isProgressLoading) && (
            <div style={{ textAlign: "center", color: "#64748b", marginTop: 40 }}>Loading your skills...</div>
          )}

          {(isSkillsError || isProgressError) && (
            <div style={{
              margin: "0 auto",
              maxWidth: 900,
              padding: "16px 20px",
              borderRadius: 12,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#b91c1c",
              fontSize: 14,
            }}>
              Failed to load dashboard data from backend. Please try again.
            </div>
          )}

          {screen === "home" ? (
            <HomeScreen
              skillsList={skillsList}
              onStart={(data) => {
                handleConfirm(data.skill, data.level, data.levelLabel, data.skill_id);
              }}
            />
          ) : screen === "past_assessments" ? (
            <PastAssessmentsScreen />
          ) : (
            confirmed && (
              <ConfirmedScreen
                confirmed={confirmed}
                onChangeSkill={() => { setScreen("home"); }}
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

function HomeScreen({
  skillsList,
  onStart,
}: {
  skillsList: SkillWithProgress[];
  onStart: (data: { skill: string; level: BackendLevel; levelLabel: string; skill_id: string }) => void;
}) {
  const user = useUserStore();
  const [search, setSearch] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<BackendLevel | null>(null);

  const filteredSkills = useMemo(
    () => skillsList.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
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
    <div style={{ width: "100%", maxWidth: "900px", paddingBottom: "60px" }}>
      <div style={{
        background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        borderRadius: "16px",
        padding: "32px",
        color: "#fff",
        boxShadow: "0 4px 12px rgba(249,115,22,0.15)",
        marginBottom: "32px",
      }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: 700 }}>
          Welcome back, {user?.name ? user.name.split(" ")[0] : "Candidate"}
        </h1>
        <p style={{ margin: 0, fontSize: "16px", color: "rgba(255,255,255,0.9)" }}>
          Ready to take your next assessment? Select a skill and level below.
        </p>
      </div>

      <div style={{ marginBottom: "32px", background: "#fff", padding: "24px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)", border: "1px solid #e2e8f0" }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <input
              placeholder="Search skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {filteredSkills.length === 0 && <div style={{ color: "#94a3b8", fontSize: "14px", width: "100%", textAlign: "center", padding: "20px 0" }}>No skills found.</div>}
          {filteredSkills.map((skill) => {
            const isSelected = selectedSkillId === skill.skill_id;
            return (
              <button
                key={skill.skill_id}
                onClick={() => {
                  setSelectedSkillId(skill.skill_id);
                  setSelectedLevel(null);
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "99px",
                  border: isSelected ? "1px solid #f97316" : "1px solid #e2e8f0",
                  background: isSelected ? "#f97316" : "#f8fafc",
                  color: isSelected ? "#fff" : "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: isSelected ? "0 4px 12px rgba(249,115,22,0.25)" : "none",
                }}
              >
                {skill.name}
              </button>
            );
          })}
        </div>
      </div>

      {selectedSkill && (
        <div style={{ animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(15px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div style={{ marginBottom: "32px", background: "#fff", padding: "24px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {selectedSkill.levels.length === 0 && (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: "12px 0" }}>
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
                    style={{
                      display: "flex", alignItems: "center", padding: "16px 20px",
                      borderRadius: "12px", border: isSelected ? `2px solid ${meta.color}` : "1px solid #e2e8f0",
                      background: lvl.unlocked ? (isSelected ? `${meta.color}08` : "#fff") : "#f8fafc",
                      cursor: lvl.unlocked ? "pointer" : "not-allowed",
                      opacity: lvl.unlocked ? 1 : 0.6,
                      transition: "all 0.2s",
                    }}
                  >
                    {!lvl.unlocked && (
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 16, fontSize: 16 }}>🔒</div>
                    )}
                    {lvl.unlocked && (
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        border: isSelected ? `6px solid ${meta.color}` : "2px solid #cbd5e1",
                        background: "#fff", marginRight: 16, transition: "all 0.2s",
                      }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: lvl.unlocked ? meta.color : "#64748b" }}>{meta.label}</h3>
                        {lvl.cleared && <span style={{ padding: "2px 8px", background: "#dcfce7", color: "#15803d", fontSize: 10, fontWeight: 800, borderRadius: "99px", textTransform: "uppercase" }}>Cleared</span>}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                        {meta.desc || ""} Attempts left: {lvl.attempts_remaining}
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
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              background: (!selectedSkill || !selectedLevel) ? "#e2e8f0" : "#F97316",
              color: (!selectedSkill || !selectedLevel) ? "#94a3b8" : "#fff",
              border: "none",
              fontSize: "16px",
              fontWeight: 700,
              cursor: (!selectedSkill || !selectedLevel) ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: (!selectedSkill || !selectedLevel) ? "none" : "0 4px 12px rgba(249,115,22,0.3)",
            }}
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
}: {
  confirmed: { skill: string; levelLabel: string };
  onChangeSkill: () => void;
  onBegin: () => void;
  isStarting: boolean;
}) {
  return (
    <div style={{ width: "100%", maxWidth: "600px", textAlign: "center" }}>
      <div style={{
        background: "#fff", borderRadius: "20px",
        padding: "56px 48px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>
        <div style={{
          width: "72px", height: "72px",
          background: "rgba(34,197,94,0.1)",
          borderRadius: "20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px", fontSize: "32px",
        }}>✅</div>

        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111", marginBottom: "8px" }}>
          You're all set!
        </h2>
        <p style={{ fontSize: "14px", color: "#888", marginBottom: "32px" }}>
          Your assessment is ready. The editor will be launched by your proctor.
        </p>

        <div style={{
          background: "#f8f9fa", borderRadius: "12px",
          padding: "24px", marginBottom: "32px",
          display: "flex", gap: "16px",
          justifyContent: "center", flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px" }}>
            <span style={{ fontSize: "10px", color: "#999", fontWeight: 600, letterSpacing: "0.8px" }}>SKILL</span>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#E8620A", marginTop: "4px" }}>
              {confirmed.skill}
            </span>
          </div>
          <div style={{ width: "1px", background: "#e0e0e0", alignSelf: "stretch" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px" }}>
            <span style={{ fontSize: "10px", color: "#999", fontWeight: 600, letterSpacing: "0.8px" }}>LEVEL</span>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#111", marginTop: "4px" }}>
              {confirmed.levelLabel}
            </span>
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          background: "rgba(232,98,10,0.06)",
          border: "1px solid rgba(232,98,10,0.2)",
          borderRadius: "10px", padding: "14px 20px", marginBottom: "24px",
        }}>
          <PulsingDot />
          <span style={{ fontSize: "13px", color: "#555" }}>
            Waiting for Monaco Editor to be launched...
          </span>
        </div>

        <button
          onClick={onBegin}
          disabled={isStarting}
          style={{
            width: "100%",
            background: "#E8620A",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: isStarting ? "not-allowed" : "pointer",
            boxShadow: "0 6px 24px rgba(232,98,10,0.25)",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            opacity: isStarting ? 0.7 : 1,
          }}
        >
          {isStarting ? (
            <>
              <div style={{
                width: "18px", height: "18px", border: "2px solid #fff",
                borderTopColor: "transparent", borderRadius: "50%",
                animation: "spin 0.8s linear infinite"
              }} />
              <span>Starting Session...</span>
            </>
          ) : (
            "Begin Assessment →"
          )}
        </button>

        <style>{`@keyframes spin { from {transform:rotate(0deg)} to {transform:rotate(360deg)} }`}</style>

        <button
          onClick={onChangeSkill}
          style={{
            background: "transparent", border: "1.5px solid #ddd",
            borderRadius: "8px", padding: "11px 28px",
            fontSize: "13px", color: "#777", cursor: "pointer",
          }}
        >
          ← Change Skill / Level
        </button>
      </div>
    </div>
  );
}

function PulsingDot() {
  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }`}</style>
      <div style={{
        width: "10px", height: "10px", borderRadius: "50%",
        background: "#E8620A", flexShrink: 0,
        animation: "pulse 1.5s ease-in-out infinite",
      }} />
    </>
  );
}
