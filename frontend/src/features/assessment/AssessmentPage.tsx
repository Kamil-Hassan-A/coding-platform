import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetSession, useRunCode, useSubmitSession } from "./hooks/useAssessment";
import { useEditor } from "./hooks/useEditor";
import Toolbar from "./components/Toolbar";
import ProblemPanel from "./components/ProblemPanel";
import Editor from "./components/Editor";
import CodePlayground from "./components/CodePlayground";
import TestCases from "./components/TestCases";
import type {
  SessionSubmitResponse,
  SessionRunResponse,
  SessionProblemPayload,
  LanguageOption,
} from "./types/assessment";

const SESSION_ID_STORAGE_KEY = "assessment_session_id";
const SESSION_LANGUAGES_STORAGE_KEY = "assessment_allowed_languages";
const SESSION_SKILL_NAME_STORAGE_KEY = "assessment_skill_name";
const DEFAULT_LANGUAGES = ["python", "javascript", "java", "cpp"] as const;
const DEFAULT_LANGUAGE_META: Record<
  (typeof DEFAULT_LANGUAGES)[number],
  { id: number; label: string; monaco: string }
> = {
  python: { id: 71, label: "Python", monaco: "python" },
  javascript: { id: 63, label: "JavaScript", monaco: "javascript" },
  java: { id: 62, label: "Java", monaco: "java" },
  cpp: { id: 54, label: "C++", monaco: "cpp" },
};
const DEFAULT_LANGUAGE_OPTIONS: LanguageOption[] = [
  ...DEFAULT_LANGUAGES.map((lang) => ({
    id: DEFAULT_LANGUAGE_META[lang].id,
    name: DEFAULT_LANGUAGE_META[lang].label,
    monaco: DEFAULT_LANGUAGE_META[lang].monaco,
  })),
];

type InitialAssessmentState = {
  session_id: string;
  problem: SessionProblemPayload;
  skill_name?: string;
  allowed_languages: LanguageOption[];
};

