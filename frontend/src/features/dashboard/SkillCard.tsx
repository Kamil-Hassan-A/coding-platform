import { useState } from "react";

import { TAG_CONFIG, type Skill } from "./dashboardService";

type SkillCardProps = {
  skill: Skill;
};

const SkillCard = ({ skill }: SkillCardProps) => {
  const [hovered, setHovered] = useState<boolean>(false);
  const cfg = TAG_CONFIG[skill.tag];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        padding: 16,
        cursor: "default",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...(hovered
          ? { borderColor: "#f97316", boxShadow: "0 1px 6px rgba(249,115,22,0.15)" }
          : {}),
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#0d1117",
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {skill.name}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            ...cfg.style,
          }}
        >
          {cfg.label}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>0 attempts</span>
      </div>
    </div>
  );
};

export default SkillCard;
