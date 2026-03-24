import React from "react";
import type { SessionProblemPayload } from "../types/assessment";

interface Props {
  problem: SessionProblemPayload;
}

export default function ProblemPanel({ problem }: Props) {
  return (
    <div style={{ 
      flex: 1, 
      display: "flex", 
      flexDirection: "column", 
      background: "#fff", 
      height: "100%",
      overflowY: "auto"
    }}>
      <div style={{ padding: "32px" }}>
        {/* Title */}
        <h1 style={{ 
          fontSize: "24px", 
          fontWeight: 800, 
          color: "#111", 
          marginBottom: "20px",
          lineHeight: 1.3
        }}>
          {problem.title}
        </h1>

        {/* Description */}
        <div style={{ 
          fontSize: "15px", 
          color: "#444", 
          lineHeight: 1.7, 
          whiteSpace: "pre-wrap",
          marginBottom: "40px"
        }}>
          {problem.description}
        </div>

        {/* Sample Test Cases */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: "32px" }}>
          <h3 style={{ 
            fontSize: "14px", 
            fontWeight: 700, 
            color: "#999", 
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            marginBottom: "20px"
          }}>
            Sample Test Cases
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {problem.sample_test_cases.map((tc, i) => (
              <div key={i} style={{
                background: "#f8f9fa",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #eef0f2"
              }}>
                <div style={{ display: "flex", gap: "24px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", marginBottom: "8px" }}>INPUT</div>
                    <pre style={{ 
                      margin: 0, padding: "10px", background: "#fff", borderRadius: "6px",
                      fontSize: "13px", color: "#333", border: "1px solid #eee", fontFamily: "monospace"
                    }}>
                      {tc.stdin || " (empty) "}
                    </pre>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", marginBottom: "8px" }}>EXPECTED OUTPUT</div>
                    <pre style={{ 
                      margin: 0, padding: "10px", background: "#fff", borderRadius: "6px",
                      fontSize: "13px", color: "#333", border: "1px solid #eee", fontFamily: "monospace"
                    }}>
                      {tc.expected_output}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
