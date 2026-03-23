import { useState } from "react";

import SkillCard from "./SkillCard";
import { CATEGORIES, SKILLS, type SkillCategory } from "./dashboardService";

type CategoryFilter = "All" | SkillCategory;

const SkillsList = () => {
  const [active, setActive] = useState<CategoryFilter>("All");

  const filtered = active === "All" ? SKILLS : SKILLS.filter((sk) => sk.category === active);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#0d1117" }}>Available Skills</span>
          <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>
            {filtered.length} of {SKILLS.length}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => {
            const isActive = active === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActive(cat)}
                style={
                  isActive
                    ? {
                        border: "1px solid #0d1117",
                        background: "#0d1117",
                        color: "#fff",
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        cursor: "pointer",
                      }
                    : {
                        border: "1px solid #e2e8f0",
                        background: "transparent",
                        color: "#64748b",
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        cursor: "pointer",
                      }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
          marginTop: 4,
        }}
      >
        {filtered.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
};

export default SkillsList;
