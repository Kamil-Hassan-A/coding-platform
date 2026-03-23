import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import SkillModal from "./SkillModal";
import { logout } from "../auth/authService";

const SKILLS = [
  "Agile", "HTML, CSS, JS", "React JS", "React JS with Redux", "TypeScript",
  "Next JS", "Angular", "Python with Flask", "Python with Django",
  "Python for Data Science", "Java", "Java Springboot", ".NET, C#",
  ".NET, VB.NET", "SQL", "MongoDB", "PostgreSQL DB", "Java Selenium", "Python Selenium",
];

const LEVELS = [
  { id: "beginner", label: "Beginner", desc: "Foundational concepts & basics", color: "#22c55e" },
  { id: "intermediate1", label: "Intermediate 1", desc: "Core proficiency, common patterns", color: "#3b82f6" },
  { id: "intermediate2", label: "Intermediate 2", desc: "Advanced application & problem solving", color: "#8b5cf6" },
  { id: "specialist1", label: "Specialist 1", desc: "Expert-level depth & architecture", color: "#f59e0b" },
  { id: "specialist2", label: "Specialist 2", desc: "Master practitioner & leadership", color: "#E8620A" },
];

const CANDIDATE_MENU = [
  { id: "dashboard", label: "Dashboard" },
  { id: "start", label: "Start Assessment" }
];

type Screen = "home" | "confirmed";

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [confirmed, setConfirmed] = useState<{ skill: string; level: string } | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleConfirm = (skill: string, level: string) => {
    setConfirmed({ skill, level });
    setShowModal(false);
    setScreen("confirmed");
  };

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Segoe UI', sans-serif" }}>
      <Sidebar 
        items={CANDIDATE_MENU} 
        active="dashboard" 
        onChange={() => {}} 
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f6fa" }}>
        <header style={{
          height: "60px",
          background: "#fff",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          flexShrink: 0,
        }}>
          <img src="/indium-logo.png" alt="Indium" style={{ height: 32 }} />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#222" }}>Platform User</div>
              <div style={{ fontSize: "11px", color: "#aaa" }}>Candidate</div>
            </div>
            <div style={{ position: "relative" }} ref={menuRef}>
              <div
                onClick={() => setShowMenu(prev => !prev)}
                style={{
                  width: "38px", height: "38px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #E8620A, #c9520a)",
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "13px", fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                PA
              </div>
              {showMenu && (
                <div style={{
                  position: "absolute", right: 0, top: 46,
                  background: "#ffffff", border: "1px solid #e5e7eb",
                  borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  minWidth: 140, zIndex: 100
                }}>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      logout();
                      navigate("/auth/login");
                    }}
                    style={{
                      width: "100%", padding: "10px 16px", textAlign: "left",
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 13, color: "#dc2626", fontWeight: 600
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          overflowY: "auto",
        }}>
          {screen === "home" ? (
            <HomeScreen onStart={() => setShowModal(true)} />
          ) : (
            confirmed && (
              <ConfirmedScreen
                confirmed={confirmed}
                onChangeSkill={() => { setScreen("home"); setShowModal(true); }}
              />
            )
          )}
        </main>

        {showModal && (
          <SkillModal
            skills={SKILLS}
            levels={LEVELS}
            onClose={() => setShowModal(false)}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
}

function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ width: "100%", maxWidth: "680px", textAlign: "center" }}>
      <div style={{
        background: "#fff",
        borderRadius: "20px",
        padding: "56px 48px 48px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        marginBottom: "24px",
      }}>
        <div style={{
          width: "72px", height: "72px",
          background: "rgba(232,98,10,0.1)",
          borderRadius: "20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          fontSize: "32px",
        }}>🎯</div>

        <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#111", marginBottom: "12px" }}>
          Welcome to Your Assessment
        </h1>
        <p style={{ fontSize: "15px", color: "#777", lineHeight: 1.7, maxWidth: "480px", margin: "0 auto 36px" }}>
          This is an internal skills assessment. Select the technology you'd like to be
          evaluated on and your proficiency level to get started.
        </p>

        <button
          onClick={onStart}
          style={{
            background: "#E8620A",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "16px 48px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 6px 24px rgba(232,98,10,0.35)",
          }}
        >
          Select Skill &amp; Begin →
        </button>
      </div>

      <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { icon: "🔒", text: "Proctored Assessment" },
          { icon: "⏱", text: "Timed Evaluation" },
          { icon: "💻", text: "Code in Monaco Editor" },
        ].map(chip => (
          <div key={chip.text} style={{
            background: "#fff", borderRadius: "50px",
            padding: "10px 20px", fontSize: "13px", color: "#555",
            display: "flex", alignItems: "center", gap: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <span>{chip.icon}</span><span>{chip.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmedScreen({
  confirmed,
  onChangeSkill,
}: {
  confirmed: { skill: string; level: string };
  onChangeSkill: () => void;
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
              {confirmed.level}
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
}function IndiumWordmark() { return null; }