export default function AssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // 1. Session ID Recovery
  const initialState = location.state as InitialAssessmentState | null;
  const [sessionId, setSessionId] = useState<string | null>(initialState?.session_id || null);
  const [allowedLanguages, setAllowedLanguages] = useState<LanguageOption[]>(initialState?.allowed_languages ?? []);
  const [skillName, setSkillName] = useState<string | null>(initialState?.skill_name || null);
  const [isSessionResolved, setIsSessionResolved] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const initialProblem = initialState?.problem ?? null;

  useEffect(() => {
    if (initialState?.session_id) {
      sessionStorage.setItem(SESSION_ID_STORAGE_KEY, initialState.session_id);
      if (initialState.skill_name) {
        sessionStorage.setItem(SESSION_SKILL_NAME_STORAGE_KEY, initialState.skill_name);
        setSkillName(initialState.skill_name);
      }
      if (initialState.allowed_languages?.length) {
        sessionStorage.setItem(
          SESSION_LANGUAGES_STORAGE_KEY,
          JSON.stringify(initialState.allowed_languages),
        );
        setAllowedLanguages(initialState.allowed_languages);
      }
    } else {
      const savedId = sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
      if (savedId) setSessionId(savedId);

      const savedSkill = sessionStorage.getItem(SESSION_SKILL_NAME_STORAGE_KEY);
      if (savedSkill) setSkillName(savedSkill);

      const savedLanguages = sessionStorage.getItem(SESSION_LANGUAGES_STORAGE_KEY);
      if (savedLanguages) {
        try {
          const parsed = JSON.parse(savedLanguages) as LanguageOption[];
          if (Array.isArray(parsed)) {
            setAllowedLanguages(parsed);
          }
        } catch {
          setAllowedLanguages([]);
        }
      }
    }
    setIsSessionResolved(true);
  }, [initialState]);

  // 2. Data Fetching (Recovery/Refresh)
  const { data: recoveredSession, isLoading: isRecovering } = useGetSession(
    !initialState ? sessionId : null,
  );

  const activeProblem = initialProblem || recoveredSession?.problem;
  const draftCode = recoveredSession?.last_draft_code;

  useEffect(() => {
    if (recoveredSession?.allowed_languages?.length) {
      setAllowedLanguages(recoveredSession.allowed_languages);
      sessionStorage.setItem(
        SESSION_LANGUAGES_STORAGE_KEY,
        JSON.stringify(recoveredSession.allowed_languages),
      );
    }
  }, [recoveredSession]);

  const resolvedAllowedLanguages =
    allowedLanguages.length > 0 ? allowedLanguages : DEFAULT_LANGUAGE_OPTIONS;

  const defaultCode = useMemo(() => {
    if (skillName === "HTML, CSS, JS") {
      if (draftCode && draftCode.trim().startsWith("{")) return draftCode;
      
      const prob = initialState?.problem || recoveredSession?.problem;
      if (prob?.starter_code) {
        return JSON.stringify({
          html: prob.starter_code.html || "",
          css: prob.starter_code.css || "",
          js: prob.starter_code.javascript || prob.starter_code.js || ""
        });
      }
      return JSON.stringify({ html: "", css: "", js: "" });
    }
    return initialState?.problem?.templateCode ?? draftCode ?? "";
  }, [skillName, draftCode, initialState?.problem, recoveredSession?.problem]);

  // 3. Editor & Language State
  const { code, setCode } = useEditor(defaultCode);
  const [language, setLanguage] = useState(initialState?.allowed_languages?.[0]?.monaco ?? "python");

  useEffect(() => {
    if (recoveredSession?.last_draft_lang) {
      setLanguage(recoveredSession.last_draft_lang);
    }
  }, [recoveredSession]);

  useEffect(() => {
    if (!resolvedAllowedLanguages.some((lang) => lang.monaco === language)) {
      setLanguage(resolvedAllowedLanguages[0].monaco);
    }
  }, [resolvedAllowedLanguages, language]);

  const activeLanguage = resolvedAllowedLanguages.find((l) => l.monaco === language) || resolvedAllowedLanguages[0];
  const [submissionResult, setSubmissionResult] = useState<SessionSubmitResponse | null>(null);
  const [runResult, setRunResult] = useState<SessionRunResponse | null>(null);

  // 4. Submission Logic
  const { mutate: submit, mutateAsync: submitAsync, isPending: isSubmitting } = useSubmitSession();
  const { mutate: run, isPending: isRunning } = useRunCode();

  const handleRun = () => {
    if (!sessionId) return;
    if (!language) {
      setSubmissionError("No language selected. Please pick a language before running.");
      return;
    }

    setSubmissionError(null);
    run(
      { sessionId, code, language },
      {
        onSuccess: (data) => {
          setRunResult(data);
        },
        onError: () => {
          setSubmissionError("Run failed. Please try again.");
        },
      }
    );
  };

  const handleSubmit = () => {
    if (!sessionId) return;

    if (!language) {
      setSubmissionError("No language selected. Please pick a language before submitting.");
      return;
    }

    setSubmissionError(null);
    submit(
      { session_id: sessionId, payload: { code, language } },
      {
        onSuccess: (data) => {
          setSubmissionResult(data);
          sessionStorage.removeItem(SESSION_ID_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_LANGUAGES_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_SKILL_NAME_STORAGE_KEY);
        },
        onError: () => {
          setSubmissionError("Submission failed. Please try again.");
        },
      }
    );
  };

  const handleEndTest = async () => {
    if (!sessionId) return;

    if (!language) {
      setSubmissionError("No language selected. Please pick a language before ending the test.");
      return;
    }

    setSubmissionError(null);
    try {
      await submitAsync({ session_id: sessionId, payload: { code, language } });
      navigate("/candidate/thankyou");
    } catch (error: any) {
      console.log("End test submission error:", error);
      const status = error?.response?.status;
      if (status === 409) {
        navigate("/candidate/thankyou");
      } else {
        setSubmissionError("Failed to end test. Please try again.");
      }
    }
  };

  const handleTimeExpired = () => {
    if (!sessionId) return;

    if (!language) {
      setSubmissionError("No language selected. Please pick a language before submitting.");
      return;
    }

    setSubmissionError(null);
    submit(
      { session_id: sessionId, payload: { code, language } },
      {
        onSuccess: () => {
          navigate("/candidate/thankyou");
        },
        onError: (error: any) => {
          const status = error?.response?.status;
          if (status === 409) {
            navigate("/candidate/thankyou");
          } else {
            setSubmissionError("Failed to end test. Please try again.");
          }
        },
      }
    );
  };

  if (isSessionResolved && !sessionId && !isRecovering) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-admin-bg font-['Segoe_UI',sans-serif]">
        <h2 className='mb-5 text-admin-text'>No active session found.</h2>
        <button 
          onClick={() => navigate("/candidate/dashboard")}
          className="bg-admin-orange text-white border-0 rounded-lg py-3 px-8 font-bold cursor-pointer"
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
        onEndTest={handleEndTest}
        onTimeExpired={handleTimeExpired}
        onRun={handleRun}
        onSubmit={handleSubmit}
        isRunning={isRunning}
        isSubmitting={isSubmitting}
        language={language}
        onLanguageChange={setLanguage}
        timeLimit={activeProblem.time_limit_minutes}
        allowedLanguages={resolvedAllowedLanguages}
        secondsRemaining={recoveredSession?.seconds_remaining}
      />

      {submissionError && (
        <div className='border-b border-rose-200 bg-rose-50 px-6 py-2.5 text-sm text-rose-700'>
          {submissionError}
        </div>
      )}

      <div className='flex flex-1 overflow-hidden'>
        {/* Left Panel - 40% */}
        <div className='flex w-2/5 flex-col border-r border-admin-border'>
          <ProblemPanel problem={activeProblem} />
        </div>

        {/* Right Panel - 60% */}
        <div className='flex w-3/5 flex-col bg-[#1e1e1e]'>
          <div className='flex-1 overflow-hidden'>
            {skillName === "HTML, CSS, JS" ? (
              <CodePlayground code={code} onChange={setCode} />
            ) : (
              <Editor code={code} onChange={setCode} language={activeLanguage?.monaco || "python"} />
            )}
          </div>
          
          {(submissionResult || runResult) && skillName !== "HTML, CSS, JS" && (
            <div className='h-2/5 overflow-y-auto border-t-2 border-admin-orange bg-white'>
              <TestCases submissionResult={submissionResult} runResult={runResult} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
