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
const MULTI_QUESTION_FORMAT = "multi_question_v1";

type InitialAssessmentState = {
  session_id: string;
  problem: SessionProblemPayload;
  problems?: SessionProblemPayload[];
  skill_name?: string;
  allowed_languages?: LanguageOption[];
};

function isQuestionSetMetadata(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.format === MULTI_QUESTION_FORMAT;
  } catch {
    return false;
  }
}

function resolveProblemBoilerplate(
  problem: SessionProblemPayload | null | undefined,
  skillName: string | null,
  language: string,
): string {
  if (!problem) return "";

  if (skillName === "HTML, CSS, JS") {
    if (problem.starter_code) {
      return JSON.stringify({
        html: problem.starter_code.html || "",
        css: problem.starter_code.css || "",
        js: problem.starter_code.javascript || problem.starter_code.js || "",
      });
    }
    if (typeof problem.templateCode === "string" && problem.templateCode.trim().startsWith("{")) {
      return problem.templateCode;
    }
    return JSON.stringify({ html: "", css: "", js: "" });
  }

  if (typeof problem.templateCode === "string" && problem.templateCode.trim()) {
    return problem.templateCode;
  }

  const starter = problem.starter_code;
  if (starter && typeof starter === "object") {
    const entries = Object.entries(starter).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0,
    ) as Array<[string, string]>;

    if (entries.length === 0) return "";

    const requestedLanguage = (language || "").trim().toLowerCase();
    if (requestedLanguage) {
      const matched = entries.find(([key]) => key.trim().toLowerCase() === requestedLanguage);
      if (matched) return matched[1];
    }

    const preferred = entries.find(([key]) => key.trim().toLowerCase() === "default");
    if (preferred) return preferred[1];

    return entries[0][1];
  }

  return "";
}

function getProblemKey(problem: SessionProblemPayload, index: number): string {
  if (problem.problem_id) {
    return String(problem.problem_id);
  }
  return `question_${index + 1}`;
}

export default function AssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // 1. Session ID Recovery
  const initialState = location.state as InitialAssessmentState | null;
  const [sessionId, setSessionId] = useState<string | null>(initialState?.session_id || null);
  const [allowedLanguages, setAllowedLanguages] = useState<LanguageOption[]>(initialState?.allowed_languages ?? []);
  const [skillName, setSkillName] = useState<string | null>(initialState?.skill_name || null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
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
  const sessionProblems = useMemo(() => {
    const fromInitial = initialState?.problems ?? [];
    const fromRecovered = recoveredSession?.problems ?? [];
    const source = fromInitial.length > 0 ? fromInitial : fromRecovered.length > 0 ? fromRecovered : (activeProblem ? [activeProblem] : []);

    const unique: SessionProblemPayload[] = [];
    const seen = new Set<string>();

    source.forEach((problem, index) => {
      const key = `${problem.problem_id ?? ""}-${problem.title ?? index}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(problem);
      }
    });

    return unique.slice(0, 2);
  }, [initialState?.problems, recoveredSession?.problems, activeProblem]);

  const displayedProblem = sessionProblems[activeQuestionIndex] ?? activeProblem;
  const draftCode = recoveredSession?.last_draft_code;
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeQuestionIndex > Math.max(0, sessionProblems.length - 1)) {
      setActiveQuestionIndex(0);
    }
  }, [activeQuestionIndex, sessionProblems.length]);

  useEffect(() => {
    if (recoveredSession?.allowed_languages?.length) {
      setAllowedLanguages(recoveredSession.allowed_languages);
      sessionStorage.setItem(
        SESSION_LANGUAGES_STORAGE_KEY,
        JSON.stringify(recoveredSession.allowed_languages),
      );
    }
  }, [recoveredSession]);

  const resolvedAllowedLanguages = allowedLanguages;

  // 3. Editor & Language State
  const { code, setCode } = useEditor("");
  const [language, setLanguage] = useState(initialState?.allowed_languages?.[0]?.monaco ?? "");

  const currentQuestionKey = useMemo(() => {
    if (!displayedProblem) return "";
    return getProblemKey(displayedProblem, activeQuestionIndex);
  }, [displayedProblem, activeQuestionIndex]);

  useEffect(() => {
    if (!displayedProblem) return;

    const problemKey = getProblemKey(displayedProblem, activeQuestionIndex);
    setQuestionDrafts((previous) => {
      if (previous[problemKey] !== undefined) {
        return previous;
      }

      const recoveredDraft =
        activeQuestionIndex === 0 &&
        typeof draftCode === "string" &&
        draftCode.trim().length > 0 &&
        !isQuestionSetMetadata(draftCode)
          ? draftCode
          : null;

      const starter = recoveredDraft ?? resolveProblemBoilerplate(displayedProblem, skillName, language);
      return { ...previous, [problemKey]: starter };
    });
  }, [displayedProblem, activeQuestionIndex, draftCode, skillName, language]);

  useEffect(() => {
    if (!currentQuestionKey) return;
    const nextCode = questionDrafts[currentQuestionKey];
    if (typeof nextCode === "string" && nextCode !== code) {
      setCode(nextCode);
    }
  }, [currentQuestionKey, questionDrafts, code, setCode]);

  const handleCodeChange = (nextCode: string) => {
    setCode(nextCode);
    if (!currentQuestionKey) return;
    setQuestionDrafts((previous) => ({
      ...previous,
      [currentQuestionKey]: nextCode,
    }));
  };

  useEffect(() => {
    if (recoveredSession?.last_draft_lang) {
      setLanguage(recoveredSession.last_draft_lang);
    }
  }, [recoveredSession]);

  useEffect(() => {
    if (resolvedAllowedLanguages.length > 0 && !resolvedAllowedLanguages.some((lang) => lang.monaco === language)) {
      setLanguage(resolvedAllowedLanguages[0].monaco);
    }
  }, [resolvedAllowedLanguages, language]);

  const activeLanguage = resolvedAllowedLanguages.find((l) => l.monaco === language);
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

  if (isRecovering || !displayedProblem) {
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
        timeLimit={displayedProblem.time_limit_minutes}
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
        <div className='flex w-2/5 border-r border-admin-border bg-white'>
          {sessionProblems.length > 1 && (
            <div className='w-[132px] shrink-0 border-r border-admin-border bg-slate-50 p-3'>
              <div className='flex flex-col gap-2'>
                {sessionProblems.map((problem, index) => {
                  const isActive = index === activeQuestionIndex;
                  return (
                    <button
                      key={`${problem.problem_id ?? "problem"}-${index}`}
                      onClick={() => setActiveQuestionIndex(index)}
                      className={`rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-admin-orange text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {`Question ${index + 1}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className='min-h-0 min-w-0 flex-1 overflow-y-auto'>
            <ProblemPanel problem={displayedProblem} />
          </div>
        </div>

        {/* Right Panel - 60% */}
        <div className='flex w-3/5 flex-col bg-[#1e1e1e]'>
          <div className='flex-1 overflow-hidden'>
            {skillName === "HTML, CSS, JS" ? (
              <CodePlayground code={code} onChange={handleCodeChange} />
            ) : (
              <Editor code={code} onChange={handleCodeChange} language={activeLanguage?.monaco || "plaintext"} />
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
