import { useState } from "react";

import { TAG_CONFIG } from "./dashboardService";
import type { SkillCardProps } from "./types/admin";

const SkillCard = ({ skill }: SkillCardProps) => {
  const [hovered, setHovered] = useState<boolean>(false);
  const cfg = TAG_CONFIG[skill.tag];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`cursor-default rounded-lg border bg-white p-4 transition-[border-color,box-shadow] duration-150 ${
        hovered
          ? 'border-admin-orange shadow-[0_1px_6px_rgba(249,115,22,0.15)]'
          : 'border-slate-200'
      }`}
    >
      <div className='mb-2.5 text-[13px] font-semibold leading-[1.4] text-[#0d1117]'>
        {skill.name}
      </div>

      <div className='flex items-center justify-between'>
        <span
          className='rounded-[20px] px-2 py-0.5 text-[11px] font-semibold'
          style={{
            ...cfg.style,
          }}
        >
          {cfg.label}
        </span>
        <span className='text-[11px] text-slate-400'>0 attempts</span>
      </div>
    </div>
  );
};

export default SkillCard;
