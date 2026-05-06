import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetSession, useRunCode, useSubmitSession } from "./hooks/useAssessment";
import { useEditor } from "./hooks/useEditor";
import Toolbar from "./components/Toolbar";
import ProblemPanel from "./components/ProblemPanel";
import Editor from "./components/Editor";
import CodePlayground from "./components/CodePlayground";
import AgileMcqPanel from "./components/AgileMcqPanel";
import TestCases from "./components/TestCases";
import { reportViolation } from "./services/assessmentService";
import { SQL_STARTER_COMMENT } from "./utils/sqlUi";
import type {
  SessionSubmitResponse,
  SessionRunResponse,
  SessionProblemPayload,
  LanguageOption,
  SessionQuestionAnswerPayload,
} from "./types/assessment";

const SESSION_ID_STORAGE_KEY = "assessment_session_id";
const SESSION_LANGUAGES_STORAGE_KEY = "assessment_allowed_languages";
const SESSION_SKILL_NAME_STORAGE_KEY = "assessment_skill_name";
const MULTI_QUESTION_FORMAT = "multi_question_v1";
const WEB_SANDBOX_SKILL_ALIASES = new Set(["htmlcssjs"]);

type InitialAssessmentState = {
  session_id: string;
  problem: SessionProblemPayload;
  problems?: SessionProblemPayload[];
  skill_name?: string;
  allowed_languages?: LanguageOption[];
};

type AgileAnalysisItem = {
  questionLabel: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
};

const DOTNET_SKILL_ALIASES = new Set([".net, c#", ".net,c#", "c#", "csharp", "dotnet", ".net"]);

const DOTNET_STARTER_BY_LANGUAGE: Record<string, string> = {
  csharp: `using System;

public class Program
{
    public static void Main(string[] args)
    {
        // Write your solution here
    }
}`,
  vb: `Imports System

Module Program
    Sub Main(args As String())
        ' Write your solution here
    End Sub
End Module`,
};

function canonicalMonacoLanguage(rawLanguage: string | null | undefined): string {
  const raw = (rawLanguage || "").trim().toLowerCase();
  const collapsed = raw.replace(/[\s._(),-]+/g, "");

  if (
    raw === "c#" ||
    raw === "csharp" ||
    raw === "cs" ||
    raw === "dotnet" ||
    raw === ".net" ||
    raw === ".net, c#" ||
    raw === ".net,c#" ||
    collapsed === "c#" ||
    collapsed === "csharp" ||
    collapsed === "cs" ||
    collapsed === "dotnet" ||
    collapsed === "net" ||
    collapsed === "netc#" ||
    collapsed === "netcsharp"
  ) {
    return "csharp";
  }

  if (
    raw === "vb" ||
    raw === "vb.net" ||
    raw === "vbnet" ||
    raw === "visual basic" ||
    raw === "visual basic.net" ||
    raw === "visual basic .net" ||
    collapsed === "vb" ||
    collapsed === "vbnet" ||
    collapsed === "visualbasic" ||
    collapsed === "visualbasicnet"
  ) {
    return "vb";
  }

  return raw;
}

function normalizeAllowedLanguages(languages: LanguageOption[]): LanguageOption[] {
  return (languages ?? []).map((languageOption) => ({
    ...languageOption,
    monaco: canonicalMonacoLanguage(languageOption.monaco || languageOption.name),
  }));
}

function isDotNetSkillName(skillName: string | null | undefined): boolean {
  return DOTNET_SKILL_ALIASES.has((skillName || "").trim().toLowerCase());
}

function normalizeSkillAlias(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isWebSandboxSkillName(skillName: string | null | undefined): boolean {
  return WEB_SANDBOX_SKILL_ALIASES.has(normalizeSkillAlias(skillName));
}

function isWebSandboxProblem(problem: SessionProblemPayload | null | undefined, skillName: string | null): boolean {
  if (!problem) return false;

  const starter = problem.starter_code;
  const hasWebStarter = Boolean(
    starter &&
      typeof starter === "object" &&
      ((starter.html && starter.css) || starter.javascript || starter.js),
  );

  const tags = (problem.tags ?? []).map((tag) => normalizeSkillAlias(tag));
  const hasWebTag = tags.some((tag) => ["html", "css", "javascript", "js", "web", "frontend", "htmlcssjs"].includes(tag));

  if (hasWebStarter || hasWebTag) return true;
  return isWebSandboxSkillName(skillName);
}

function resolveApiErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const text = detail
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join(" | ");
    if (text.trim()) return text;
  }
  return fallback;
}

