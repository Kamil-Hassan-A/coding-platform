import React from "react";

export default function Toolbar() {
  return (
    <div style={{ padding: "12px 20px", display: "flex", gap: "10px", borderBottom: "1px solid #ddd", background: "#fff" }}>
      <button style={{ padding: "8px 16px", cursor: "pointer" }}>Run Code</button>
      <button style={{ padding: "8px 16px", cursor: "pointer", background: "#f97316", color: "#fff", border: "none" }}>Submit Assessment</button>
    </div>
  );
}
