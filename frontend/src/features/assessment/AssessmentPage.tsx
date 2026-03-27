import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetSession, useSubmitSession } from "./hooks/useAssessment";
import { useEditor } from "./hooks/useEditor";
import Toolbar from "./components/Toolbar";
import ProblemPanel from "./components/ProblemPanel";
import Editor from "./components/Editor";
import TestCases from "./components/TestCases";
import type { SessionSubmitResponse, SessionProblemPayload } from "./types/assessment";
import type { AllowedLanguage } from "../../features/candidate/types/candidate";

export default function AssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 1. Session ID Recovery
  const initialState = location.state as { session_id: string; problem: SessionProblemPayload; skill_name?: string; allowed_languages?: AllowedLanguage[] } | null;
  const [sessionId, setSessionId] = useState<string | null>(initialState?.session_id || null);
  const [isSessionResolved, setIsSessionResolved] = useState(false);
  const initialProblem = initialState?.problem ?? null;

  useEffect(() => {
    if (initialState?.session_id) {
      sessionStorage.setItem("assessment_session_id", initialState.session_id);
    } else {
      const savedId = sessionStorage.getItem("assessment_session_id");
      if (savedId) setSessionId(savedId);
    }
    setIsSessionResolved(true);
  }, [initialState]);

  // 2. Data Fetching (Recovery/Refresh)
  const { data: recoveredSession, isLoading: isRecovering } = useGetSession(
    !initialState ? sessionId : null,
  );

  const activeProblem = initialProblem || recoveredSession?.problem;
  const draftCode = recoveredSession?.last_draft_code;

  const allowedLanguages = initialState?.allowed_languages || [];

  // Infer default language if creating a new draft
  const getSmartDefaultLanguage = () => {
    if (allowedLanguages.length > 0) return allowedLanguages[0].id.toString();
    return "71"; // Fallback directly to Python 3 ID
  };

  // 3. Editor & Language State
  const { code, setCode } = useEditor(
    initialState?.problem?.templateCode ?? draftCode ?? "",
  );
  const [languageId, setLanguageId] = useState(recoveredSession?.last_draft_lang ?? getSmartDefaultLanguage());
  const activeLanguage = allowedLanguages.find(l => l.id.toString() === languageId) || allowedLanguages[0];
  const [submissionResult, setSubmissionResult] = useState<SessionSubmitResponse | null>(null);

  // 4. Submission Logic
  const { mutate: submit, isPending: isSubmitting } = useSubmitSession();

  const handleSubmit = () => {
    if (!sessionId) return;
    submit(
      { session_id: sessionId, payload: { code, language: languageId } },
      {
        onSuccess: (data) => {
          setSubmissionResult(data);
          sessionStorage.removeItem("assessment_session_id");
        },
        onError: () => {
          alert("Submission failed. Please try again.");
        },
      }
    );
  };

  useEffect(() => {
    if (draftCode) {
      setCode(draftCode);
    }
  }, [draftCode, setCode]);

  useEffect(() => {
    if (recoveredSession?.last_draft_lang) {
      setLanguageId(recoveredSession.last_draft_lang);
    }
  }, [recoveredSession?.last_draft_lang]);

  if (isSessionResolved && !sessionId && !isRecovering) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-admin-bg font-['Segoe_UI',sans-serif]">
        <h2 className='mb-5 text-admin-text'>No active session found.</h2>
        <button 
          onClick={() => navigate("/candidate/dashboard")}
          className='cursor-pointer rounded-xl border-none bg-admin-orange px-8 py-3 font-bold text-white shadow-lg shadow-admin-orange/20 transition-all hover:-translate-y-0.5'
        >
          Go back to Dashboard
        </button>
      </div>
    );
  }

  if (isRecovering || !activeProblem) {
    return (
      <div className='flex h-screen items-center justify-center bg-admin-bg'>
        <div className='flex flex-col items-center gap-4'>
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-admin-orange/30 border-t-admin-orange"></div>
          <div className='font-semibold text-admin-orange'>Loading Assessment...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-admin-bg font-['Segoe_UI',sans-serif]">
      <Toolbar 
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        languageId={languageId}
        onLanguageChange={setLanguageId}
        timeLimit={activeProblem.time_limit_minutes}
        allowedLanguages={allowedLanguages}
      />

      <div className='flex flex-1 overflow-hidden'>
        {/* Left Panel - 40% */}
        <div className='flex w-2/5 flex-col border-r border-admin-border'>
          <ProblemPanel problem={activeProblem} />
        </div>

        {/* Right Panel - 60% */}
        <div className='flex w-3/5 flex-col bg-[#1e1e1e]'>
          <div className='flex-1 overflow-hidden'>
            <Editor code={code} onChange={setCode} language={activeLanguage?.monaco || "python"} />
          </div>
          
          {submissionResult && (
            <div className='h-2/5 overflow-y-auto border-t-2 border-admin-orange bg-white'>
              <TestCases result={submissionResult} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
