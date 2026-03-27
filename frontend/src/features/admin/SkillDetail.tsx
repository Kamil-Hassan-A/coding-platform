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
    <div className='rounded-xl border border-slate-200 bg-white p-6'>
      <button 
        onClick={() => navigate(-1)}
        className='mb-4 cursor-pointer border-none bg-transparent font-semibold text-admin-orange'
      >
        &larr; Back
      </button>

      {isLoading && <p className='text-slate-500'>Loading skill details...</p>}
      {isError && <p className='text-red-700'>Failed to load skill details from backend.</p>}

      {!isLoading && !isError && !skill && (
        <p className='text-slate-500'>No skill found for ID: <strong>{id}</strong></p>
      )}

      {!isLoading && !isError && skill && (
        <>
          <h2 className='mt-0'>{skill.name}</h2>
          <p className='text-slate-700'>{skill.description || "No description available."}</p>
          <p className='mb-0 text-[13px] text-slate-500'>
            Skill ID: <strong>{skill.skill_id}</strong>
          </p>
        </>
      )}
    </div>
  );
};

export default SkillDetail;
