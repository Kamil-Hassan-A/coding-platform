import React, { useState, useEffect, useRef } from "react";

interface Props {
  onSubmit: () => void;
  isSubmitting: boolean;
  language: string;
  onLanguageChange: (lang: string) => void;
  timeLimit?: number; // in minutes
}

export default function Toolbar({
  onSubmit,
  isSubmitting,
  language,
  onLanguageChange,
  timeLimit
}: Props) {
  const [timeLeft, setTimeLeft] = useState<number | null>(
    timeLimit ? timeLimit * 60 : null
  );

  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  });

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      onSubmitRef.current();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header style={{
      height: "64px",
      background: "#fff",
      borderBottom: "1px solid #e0e0e0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      flexShrink: 0,
      boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
    }}>
      {/* Left: Branding/Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          background: "#E8620A", color: "#fff", padding: "4px 12px",
          borderRadius: "6px", fontSize: "12px", fontWeight: 800, letterSpacing: "0.5px"
        }}>
          ASSESSMENT
        </div>
        <div style={{ fontSize: "15px", fontWeight: 600, color: "#333" }}>
          Coding Evaluation
        </div>
      </div>

      {/* Right: Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        {timeLeft !== null && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "6px 14px", borderRadius: "8px", background: "#fdf2f0",
            border: "1px solid #fee2e2"
          }}>
            <span style={{ fontSize: "18px" }}>⏱</span>
            <span style={{
              fontFamily: "monospace", fontSize: "16px", fontWeight: 700,
              color: timeLeft < 60 ? "#dc2626" : "#E8620A"
            }}>
              {formatTime(timeLeft)}
            </span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd",
              fontSize: "13px", background: "#fff", outline: "none", cursor: "pointer"
            }}
          >
            <option value="python">Python 3</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>

          <button
            disabled
            style={{
              padding: "9px 20px", borderRadius: "8px", border: "1px solid #ddd",
              fontSize: "13px", fontWeight: 600, color: "#999",
              background: "#f9fafb", cursor: "not-allowed"
            }}
          >
            Run Code
          </button>

          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            style={{
              padding: "10px 24px", borderRadius: "8px", border: "none",
              fontSize: "14px", fontWeight: 700, color: "#fff",
              background: isSubmitting ? "#aaa" : "#E8620A",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(232,98,10,0.2)"
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Solution"}
          </button>
        </div>
      </div>
    </header>
  );
}
