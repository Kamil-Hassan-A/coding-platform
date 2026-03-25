import { useState, useMemo } from "react";
import { SKILL_CATEGORIES, LEVELS } from "./candidateConstants";
import { Eye, X } from "lucide-react";

interface TopicBreakdown {
  topic: string;
  score: number;
  max: number;
}

interface PastScore {
  level: string;
  score: number;
  date: string;
  status: "Passed" | "Failed";
  timeTaken: string;
  breakdown: TopicBreakdown[];
}

const MOCK_SCORES: Record<string, PastScore[]> = {
  "React JS": [
    { 
      level: "Beginner", score: 92, date: "2026-01-10", status: "Passed", timeTaken: "42 min",
      breakdown: [{ topic: "JSX Basics", score: 25, max: 25 }, { topic: "Hooks", score: 20, max: 25 }, { topic: "Routing", score: 24, max: 25 }, { topic: "State", score: 23, max: 25 }]
    },
    { 
      level: "Intermediate 1", score: 85, date: "2026-02-15", status: "Passed", timeTaken: "48 min",
      breakdown: [{ topic: "Context API", score: 22, max: 25 }, { topic: "Custom Hooks", score: 24, max: 25 }, { topic: "Performance", score: 18, max: 25 }, { topic: "Testing", score: 21, max: 25 }]
    },
    { 
      level: "Intermediate 2", score: 55, date: "2026-03-20", status: "Failed", timeTaken: "58 min",
      breakdown: [{ topic: "SSR", score: 10, max: 25 }, { topic: "Suspense", score: 12, max: 25 }, { topic: "Architecture", score: 18, max: 25 }, { topic: "State Machines", score: 15, max: 25 }]
    },
  ],
  "TypeScript": [
    { 
      level: "Beginner", score: 88, date: "2025-11-05", status: "Passed", timeTaken: "38 min",
      breakdown: [{ topic: "Basic Types", score: 25, max: 25 }, { topic: "Interfaces", score: 22, max: 25 }, { topic: "Unions", score: 23, max: 25 }, { topic: "Generics", score: 18, max: 25 }]
    },
  ]
};

