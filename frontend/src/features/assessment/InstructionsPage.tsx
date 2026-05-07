import React, { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ClipboardList, ShieldAlert, Monitor, Terminal } from "lucide-react";

import type { CandidateSelection, CandidateSelectionIds } from "../candidate/types/candidate";
import { useStartSession } from "./hooks/useAssessment";

type InstructionsRouteState = {
  confirmed?: CandidateSelection;
  confirmedIds?: CandidateSelectionIds;
};

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

function InstructionItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-transparent p-3.5 transition-colors hover:border-slate-100 hover:bg-slate-50">
      <div className="mt-1 shrink-0 bg-white shadow-sm border border-slate-100 p-2 rounded-lg">
        {icon}
      </div>
      <div>
        <h4 className="text-[15px] font-bold text-slate-800">{title}</h4>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

export default function InstructionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as InstructionsRouteState | null;
  const confirmed = state?.confirmed ?? null;
  const confirmedIds = state?.confirmedIds ?? null;
  const { mutate: startSession, isPending: isStarting } = useStartSession();

  const requestFullscreenSafe = useCallback(async (): Promise<boolean> => {
    const target = document.documentElement as FullscreenTarget;
    const request =
      target.requestFullscreen ||
      target.webkitRequestFullscreen ||
      target.msRequestFullscreen;

    if (!request) {
      return false;
    }

    try {
      const result = request.call(target);
      if (result && typeof (result as Promise<void>).then === "function") {
        await result;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!confirmed || !confirmedIds) {
      navigate("/candidate/dashboard", { replace: true });
    }
  }, [confirmed, confirmedIds, navigate]);

  if (!confirmed || !confirmedIds) {
    return null;
  }

  const handleContinue = async () => {
    const enteredFullscreen = await requestFullscreenSafe();
    startSession(confirmedIds, {
      onSuccess: (data) => {
        navigate(`/candidate/assessment/${data.session_id}`, {
          state: {
            session_id: data.session_id,
            problem: data.problem,
            problems: data.problems ?? [],
            skill_name: confirmed.skill,
            allowed_languages: data.allowed_languages ?? [],
            auto_start: enteredFullscreen,
            expires_at: data.expires_at,
          },
        });
      },
      onError: (error: unknown) => {
        const detail =
          typeof (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail === "string"
            ? ((error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? null)
            : null;

        alert(
          detail
            ? `Failed to start assessment session: ${detail}`
            : "Failed to start assessment session. Please try again.",
        );
      },
    });
  };

  return (
    <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-admin-bg px-4 py-6">
      <div className="flex h-full min-h-0 w-full max-w-[1000px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] md:flex-row">
        
        {/* Left Panel: Branding & Selection Summary (Black/Orange) */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-[#0d0d0d] p-8 text-white md:w-5/12">
          {/* Abstract Background Element */}
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-admin-orange/20 rounded-full blur-[80px]" />
          
          <div className="relative z-10">
            <button 
              onClick={() => navigate("/candidate/dashboard")}
              className="mb-8 flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
            >
              <ChevronLeft size={16} /> Change Selection
            </button>
            
            <div className="mb-2 inline-flex items-center justify-center rounded-lg border border-admin-orange/20 bg-admin-orange/10 p-3 text-admin-orange">
              <Terminal size={28} />
            </div>
            
            <h1 className="mt-4 text-3xl font-bold leading-tight">
              Assessment <span className="text-admin-orange">Center</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Ready to demonstrate your expertise?
            </p>
            
            <div className="mt-8 grid grid-cols-1 gap-5">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-[2px] text-admin-orange uppercase">Selected Skill</span>
                <span className="mt-1 text-lg font-bold">{confirmed.skill}</span>
              </div>
              
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-[2px] text-slate-400 uppercase">Target Level</span>
                <span className="mt-1 text-lg font-bold text-slate-200">{confirmed.levelLabel}</span>
              </div>

              {/* TEST DETAILS (Restored) */}
              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div className="flex flex-col text-slate-300">
                  <span className="text-[10px] font-bold tracking-[2px] text-slate-500 uppercase">Duration</span>
                  <span className="mt-1 text-sm font-semibold">45 Minutes</span>
                </div>
                <div className="flex flex-col text-slate-300">
                  <span className="text-[10px] font-bold tracking-[2px] text-slate-500 uppercase">Questions</span>
                  <span className="mt-1 text-sm font-semibold">1 Problem</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex items-center gap-2 pt-4 text-[10px] text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              System Secure & Environment Ready
          </div>
        </div>

        {/* Right Panel: Instructions & Action (White) */}
        <div className="relative flex min-h-0 flex-1 flex-col bg-white">
          {/* Content */}
          <div className="min-h-0 flex-1 p-8 pb-4 md:px-10 md:pt-10">
            <div className="mb-8 text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-900">General Instructions</h2>
              <p className="mt-2 text-sm text-slate-500">Please read the following rules before starting your assessment.</p>
            </div>
            
            <div className="space-y-4">
              <InstructionItem 
                icon={<Monitor className="text-blue-500" size={20} />}
                title="Fullscreen Requirement"
                desc="The assessment must be taken in fullscreen mode. Any exit from fullscreen will be flagged as a violation."
              />
              
              <InstructionItem 
                icon={<ShieldAlert className="text-rose-500" size={20} />}
                title="Proctored Session"
                desc="No tab switching, no copy-pasting, and no opening DevTools. Violations are tracked and reported automatically."
              />
              
              <InstructionItem 
                icon={<ClipboardList className="text-amber-500" size={20} />}
                title="Auto-Submission"
                desc="Your work is periodically saved as a draft. When the timer expires, your latest code will be automatically submitted."
              />
            </div>
          </div>
          
          {/* Sticky Footer */}
          <div className="border-t border-slate-100 bg-white p-6 pt-4 flex flex-col items-center">
            <p className="mb-4 text-center text-[11px] text-slate-400">
              By clicking continue, you agree to follow the assessment rules and conduct terms.
            </p>
            
            <button
              onClick={handleContinue}
              className="w-full max-w-[280px] bg-admin-orange text-white py-4 px-8 rounded-xl font-bold text-[16px] shadow-[0_10px_25px_-5px_rgba(241,90,43,0.3)] hover:shadow-[0_12px_30px_-5px_rgba(241,90,43,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Continue
            </button>
          </div>
        </div>
      </div>

      {isStarting && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center bg-black/10">
          <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow">
            Starting session...
          </div>
        </div>
      )}
    </div>
  );
}
