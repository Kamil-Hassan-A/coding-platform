import { useState } from "react";
import type { BackendLevel, Skill, SkillModalProps } from "../types/candidate";

export default function SkillModal({ skills, levels, onClose, onConfirm }: SkillModalProps) {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const canProceedStep1 = selectedSkill !== null;
  const canProceedStep2 = selectedLevel !== "";

  const handleProceed = () => {
    if (step === 1 && canProceedStep1) {
      setStep(2);
    } else if (step === 2 && canProceedStep2) {
      const levelObj = levels.find((l) => l.id === selectedLevel);
      if (levelObj && selectedSkill) {
        onConfirm(selectedSkill.name, levelObj.label, selectedSkill.skill_id, selectedLevel as BackendLevel);
      }
    }
  };

  return (
    <div
      className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 backdrop-blur-[4px]'
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className='w-[540px] max-w-[95vw] overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.3)]'
      >
        <div className='relative bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] px-8 pb-6 pt-7'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='mb-1.5 text-[11px] font-semibold tracking-[1.5px] text-white/50'>ASSESSMENT SETUP</div>
              <div className='text-[20px] font-extrabold text-white'>
                {step === 1 ? "Choose Your Skill" : "Select Proficiency Level"}
              </div>
            </div>
            <button
              onClick={onClose}
              className='flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-white/10 text-[18px] text-white'
            >
              ×
            </button>
          </div>

          <div className='mt-5 flex gap-2'>
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-[3px] flex-1 rounded-sm transition-colors ${
                  s <= step ? "bg-[#E8620A]" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <div className='p-8'>
          {step === 1 ? (
            <div>
              <label className='mb-2.5 block text-[13px] font-semibold text-[#555]'>Select a skill area</label>

              <div className='relative'>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-lg border-2 px-4 py-3.5 text-left text-[14px] transition-colors ${
                    dropdownOpen ? "border-[#E8620A]" : "border-[#e0e0e0]"
                  } ${selectedSkill ? "text-[#111]" : "text-[#aaa]"} bg-[#f8f9fa]`}
                >
                  <span>{selectedSkill?.name || "— Choose a skill —"}</span>
                  <span className={`text-[#E8620A] transition-transform ${dropdownOpen ? "rotate-180" : "rotate-0"}`}>▾</span>
                </button>

                {dropdownOpen && (
                  <div className='absolute left-0 right-0 top-[calc(100%+6px)] z-10 max-h-[280px] overflow-y-auto rounded-lg border-2 border-[#E8620A] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]'>
                    {skills.map((skill, i) => {
                      const isSelected = selectedSkill?.skill_id === skill.skill_id;
                      return (
                        <div
                          key={skill.skill_id}
                          onClick={() => {
                            setSelectedSkill(skill);
                            setDropdownOpen(false);
                          }}
                          className={`flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[14px] transition-colors ${
                            isSelected
                              ? "bg-[rgba(232,98,10,0.06)] font-bold text-[#E8620A]"
                              : "bg-transparent font-normal text-[#333]"
                          } ${i < skills.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                              isSelected ? "bg-[#E8620A] text-white" : "bg-[#f0f0f0] text-[#999]"
                            }`}
                          >
                            {i + 1}
                          </span>
                          {skill.name}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedSkill && (
                <div className='mt-4 flex items-center gap-2.5 rounded-lg border border-[rgba(232,98,10,0.2)] bg-[rgba(232,98,10,0.06)] px-4 py-3'>
                  <span className='text-[18px]'>✓</span>
                  <span className='text-[13px] text-[#333]'>
                    Selected: <strong className='text-[#E8620A]'>{selectedSkill.name}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className='mb-4 block text-[13px] font-semibold text-[#555]'>
                Choose your proficiency level for <span className='text-[#E8620A]'>{selectedSkill?.name}</span>
              </label>

              <div className='flex flex-col gap-2.5'>
                {levels.map((level) => {
                  const isSelected = selectedLevel === level.id;
                  return (
                    <div
                      key={level.id}
                      onClick={() => setSelectedLevel(level.id)}
                      className='flex cursor-pointer items-center gap-3.5 rounded-[10px] border-2 px-[18px] py-3.5 transition-all'
                      style={{
                        /* dynamic — intentionally inline */
                        borderColor: isSelected ? level.color : "#eee",
                        background: isSelected ? `${level.color}10` : "#fafafa",
                      }}
                    >
                      <div
                        className='h-[14px] w-[14px] shrink-0 rounded-full border-[3px] transition-colors'
                        style={{
                          /* dynamic — intentionally inline */
                          borderColor: level.color,
                          background: isSelected ? level.color : "transparent"
                        }}
                      />
                      <div>
                        <div className='text-[14px] font-bold text-[#222]'>{level.label}</div>
                        <div className='mt-0.5 text-[12px] text-[#888]'>{level.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className='flex items-center justify-between px-8 pb-7 pt-4'>
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            className='cursor-pointer rounded-lg border-[1.5px] border-[#ddd] bg-transparent px-6 py-[11px] text-[14px] text-[#666]'
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>

          <button
            onClick={handleProceed}
            disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            className={`rounded-lg border-none px-8 py-3 text-[14px] font-bold ${
              step === 1 ? (canProceedStep1 ? "cursor-pointer bg-[#E8620A] text-white" : "cursor-not-allowed bg-[#ddd] text-[#aaa]") :
              canProceedStep2 ? "cursor-pointer bg-[#E8620A] text-white" : "cursor-not-allowed bg-[#ddd] text-[#aaa]"
            }`}
          >
            {step === 1 ? "Next →" : "Begin Assessment →"}
          </button>
        </div>
      </div>
    </div>
  );
}
