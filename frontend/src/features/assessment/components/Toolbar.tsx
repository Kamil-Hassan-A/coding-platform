import { useState, useEffect, useRef } from "react";
import type { AllowedLanguage } from "../../candidate/types/candidate";

interface Props {
  onSubmit: () => void;
  isSubmitting: boolean;
  languageId: string;
  onLanguageChange: (langId: string) => void;
  timeLimit?: number; // in minutes
  secondsRemaining?: number;
}

export default function Toolbar({
  onSubmit,
  isSubmitting,
  languageId,
  onLanguageChange,
  timeLimit,
  secondsRemaining
}: Props) {
  const [timeLeft, setTimeLeft] = useState<number | null>(
    secondsRemaining !== undefined ? secondsRemaining : (timeLimit ? timeLimit * 60 : null)
  );

  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  });

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      onSubmitRef.current();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className='flex h-16 shrink-0 items-center justify-between border-b border-admin-border bg-white px-6 shadow-sm'>
      {/* Left: Branding/Title */}
      <div className='flex items-center gap-3'>
        <div className='rounded-md bg-admin-orange px-3 py-1 text-[12px] font-extrabold tracking-[0.5px] text-white'>
          ASSESSMENT
        </div>
        <div className='text-[15px] font-semibold text-admin-text'>
          Coding Evaluation
        </div>
      </div>

      {/* Right: Controls */}
      <div className='flex items-center gap-6'>
        {timeLeft !== null && (
          <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5'>
            <span className='text-[18px]'>⏱</span>
            <span className={`font-mono text-[16px] font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-admin-orange'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        )}

        <div className='flex items-center gap-3'>
          {allowedLanguages.length > 0 ? (
            <select
              value={languageId}
              onChange={(e) => onLanguageChange(e.target.value)}
              className='cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium outline-none transition-all hover:border-admin-orange focus:border-admin-orange focus:ring-2 focus:ring-admin-orange/20'
            >
              {allowedLanguages.map((lang) => (
                <option key={lang.id} value={lang.id.toString()}>{lang.name}</option>
              ))}
            </select>
          ) : (
            <div className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700'>
              No languages available
            </div>
          )}

          <button
            disabled
            className='cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-5 py-[9px] text-[13px] font-semibold text-slate-400'
          >
            Run Code
          </button>

          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className={`rounded-lg border-none px-6 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-admin-orange/20 transition-all ${isSubmitting ? 'cursor-not-allowed bg-slate-400 hover:translate-y-0 hover:shadow-none' : 'cursor-pointer bg-admin-orange hover:-translate-y-0.5 hover:shadow-admin-orange/40'}`}
          >
            {isSubmitting ? "Submitting..." : "Submit Solution"}
          </button>
        </div>
      </div>
    </header>
  );
}
