import { useState, useMemo } from "react";
import { User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import { logout } from "../auth/authService";
import useUserStore from "../../stores/userStore";
import PastAssessmentsScreen from "./PastAssessmentsScreen";

export const SKILL_CATEGORIES = [
  {
    name: "Frontend",
    skills: ["HTML CSS JS", "React JS", "React JS with Redux", "TypeScript", "Next JS", "Angular"]
  },
  {
    name: "Backend",
    skills: ["Python with Flask", "Python with Django", "Java", "Java Springboot", ".NET C#", ".NET VB.NET"]
  },
  {
    name: "Database",
    skills: ["SQL", "MongoDB", "PostgreSQL DB"]
  },
  {
    name: "Testing",
    skills: ["Java Selenium", "Python Selenium"]
  },
  {
    name: "Other",
    skills: ["Agile", "Python for Data Science"]
  }
];

export const LEVELS = [
  { id: "Beginner", title: "Beginner", color: "#22c55e" },
  { id: "Intermediate 1", title: "Intermediate 1", color: "#3b82f6" },
  { id: "Intermediate 2", title: "Intermediate 2", color: "#4f46e5" },
  { id: "Specialist 1", title: "Specialist 1", color: "#9333ea" },
  { id: "Specialist 2", title: "Specialist 2", color: "#d97706" },
];

const CANDIDATE_MENU = [
  { id: "dashboard", label: "Dashboard" },
  { id: "past_assessments", label: "Past Assessments" }
];

type Screen = "home" | "confirmed" | "past_assessments";

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const user = useUserStore();
  const [screen, setScreen] = useState<Screen>("home");
  const [showMenu, setShowMenu] = useState(false);
  
  // Confirmed Assessment state
  const [showModal, setShowModal] = useState(false);
  const [confirmed, setConfirmed] = useState<any>(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
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
          background: "#fff", borderBottom: `1px solid #e2e8f0`, padding: '0 28px', 
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 
        }}>
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowMenu(prev => !prev)}
              style={{
                width: 36, height: 36, borderRadius: '50%', background: '#F97316', 
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                cursor: 'pointer', fontWeight: 600, fontSize: 16
              }}
            >
              C
            </div>
            {showMenu && (
              <div style={{
                position: 'absolute', top: 48, right: 0, width: 220, background: '#fff', 
                borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                border: `1px solid #e2e8f0`, overflow: 'hidden', zIndex: 100
              }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid #e2e8f0` }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#111', fontSize: 14 }}>{user?.name || "Candidate User"}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{user?.department || "candidate@indium.com"}</p>
                </div>
                <div 
                  onClick={handleLogout}
                  style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 14, color: '#dc2626' }}
                >
                  <LogOut size={16} /> Sign Out
                </div>
              </div>
            )}
          </div>
        </header>

        <main style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "40px 24px",
          overflowY: "auto",
        }}>
          {screen === "home" ? (
            <HomeScreen onStart={(payload) => { setConfirmed(payload); setScreen("confirmed"); }} />
          ) : screen === "past_assessments" ? (
            <PastAssessmentsScreen />
          ) : (
            confirmed && (
              <ConfirmedScreen
                confirmed={confirmed}
                onChangeSkill={() => { setScreen("home"); }}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
}

function HomeScreen({ onStart }: { onStart: (data: any) => void }) {
  const user = useUserStore();
  const currentLevel = user?.level || "Beginner";
  
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // Flatten skills with their categories for easier filtering
  const allSkills = useMemo(() => {
    return SKILL_CATEGORIES.flatMap(cat => 
      cat.skills.map(skill => ({ skill, category: cat.name }))
    );
  }, []);

  const filteredSkills = useMemo(() => {
    return allSkills.filter(item => {
      const matchesSearch = item.skill.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = filterCategory === "All" || item.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, filterCategory, allSkills]);

  return (
    <div style={{ width: "100%", maxWidth: "900px", paddingBottom: "60px" }}>
      {/* Banner */}
      <div style={{
        background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        borderRadius: "16px",
        padding: "32px",
        color: "#fff",
        boxShadow: "0 4px 12px rgba(249,115,22,0.15)",
        marginBottom: "32px"
      }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: 700 }}>
          Welcome back, {user?.name ? user.name.split(' ')[0] : 'Candidate'} 👋
        </h1>
        <p style={{ margin: 0, fontSize: "16px", color: "rgba(255,255,255,0.9)" }}>
          Ready to take your next assessment? Select a skill and level below.
        </p>
      </div>

      {/* Select a Skill */}
      <div style={{ marginBottom: "32px", background: "#fff", padding: "24px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)", border: "1px solid #e2e8f0" }}>
        
        {/* Filters Row */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <input 
              placeholder="Search skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ width: "200px" }}>
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box", background: "#fff", cursor: "pointer" }}
            >
              <option value="All">All Categories</option>
              {SKILL_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Skill Chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {filteredSkills.length === 0 && <div style={{ color: "#94a3b8", fontSize: "14px", width: "100%", textAlign: "center", padding: "20px 0" }}>No skills found matching your filters.</div>}
          
          {filteredSkills.map(({ skill }) => {
            const isSelected = selectedSkill === skill;
            return (
              <button
                key={skill}
                onClick={() => {
                  setSelectedSkill(skill);
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
                  boxShadow: isSelected ? "0 4px 12px rgba(249,115,22,0.25)" : "none"
                }}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div>

      {/* Select Level */}
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
              {LEVELS.map(lvl => {
                const isUnlocked = currentLevel === lvl.id;
                const isSelected = selectedLevel === lvl.id;
                return (
                  <div
                    key={lvl.id}
                    onClick={() => {
                      if (isUnlocked) setSelectedLevel(lvl.id);
                    }}
                    style={{
                      display: "flex", alignItems: "center", padding: "16px 20px",
                      borderRadius: "12px", border: isSelected ? `2px solid ${lvl.color}` : "1px solid #e2e8f0",
                      background: isUnlocked ? (isSelected ? `${lvl.color}08` : "#fff") : "#f8fafc",
                      cursor: isUnlocked ? "pointer" : "not-allowed",
                      opacity: isUnlocked ? 1 : 0.6,
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                  >
                    {!isUnlocked && (
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 16, fontSize: 16 }}>🔒</div>
                    )}
                    {isUnlocked && (
                      <div style={{ 
                        width: 20, height: 20, borderRadius: "50%", 
                        border: isSelected ? `6px solid ${lvl.color}` : "2px solid #cbd5e1", 
                        background: "#fff", marginRight: 16, transition: "all 0.2s" 
                      }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: isUnlocked ? lvl.color : "#64748b" }}>{lvl.title}</h3>
                        {isUnlocked && <span style={{ padding: "2px 8px", background: "#fef3c7", color: "#d97706", fontSize: 10, fontWeight: 800, borderRadius: "99px", textTransform: "uppercase" }}>Current Tier</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            disabled={!selectedSkill || !selectedLevel}
            onClick={() => onStart({ skill: selectedSkill, level: selectedLevel })}
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
              boxShadow: (!selectedSkill || !selectedLevel) ? "none" : "0 4px 12px rgba(249,115,22,0.3)"
            }}
          >
            Pass Assessment
          </button>
        </div>
      )}
    </div>
  );
}

// Same ConfirmedScreen as before (condensed)
function ConfirmedScreen({ confirmed, onChangeSkill }: any) {
  const navigate = useNavigate();
  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: 40, width: "100%", maxWidth: 640, textAlign: "center", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
      <img src="/verified.svg" alt="Ready" style={{ height: 80, marginBottom: 24 }} />
      <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 16px" }}>Ready to pass {confirmed.skill} ({confirmed.level})?</h2>
      <p style={{ color: "#64748b", margin: "0 auto 32px", fontSize: 15, lineHeight: 1.6, maxWidth: 460 }}>
        You will be navigated to the active proctoring environment. Once begun, you cannot pause or return your session.
      </p>
      
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button
          onClick={onChangeSkill}
          style={{ padding: "14px 28px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          Change Skill
        </button>
        <button
          onClick={() => navigate("/candidate/assessment")}
          style={{ padding: "14px 28px", border: "none", background: "#F97316", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(249,115,22,0.2)" }}
        >
          Enter Environment Access
        </button>
      </div>
    </div>
  );
}
