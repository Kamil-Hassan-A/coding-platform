import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getSkills } from "../candidate/candidateService";

const SkillDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: skills = [], isLoading, isError } = useQuery({
    queryKey: ["skills"],
    queryFn: getSkills,
    staleTime: 1000 * 60 * 5,
  });

  const skill = skills.find((item) => item.skill_id === id);

  return (
    <div style={{ padding: 24, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <button 
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, cursor: "pointer", background: "none", border: "none", color: "#f97316", fontWeight: 600 }}
      >
        &larr; Back
      </button>

      {isLoading && <p style={{ color: "#64748b" }}>Loading skill details...</p>}
      {isError && <p style={{ color: "#b91c1c" }}>Failed to load skill details from backend.</p>}

      {!isLoading && !isError && !skill && (
        <p style={{ color: "#64748b" }}>No skill found for ID: <strong>{id}</strong></p>
      )}

      {!isLoading && !isError && skill && (
        <>
          <h2 style={{ marginTop: 0 }}>{skill.name}</h2>
          <p style={{ color: "#334155" }}>{skill.description || "No description available."}</p>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 0 }}>
            Skill ID: <strong>{skill.skill_id}</strong>
          </p>
        </>
      )}
    </div>
  );
};

export default SkillDetail;