function isQuestionSetMetadata(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.format === MULTI_QUESTION_FORMAT;
  } catch {
    return false;
  }
}

/** Pick a clean per-language scaffold for the editor.
 *
 *  For SQL we never let raw CREATE TABLE / INSERT INTO setup (which legacy
 *  datasets sometimes stored under the `default` key) reach the candidate.
 *  Instead we surface a HackerRank-style comment that explains how to write
 *  their query. The hidden setup is prepended on the backend before Judge0
 *  runs the candidate's code.
 */
function resolveProblemBoilerplate(
  problem: SessionProblemPayload | null | undefined,
  skillName: string | null,
  language: string,
): string {
  if (!problem) return "";

  if (skillName === "HTML, CSS, JS") {
    if (problem.starter_code && !("files" in problem.starter_code)) {
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

  const requestedLanguage = (language || "").trim().toLowerCase();
  const isSqlQuestion = (problem.question_type || "").trim().toLowerCase() === "sql";

  if (isSqlQuestion) {
    // Hard-reset: every SQL problem starts with the same clean comment.
    // The dataset/backend may sometimes pre-fill the answer in
    // starter_code.sql (e.g. recursive CTE problems where the starter IS
    // the solution); we never want that to leak into the candidate's
    // editor. Per-question drafts persist via questionDrafts elsewhere.
    return SQL_STARTER_COMMENT;
  }

  if (typeof problem.templateCode === "string" && problem.templateCode.trim()) {
    return problem.templateCode;
  }

  const starter = problem.starter_code;
  if (starter && typeof starter === "object") {
    const files = Array.isArray((starter as { files?: unknown }).files)
      ? (starter as { files: Array<{ path?: string; content?: unknown }> }).files
      : [];
    const readonlyFiles = Array.isArray((starter as { readonly_files?: unknown }).readonly_files)
      ? new Set((starter as { readonly_files: string[] }).readonly_files)
      : new Set<string>();

    const readFileContent = (targetPath: string): string | null => {
      for (const entry of files) {
        if (!entry || typeof entry !== "object") continue;
        const path = String(entry.path ?? "").trim();
        if (path === targetPath && typeof entry.content === "string") {
          return entry.content;
        }
      }
      return null;
    };

    const preferredFile = readFileContent("solution.py");
    if (preferredFile) return preferredFile;

    for (const entry of files) {
      if (!entry || typeof entry !== "object") continue;
      const path = String(entry.path ?? "").trim();
      if (!path || readonlyFiles.has(path)) continue;
      if (typeof entry.content === "string") return entry.content;
    }

    for (const entry of files) {
      if (!entry || typeof entry !== "object") continue;
      if (typeof entry.content === "string") return entry.content;
    }

    const entries = Object.entries(starter).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0,
    ) as Array<[string, string]>;

    if (entries.length === 0) return "";

    const requestedLanguage = canonicalMonacoLanguage(language);
    if (requestedLanguage) {
      const matched = entries.find(([key]) => canonicalMonacoLanguage(key) === requestedLanguage);
      if (matched) return matched[1];
    }

    const defaultEntry = entries.find(([key]) => key.trim().toLowerCase() === "default");
    if (defaultEntry) return defaultEntry[1];

    return entries[0][1];
  }

  const canonicalLanguage = canonicalMonacoLanguage(language);
  if (canonicalLanguage === "csharp" || canonicalLanguage === "vb") {
    return DOTNET_STARTER_BY_LANGUAGE[canonicalLanguage];
  }

  if (isDotNetSkillName(skillName)) {
    return DOTNET_STARTER_BY_LANGUAGE.csharp;
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
  const [sessionId, setSessionId] = useState<string | null>(routeSessionId || initialState?.session_id || null);
  const [allowedLanguages, setAllowedLanguages] = useState<LanguageOption[]>(initialState?.allowed_languages ?? []);
  const [skillName, setSkillName] = useState<string | null>(initialState?.skill_name || null);
  const isAgileMcq = (skillName ?? "").trim().toLowerCase() === "agile";
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [isSessionResolved, setIsSessionResolved] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [sandboxRunSignal, setSandboxRunSignal] = useState(0);
  const [sandboxRunMessage, setSandboxRunMessage] = useState<string | null>(null);
  const [sandboxRunUrl, setSandboxRunUrl] = useState<string | null>(null);
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

    const maxVisibleQuestions = isAgileMcq ? 5 : 2;
    return unique.slice(0, maxVisibleQuestions);
  }, [initialState?.problems, recoveredSession?.problems, activeProblem, isAgileMcq]);

  const displayedProblem = sessionProblems[activeQuestionIndex] ?? activeProblem;
  const isWebSandboxQuestion = useMemo(
    () => isWebSandboxProblem(displayedProblem, skillName),
    [displayedProblem, skillName],
  );
  const draftCode = recoveredSession?.last_draft_code;
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [mcqSavedAnswers, setMcqSavedAnswers] = useState<Record<string, string>>({});

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

  // 3. Editor & Language State
  const { code, setCode } = useEditor("");
  const [language, setLanguage] = useState(canonicalMonacoLanguage(initialState?.allowed_languages?.[0]?.monaco ?? ""));

  const currentQuestionKey = useMemo(() => {
    if (!displayedProblem) return "";
    return getProblemKey(displayedProblem, activeQuestionIndex);
  }, [displayedProblem, activeQuestionIndex]);

  /** Latest question key — used so async run callbacks ignore stale completions after switching questions. */
  const currentQuestionKeyRef = useRef(currentQuestionKey);
  currentQuestionKeyRef.current = currentQuestionKey;

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
      setLanguage(canonicalMonacoLanguage(recoveredSession.last_draft_lang));
    }
  }, [recoveredSession]);

  const resolvedAllowedLanguages = useMemo(
    () => normalizeAllowedLanguages(allowedLanguages),
    [allowedLanguages],
  );

  useEffect(() => {
    if (
      resolvedAllowedLanguages.length > 0 &&
      !resolvedAllowedLanguages.some((lang) => lang.monaco === canonicalMonacoLanguage(language))
    ) {
      setLanguage(resolvedAllowedLanguages[0].monaco);
    }
  }, [resolvedAllowedLanguages, language]);

  const activeLanguage = resolvedAllowedLanguages.find(
    (l) => l.monaco === canonicalMonacoLanguage(language),
  );
  const [submissionResult, setSubmissionResult] = useState<SessionSubmitResponse | null>(null);
  const [runResult, setRunResult] = useState<SessionRunResponse | null>(null);

  useEffect(() => {
    setSubmissionResult(null);
    setRunResult(null);
    setSandboxRunMessage(null);
    setSandboxRunUrl(null);
  }, [currentQuestionKey]);

  const resolveSubmitLanguage = (): string => {
    if (language) return canonicalMonacoLanguage(language);
    if (isDotNetSkillName(skillName)) return "csharp";
    return resolvedAllowedLanguages[0]?.monaco || "python";
  };

  const buildMcqAnswersPayload = (): SessionQuestionAnswerPayload[] => {
    const submitLanguage = resolveSubmitLanguage();

    return sessionProblems
      .map((problem, index) => {
        const option = mcqSavedAnswers[getProblemKey(problem, index)];
        if (!problem.problem_id || !option) {
          return null;
        }

        return {
          problem_id: problem.problem_id,
          code: option,
          language: submitLanguage,
        };
      })
      .filter((answer): answer is SessionQuestionAnswerPayload => answer !== null);
  };

  const buildSubmitPayload = () => {
    if (!isAgileMcq) {
      if (!language) {
        setSubmissionError("No language selected. Please pick a language before submitting.");
        return null;
      }

      const submitLanguage = resolveSubmitLanguage();
      if (sessionProblems.length <= 1) {
        return { code, language: submitLanguage };
      }

      const answers: SessionQuestionAnswerPayload[] = sessionProblems
        .map((problem, index) => {
          const problemKey = getProblemKey(problem, index);
          const draft = questionDrafts[problemKey];
          if (!problem.problem_id) {
            return null;
          }

          return {
            problem_id: problem.problem_id,
            code: typeof draft === "string" ? draft : "",
            language: submitLanguage,
          };
        })
        .filter((answer): answer is SessionQuestionAnswerPayload => answer !== null);

      if (answers.length < sessionProblems.length || answers.some((answer) => !answer.code.trim())) {
        setSubmissionError(`Please solve all ${sessionProblems.length} questions before submitting.`);
        return null;
      }

      return {
        code: answers[0]?.code ?? code,
        language: submitLanguage,
        answers,
      };
    }

    const answers = buildMcqAnswersPayload();
    if (answers.length < sessionProblems.length || answers.length === 0) {
      setSubmissionError("Please choose an option for each Agile MCQ before submitting.");
      return null;
    }

    return {
      code: "MCQ",
      language: resolveSubmitLanguage(),
      answers,
    };
  };

  const saveCurrentMcqAnswer = (): boolean => {
    if (!currentQuestionKey) {
      return false;
    }

    const selected = mcqAnswers[currentQuestionKey];
    if (!selected) {
      setSubmissionError("Select an option before saving.");
      return false;
    }

    setMcqSavedAnswers((previous) => ({
      ...previous,
      [currentQuestionKey]: selected,
    }));
    setSubmissionError(null);
    return true;
  };

  const clearCurrentMcqAnswer = () => {
    if (!currentQuestionKey) {
      return;
    }

    setMcqAnswers((previous) => {
      const updated = { ...previous };
      delete updated[currentQuestionKey];
      return updated;
    });

    setMcqSavedAnswers((previous) => {
      const updated = { ...previous };
      delete updated[currentQuestionKey];
      return updated;
    });
    setSubmissionError(null);
  };

  const goToNextQuestion = () => {
    setActiveQuestionIndex((current) => Math.min(current + 1, sessionProblems.length - 1));
  };

  const submitFromLastQuestion = () => {
    const saved = saveCurrentMcqAnswer();
    if (!saved) return;
    handleSubmit();
  };

  // 4. Submission Logic
  const { mutate: submit, mutateAsync: submitAsync, isPending: isSubmitting } = useSubmitSession();
  const { mutate: run, isPending: isRunning } = useRunCode();

  const handleRun = () => {
    if (!sessionId) return;
    if (isAgileMcq) {
      setSubmissionError("Run Code is not applicable for Agile MCQ assessments.");
      return;
    }
    if (isWebSandboxQuestion) {
      setSubmissionError(null);
      setSandboxRunMessage("Executing in CodeSandbox...");
      setSandboxRunUrl(null);
      setSandboxRunSignal((previous) => previous + 1);
    }
    if (!language) {
      setSubmissionError("No language selected. Please pick a language before running.");
      return;
    }

    setSubmissionError(null);
    run(
      {
        sessionId,
        code,
        language: resolveSubmitLanguage(),
        problemId: displayedProblem?.problem_id,
      },
      {
        onSuccess: (data) => {
          setRunResult(data);
        },
        onError: (error: unknown) => {
          setSubmissionError(resolveApiErrorMessage(error, "Run failed. Please try again."));
        },
      }
    );
  };

  const handleSubmit = () => {
    if (!sessionId) return;

    if (isAgileMcq) {
      const confirmed = window.confirm("Do you want to submit your solutions?");
      if (!confirmed) {
        return;
      }
    }

    const payload = buildSubmitPayload();
    if (!payload) return;

    setSubmissionError(null);
    submit(
      { session_id: sessionId, payload },
      {
        onSuccess: (data) => {
          sessionStorage.removeItem(SESSION_ID_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_LANGUAGES_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_SKILL_NAME_STORAGE_KEY);

          if (isAgileMcq) {
            const analysisItems: AgileAnalysisItem[] = sessionProblems.map((problem, index) => {
              const key = getProblemKey(problem, index);
              const selectedAnswer = mcqSavedAnswers[key] ?? "-";
              const caseResult = data.cases?.[index];
              const correctAnswer = caseResult?.expected_output || "-";
              const isCorrect = Boolean(caseResult?.passed);

              return {
                questionLabel: `Q${index + 1}`,
                selectedAnswer,
                correctAnswer,
                isCorrect,
              };
            });

            navigate("/candidate/agile-analysis", {
              state: {
                items: analysisItems,
                score: data.score,
                status: data.status,
              },
            });
            return;
          }

          setSubmissionResult(data);
        },
        onError: (error: unknown) => {
          setSubmissionError(resolveApiErrorMessage(error, "Submission failed. Please try again."));
        },
      }
    );
  };

  const handleEndTest = async () => {
    if (!sessionId) return;

    const payload = buildSubmitPayload();
    if (!payload) return;

    setSubmissionError(null);
    try {
      await submitAsync({ session_id: sessionId, payload });
      navigate("/candidate/thankyou");
    } catch (error: any) {
      console.log("End test submission error:", error);
      const status = error?.response?.status;
      if (status === 409) {
        navigate("/candidate/thankyou");
      } else {
        setSubmissionError(resolveApiErrorMessage(error, "Failed to end test. Please try again."));
      }
    }
  };

  const handleTimeExpired = () => {
    if (!sessionId) return;

    const payload = buildSubmitPayload();
    if (!payload) return;

    setSubmissionError(null);
    submit(
      { session_id: sessionId, payload },
      {
        onSuccess: () => {
          navigate("/candidate/thankyou");
        },
        onError: (error: any) => {
          const status = error?.response?.status;
          if (status === 409) {
            navigate("/candidate/thankyou");
          } else {
            setSubmissionError(resolveApiErrorMessage(error, "Failed to end test. Please try again."));
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
        hideRunCode={isAgileMcq}
        hideLanguageSelect={isAgileMcq}
        submitButtonLabel={isAgileMcq ? "Submit Test" : "Submit Solution"}
      />

      {submissionError && (
        <div className='border-b border-rose-200 bg-rose-50 px-6 py-2.5 text-sm text-rose-700'>
          {submissionError}
        </div>
      )}

      {sandboxRunMessage && (
        <div className='border-b border-emerald-200 bg-emerald-50 px-6 py-2.5 text-sm text-emerald-800'>
          <span>{sandboxRunMessage}</span>
          {sandboxRunUrl && (
            <a
              href={sandboxRunUrl}
              target='_blank'
              rel='noreferrer'
              className='ml-3 font-semibold text-emerald-900 underline'
            >
              Open Sandbox
            </a>
          )}
        </div>
      )}

      <div className='flex flex-1 overflow-hidden'>
        {isAgileMcq ? (
          <>
            {sessionProblems.length > 1 && (
              <div className='w-[92px] shrink-0 border-r border-admin-border bg-slate-50 p-3'>
                <div className='mb-3 px-1 text-xs font-semibold uppercase tracking-[0.4px] text-slate-500'>
                  Questions
                </div>
                <div className='max-h-full space-y-2 overflow-y-auto pr-1'>
                  {sessionProblems.map((problem, index) => {
                    const isActive = index === activeQuestionIndex;
                    const questionKey = getProblemKey(problem, index);
                    const isSaved = Boolean(mcqSavedAnswers[questionKey]);
                    return (
                      <button
                        key={`${problem.problem_id ?? "problem"}-${index}`}
                        onClick={() => setActiveQuestionIndex(index)}
                        className={`w-full rounded-lg border px-3 py-2.5 text-center text-sm transition-all ${
                          isActive
                            ? "border-admin-orange bg-admin-orange/10 text-admin-orange"
                            : isSaved
                              ? "border-orange-300 bg-orange-50 text-admin-orange"
                              : "border-slate-200 bg-white text-slate-700 hover:border-orange-300"
                        }`}
                      >
                        <span className={`${isSaved ? "font-extrabold" : "font-semibold"}`}>{`Q${index + 1}`}</span>
                      </button>
                    );
                  })}
                </div>
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
              <CodePlayground code={code} onChange={handleCodeChange} onPaste={() => sendViolation("paste")} />
            ) : (
              <Editor
                code={code}
                onChange={handleCodeChange}
                language={activeLanguage?.monaco || "plaintext"}
                onPaste={() => sendViolation("paste")}
              />
            )}

            <div className='flex flex-1 flex-col bg-[#1e1e1e]'>
              <div className='flex-1 overflow-hidden'>
                <AgileMcqPanel
                  problem={displayedProblem}
                  selectedOption={mcqAnswers[currentQuestionKey] ?? null}
                  savedOption={mcqSavedAnswers[currentQuestionKey] ?? null}
                  onSelect={(option) => {
                    if (!currentQuestionKey) return;
                    setMcqAnswers((previous) => ({
                      ...previous,
                      [currentQuestionKey]: option,
                    }));
                  }}
                  onSaveAnswer={saveCurrentMcqAnswer}
                  onClearResponse={clearCurrentMcqAnswer}
                  onNextQuestion={goToNextQuestion}
                  onSubmitTest={submitFromLastQuestion}
                  isLastQuestion={activeQuestionIndex >= sessionProblems.length - 1}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className='flex w-full min-h-0 gap-4 p-4'>
              <div className='flex w-2/5 min-w-0 overflow-hidden rounded-2xl border border-admin-border bg-white shadow-sm'>
                {sessionProblems.length > 1 && (
                  <div className='w-[220px] shrink-0 border-r border-admin-border bg-slate-50 p-3'>
                    <div className='mb-3 px-1 text-xs font-semibold uppercase tracking-[0.4px] text-slate-500'>
                      Questions
                    </div>
                    <div className='max-h-full space-y-2 overflow-y-auto pr-1'>
                      {sessionProblems.map((problem, index) => {
                        const isActive = index === activeQuestionIndex;
                        return (
                          <button
                            key={`${problem.problem_id ?? "problem"}-${index}`}
                            onClick={() => setActiveQuestionIndex(index)}
                            className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                              isActive
                                ? "border-admin-orange bg-admin-orange/10 text-slate-900"
                                : "border-slate-200 bg-white text-slate-700 hover:border-orange-300"
                            }`}
                          >
                            <div className={`text-[11px] font-bold uppercase tracking-[0.4px] ${isActive ? "text-admin-orange" : "text-slate-500"}`}>
                              {`Question ${index + 1}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className='min-h-0 min-w-0 flex-1 overflow-y-auto'>
                  <ProblemPanel problem={displayedProblem} hideSampleTestCases={false} />
                </div>
              </div>

              <div className='flex w-3/5 min-w-0 flex-col overflow-hidden rounded-2xl border border-admin-border bg-[#1e1e1e] shadow-sm'>
                <div className='flex-1 overflow-hidden'>
                  {isWebSandboxQuestion ? (
                    <CodePlayground
                      key={currentQuestionKey}
                      code={code}
                      onChange={handleCodeChange}
                      runSignal={sandboxRunSignal}
                      onRunResult={(result) => {
                        if (result.ok) {
                          setSubmissionError(null);
                          setSandboxRunMessage(result.message);
                          setSandboxRunUrl(result.sandboxUrl ?? null);
                          return;
                        }

                        setSandboxRunMessage(null);
                        setSandboxRunUrl(null);
                        setSubmissionError(result.message);
                      }}
                    />
                  ) : (
                    <Editor code={code} onChange={handleCodeChange} language={activeLanguage?.monaco || "plaintext"} />
                  )}
                </div>

                {(submissionResult || runResult) && (
                  <div className='h-2/5 overflow-y-auto border-t border-admin-border bg-white'>
                    <TestCases submissionResult={submissionResult} runResult={runResult} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
