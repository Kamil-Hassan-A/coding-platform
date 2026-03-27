import { useState } from "react";

import SkillCard from "./SkillCard";
import { CATEGORIES, SKILLS } from "./dashboardService";
import type { CategoryFilter } from "./types/admin";

const SkillsList = () => {
  const [active, setActive] = useState<CategoryFilter>("All");

  const filtered = active === "All" ? SKILLS : SKILLS.filter((sk) => sk.category === active);

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <span className='text-[15px] font-semibold text-[#0d1117]'>Available Skills</span>
          <span className='ml-2 text-[12px] text-slate-400'>
            {filtered.length} of {SKILLS.length}
          </span>
        </div>

        <div className='flex flex-wrap gap-2'>
          {CATEGORIES.map((cat) => {
            const isActive = active === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActive(cat)}
                className={`cursor-pointer rounded-[20px] px-3 py-1 text-[12px] ${
                  isActive
                    ? 'border border-[#0d1117] bg-[#0d1117] text-white'
                    : 'border border-slate-200 bg-transparent text-slate-500'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className='mt-1 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]'>
        {filtered.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
};

export default SkillsList;
