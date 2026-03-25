import React, { useState } from "react";
import type { SessionSubmitResponse, TestCaseResult } from "../types/assessment";

interface Props {
  result: SessionSubmitResponse;
}

export default function TestCases({ result }: Props) {
  return (
    <div style={{ padding: "24px", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Summary Header */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        marginBottom: "24px",
        paddingBottom: "16px",
        borderBottom: "1px solid #eee"
      }}>
        <div style={{ display: "flex", gap: "24px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#999", letterSpacing: "0.5px" }}>OVERALL SCORE</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#111" }}>{result.score}%</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#999", letterSpacing: "0.5px" }}>TEST CASES</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#111" }}>
              {result.passed_tests} / {result.total_tests}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#999" }}>TIME TAKEN</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#555" }}>{result.time_taken_seconds}s</div>
          </div>
          <div style={{
            background: result.status === "cleared" ? "#dcfce7" : "#fee2e2",
            color: result.status === "cleared" ? "#166534" : "#991b1b",
            padding: "8px 16px",
            borderRadius: "50px",
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase"
          }}>
            {result.status}
          </div>
        </div>
      </div>

      {/* Test Case Breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {result.cases.map((tc, i) => (
          <TestCaseRow key={i} index={i} tc={tc} />
        ))}
      </div>
    </div>
  );
}

function TestCaseRow({ index, tc }: { index: number; tc: TestCaseResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      border: "1px solid #eee",
      borderRadius: "10px",
      overflow: "hidden"
    }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          background: expanded ? "#f9fafb" : "#fff",
          transition: "background 0.2s"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ 
            fontSize: "18px",
            color: tc.passed ? "#22c55e" : "#ef4444" 
          }}>
            {tc.passed ? "✓" : "✗"}
          </span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#333" }}>
            Test Case {index + 1}
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "#999", display: "flex", alignItems: "center", gap: "4px" }}>
          {(tc.status.description as string) || (tc.passed ? "Accepted" : "Wrong Answer")}
          <span style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "20px", borderTop: "1px solid #eee", background: "#fcfcfc" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#999", marginBottom: "6px" }}>INPUT</div>
              <pre style={codeStyle}>{tc.stdin || "(empty)"}</pre>
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#999", marginBottom: "6px" }}>EXPECTED OUTPUT</div>
              <pre style={codeStyle}>{tc.expected_output || "(empty)"}</pre>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#999", marginBottom: "6px" }}>ACTUAL OUTPUT</div>
              <pre style={{ 
                ...codeStyle, 
                color: tc.passed ? "#166534" : "#991b1b",
                background: tc.passed ? "#f0fdf4" : "#fef2f2",
                border: tc.passed ? "1px solid #bbf7d0" : "1px solid #fecaca"
              }}>
                {tc.stdout || "(empty)"}
              </pre>
            </div>
            {tc.stderr && (
              <div style={{ gridColumn: "span 2" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", marginBottom: "6px" }}>ERROR</div>
                <pre style={{ ...codeStyle, color: "#ef4444", background: "#fff1f2", border: "1px solid #fecdd3" }}>
                  {tc.stderr}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  margin: 0,
  padding: "12px",
  background: "#fff",
  borderRadius: "6px",
  border: "1px solid #eee",
  fontSize: "13px",
  fontFamily: "monospace",
  whiteSpace: "pre-wrap"
};
