import { useState } from "react";
import type { Skill } from "./candidateService";

interface Level {
  id: string;
  label: string;
  desc: string;
  color: string;
}

interface Props {
  skills: Skill[];
  levels: Level[];
  onClose: () => void;
  onConfirm: (skill_name: string, level_label: string, skill_id: string) => void;
}

export default function SkillModal({ skills, levels, onClose, onConfirm }: Props) {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const canProceedStep1 = selectedSkill !== null;
  const canProceedStep2 = selectedLevel !== "";

  const handleProceed = () => {
    if (step === 1 && canProceedStep1) {
      setStep(2);
    } else if (step === 2 && canProceedStep2) {
      const levelObj = levels.find(l => l.id === selectedLevel);
      if (levelObj && selectedSkill) {
        onConfirm(selectedSkill.name, levelObj.label, selectedSkill.skill_id);
      }
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "540px",
          maxWidth: "95vw",
          boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a1a2e, #0f3460)",
          padding: "28px 32px 24px",
          position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "1.5px", fontWeight: 600, marginBottom: "6px" }}>
                ASSESSMENT SETUP
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff" }}>
                {step === 1 ? "Choose Your Skill" : "Select Proficiency Level"}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.1)", border: "none",
              borderRadius: "50%", width: "36px", height: "36px",
              color: "#fff", fontSize: "18px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                height: "3px", flex: 1, borderRadius: "2px",
                background: s <= step ? "#E8620A" : "rgba(255,255,255,0.2)",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "32px" }}>
          {step === 1 ? (
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", display: "block", marginBottom: "10px" }}>
                Select a skill area
              </label>

              {/* Custom dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{
                    width: "100%", padding: "14px 16px",
                    background: "#f8f9fa", border: "2px solid",
                    borderColor: dropdownOpen ? "#E8620A" : "#e0e0e0",
                    borderRadius: "8px", textAlign: "left",
                    fontSize: "14px", color: selectedSkill ? "#111" : "#aaa",
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    transition: "border-color 0.2s",
                  }}
                >
                  <span>{selectedSkill?.name || "— Choose a skill —"}</span>
                  <span style={{
                    transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    color: "#E8620A",
                  }}>▾</span>
                </button>

                {dropdownOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                    background: "#fff", border: "2px solid #E8620A",
                    borderRadius: "8px", zIndex: 10,
                    maxHeight: "280px", overflowY: "auto",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  }}>
                    {skills.map((skill, i) => (
                      <div
                        key={skill.skill_id}
                        onClick={() => { setSelectedSkill(skill); setDropdownOpen(false); }}
                        style={{
                          padding: "12px 16px",
                          cursor: "pointer",
                          fontSize: "14px",
                          color: selectedSkill?.skill_id === skill.skill_id ? "#E8620A" : "#333",
                          fontWeight: selectedSkill?.skill_id === skill.skill_id ? 700 : 400,
                          background: selectedSkill?.skill_id === skill.skill_id ? "rgba(232,98,10,0.06)" : "transparent",
                          borderBottom: i < skills.length - 1 ? "1px solid #f0f0f0" : "none",
                          display: "flex", alignItems: "center", gap: "10px",
                          transition: "background 0.1s",
                        }}
                      >
                        <span style={{
                          width: "24px", height: "24px", borderRadius: "50%",
                          background: selectedSkill?.skill_id === skill.skill_id ? "#E8620A" : "#f0f0f0",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "11px", fontWeight: 700,
                          color: selectedSkill?.skill_id === skill.skill_id ? "#fff" : "#999",
                          flexShrink: 0,
                        }}>{i + 1}</span>
                        {skill.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedSkill && (
                <div style={{
                  marginTop: "16px", padding: "12px 16px",
                  background: "rgba(232,98,10,0.06)", borderRadius: "8px",
                  border: "1px solid rgba(232,98,10,0.2)",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <span style={{ fontSize: "18px" }}>✓</span>
                  <span style={{ fontSize: "13px", color: "#333" }}>
                    Selected: <strong style={{ color: "#E8620A" }}>{selectedSkill.name}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#555", display: "block", marginBottom: "16px" }}>
                Choose your proficiency level for <span style={{ color: "#E8620A" }}>{selectedSkill?.name}</span>
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {levels.map(level => (
                  <div
                    key={level.id}
                    onClick={() => setSelectedLevel(level.id)}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "10px",
                      border: "2px solid",
                      borderColor: selectedLevel === level.id ? level.color : "#eee",
                      background: selectedLevel === level.id ? `${level.color}10` : "#fafafa",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "14px",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: "14px", height: "14px", borderRadius: "50%",
                      border: `3px solid ${level.color}`,
                      background: selectedLevel === level.id ? level.color : "transparent",
                      flexShrink: 0,
                      transition: "background 0.15s",
                    }} />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#222" }}>{level.label}</div>
                      <div style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>{level.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 32px 28px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            style={{
              background: "transparent", border: "1.5px solid #ddd",
              borderRadius: "8px", padding: "11px 24px",
              fontSize: "14px", color: "#666", cursor: "pointer",
            }}
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>

          <button
            onClick={handleProceed}
            disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            style={{
              background: (step === 1 ? canProceedStep1 : canProceedStep2) ? "#E8620A" : "#ddd",
              color: (step === 1 ? canProceedStep1 : canProceedStep2) ? "#fff" : "#aaa",
              border: "none", borderRadius: "8px",
              padding: "12px 32px", fontSize: "14px", fontWeight: 700,
              cursor: (step === 1 ? canProceedStep1 : canProceedStep2) ? "pointer" : "not-allowed",
              transition: "all 0.2s",
            }}
          >
            {step === 1 ? "Next →" : "Begin Assessment →"}
          </button>
        </div>
      </div>
    </div>
  );
}
