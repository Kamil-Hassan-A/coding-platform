import { useParams, useNavigate } from "react-router-dom";

const SkillDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ padding: 24, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <button 
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, cursor: "pointer", background: "none", border: "none", color: "#f97316", fontWeight: 600 }}
      >
        &larr; Back
      </button>
      <h2 style={{ marginTop: 0 }}>Skill Details</h2>
      <p>Viewing details for skill ID: <strong>{id}</strong></p>
      <p style={{ color: "#64748b" }}>This is a placeholder page. You can fetch and display the full skill details here.</p>
    </div>
  );
};

export default SkillDetail;