export default function PastAssessmentsScreen() {
  const [search, setSearch] = useState("");
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  
  // Breakdown modal state
  const [activeBreakdown, setActiveBreakdown] = useState<PastScore | null>(null);

  const filteredCategories = useMemo(() => {
    return SKILL_CATEGORIES.map(cat => ({
      ...cat,
      skills: cat.skills.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    })).filter(cat => cat.skills.length > 0);
  }, [search]);

  const activeScores = activeSkill ? MOCK_SCORES[activeSkill] || [] : [];
  
  const totalAttempted = activeScores.length;
  const highestScore = totalAttempted > 0 ? Math.max(...activeScores.map(s => s.score)) : 0;
  const passed = activeScores.filter(s => s.status === "Passed").length;

  return (
    <div style={{ width: "100%", maxWidth: "900px", minHeight: "600px", paddingBottom: "40px", position: "relative" }}>
      {/* Skill Selector */}
      <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.02)", marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 700, color: "#111" }}>Select a skill to view your past results</h2>
        <input 
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: "12px 16px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "14px", marginBottom: "20px", outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxHeight: "240px", overflowY: "auto", paddingRight: "8px" }}>
          {filteredCategories.length === 0 && <span style={{ fontSize: "13px", color: "#94a3b8" }}>No skills match your search.</span>}
          {filteredCategories.map(cat => (
            <div key={cat.name}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                {cat.name}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {cat.skills.map(skill => {
                  const isSelected = activeSkill === skill;
                  const hasData = !!MOCK_SCORES[skill];
                  return (
                    <button
                      key={skill}
                      onClick={() => setActiveSkill(skill)}
                      style={{
                        padding: "8px 16px", borderRadius: "99px", border: isSelected ? "1px solid #f97316" : "1px solid #e2e8f0",
                        background: isSelected ? "#f97316" : (hasData ? "#f0fdf4" : "#fff"),
                        color: isSelected ? "#fff" : (hasData ? "#166534" : "#334155"),
                        fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                      }}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {!activeSkill && (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "#fff", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
          <div style={{ color: "#94a3b8", display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Eye size={48} strokeWidth={1} />
          </div>
          <h3 style={{ margin: "0 0 8px 0", color: "#334155" }}>Select a skill above to see your assessment history.</h3>
        </div>
      )}

      {/* Results Panel */}
      {activeSkill && (
        <div style={{ animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          
          {/* Summary Strip */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
            <div style={{ flex: 1, background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Attempts</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#111", marginTop: "4px" }}>{totalAttempted}</div>
            </div>
            <div style={{ flex: 1, background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Highest Score</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#111", marginTop: "4px" }}>{highestScore}%</div>
            </div>
            <div style={{ flex: 1, background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Passed</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#111", marginTop: "4px" }}>{passed} / {totalAttempted}</div>
            </div>
          </div>

          <h3 style={{ fontSize: "18px", color: "#111", margin: "0 0 16px", fontWeight: 700 }}>{activeSkill} Track</h3>

          {/* Table-Card Layout */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {LEVELS.map((lvl) => {
              const record = activeScores.find(s => s.level === lvl.id);
              
              if (!record) {
                // Not Attempted Card
                return (
                  <div key={lvl.id} style={{ display: "flex", alignItems: "center", background: "#f8fafc", padding: "16px 24px", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                    <div style={{ width: "200px" }}>
                      <div style={{ display: "inline-block", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, color: "#94a3b8", background: "#e2e8f0" }}>
                        {lvl.id}
                      </div>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: "14px", fontWeight: 500 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>🔒</div>
                      Not Attempted
                    </div>
                  </div>
                )
              }

              // Attempted Card
              const pass = record.status === "Passed";
              const progressPct = record.score;

              return (
                <div key={lvl.id} style={{ display: "flex", alignItems: "center", background: "#fff", padding: "16px 24px", borderRadius: "12px", border: `1px solid ${lvl.color}40`, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  
                  {/* Badge */}
                  <div style={{ width: "200px" }}>
                    <div style={{ display: "inline-block", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, color: lvl.color, background: `${lvl.color}15` }}>
                      {lvl.id}
                    </div>
                  </div>
                  
                  {/* Score & Bar */}
                  <div style={{ width: "200px", paddingRight: "32px" }}>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#111", marginBottom: "6px" }}>
                      {record.score} <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600 }}>/ 100</span>
                    </div>
                    <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progressPct}%`, background: pass ? "#22c55e" : "#ef4444", borderRadius: "99px" }} />
                    </div>
                  </div>

                  {/* Date */}
                  <div style={{ flex: 1, fontSize: "14px", color: "#64748b", fontWeight: 500 }}>
                    {new Date(record.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>

                  {/* Status Pill */}
                  <div style={{ width: "120px", textAlign: "right" }}>
                    <span style={{
                      padding: "6px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
                      background: pass ? "#dcfce7" : "#fee2e2", color: pass ? "#16a34a" : "#dc2626"
                    }}>
                      {pass ? "✅ Passed" : "❌ Failed"}
                    </span>
                  </div>

                  {/* Eye Icon Action */}
                  <button 
                    onClick={() => setActiveBreakdown({ ...record, level: lvl.id })}
                    style={{ background: "none", border: "none", marginLeft: "24px", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.2s" }}
                    onMouseOver={(e) => e.currentTarget.style.color = lvl.color}
                    onMouseOut={(e) => e.currentTarget.style.color = "#94a3b8"}
                  >
                    <Eye size={20} />
                  </button>

                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Breakdown Modal Portal */}
      {activeBreakdown && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setActiveBreakdown(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: "560px", background: "#fff", borderRadius: "16px", padding: "32px", boxShadow: "0 20px 40px rgba(0,0,0,0.1)", animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            
            <button onClick={() => setActiveBreakdown(null)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
              <X size={20} />
            </button>

            <h3 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: 800, color: "#111" }}>Assessment Breakdown</h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#64748b" }}>{activeSkill} • {activeBreakdown.level}</p>

            <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
              <div style={{ flex: 1, padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Time Taken</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#111" }}>{activeBreakdown.timeTaken}</div>
              </div>
              <div style={{ flex: 1, padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Accuracy</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#111" }}>{activeBreakdown.score}%</div>
              </div>
            </div>

            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#111", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>Topic Performance</h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {activeBreakdown.breakdown.map((b, i) => {
                const subPct = Math.round((b.score / b.max) * 100);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "160px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>{b.topic}</div>
                    <div style={{ flex: 1, height: "6px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${subPct}%`, background: subPct >= 80 ? "#22c55e" : subPct >= 60 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                    <div style={{ width: "40px", textAlign: "right", fontSize: "13px", fontWeight: 700, color: "#64748b" }}>
                      {b.score}/{b.max}
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
