import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetSession, useRunCode, useSubmitSession } from "./hooks/useAssessment";
import { useEditor } from "./hooks/useEditor";
import Toolbar from "./components/Toolbar";
import ProblemPanel from "./components/ProblemPanel";
import Editor from "./components/Editor";
import CodePlayground from "./components/CodePlayground";
import TestCases from "./components/TestCases";
import { reportViolation } from "./services/assessmentService";
import type {
  SessionSubmitResponse,
  SessionRunResponse,
  SessionProblemPayload,
  LanguageOption,
} from "./types/assessment";

const SESSION_ID_STORAGE_KEY = "assessment_session_id";
const SESSION_LANGUAGES_STORAGE_KEY = "assessment_allowed_languages";
const SESSION_SKILL_NAME_STORAGE_KEY = "assessment_skill_name";
const VIOLATION_WINDOW_MS = 20000;
const VIOLATION_SPAM_DEBOUNCE_MS = 300;
const AUTO_SUBMIT_VIOLATIONS_REASON = "AUTO_SUBMIT_VIOLATIONS_THRESHOLD";

type InitialAssessmentState = {
  session_id: string;
  problem: SessionProblemPayload;
  skill_name?: string;
  allowed_languages?: LanguageOption[];
};

type ViolationToast = {
  id: number;
  message: string;
  tone: "mild" | "strong" | "final";
};

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
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
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));
  const [isFullscreenLost, setIsFullscreenLost] = useState(false);
  const [fullscreenViolations, setFullscreenViolations] = useState(0);
  const [hasStartedAssessment, setHasStartedAssessment] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [violationTimestamps, setViolationTimestamps] = useState<number[]>([]);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const initialProblem = initialState?.problem ?? null;
  const lastSentRef = useRef<Record<string, number>>({});
  const violationCountRef = useRef(0);
  const toastIdRef = useRef(0);
  const [violationCount, setViolationCount] = useState(0);
  const [violationByType, setViolationByType] = useState<Record<string, number>>({});
  const [violationToasts, setViolationToasts] = useState<ViolationToast[]>([]);
  const lastFullscreenExitRef = useRef(0);
  const lastShortcutRef = useRef<Record<string, number>>({});
  const lastDevtoolsRef = useRef(0);
  const lastRightClickRef = useRef(0);
  const hasAutoSubmittedRef = useRef(false);
  const hasViolationAutoSubmittedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const lastViolationEventRef = useRef(0);
  const latestCodeRef = useRef("");
  const hasSubmittedRef = useRef(false);
  const warnedThresholdRef = useRef(false);
  const isIntentionalExitRef = useRef(false);
  const intentionalExitResetTimerRef = useRef<number | null>(null);

  const markIntentionalFullscreenExit = useCallback(() => {
    isIntentionalExitRef.current = true;
    if (intentionalExitResetTimerRef.current !== null) {
      window.clearTimeout(intentionalExitResetTimerRef.current);
    }
    intentionalExitResetTimerRef.current = window.setTimeout(() => {
      isIntentionalExitRef.current = false;
      intentionalExitResetTimerRef.current = null;
    }, 1000);
  }, []);

  const pushViolationToast = useCallback((message: string, tone: ViolationToast["tone"] = "mild") => {
    const id = ++toastIdRef.current;
    setViolationToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setViolationToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  const requestFullscreenSafe = useCallback(async (): Promise<boolean> => {
    const target = document.documentElement as FullscreenTarget;
    const fullscreenEnabled = Boolean(
      document.fullscreenEnabled ||
      (document as Document & { webkitFullscreenEnabled?: boolean; msFullscreenEnabled?: boolean }).webkitFullscreenEnabled ||
      (document as Document & { webkitFullscreenEnabled?: boolean; msFullscreenEnabled?: boolean }).msFullscreenEnabled,
    );

    console.debug("[AssessmentPage] Fullscreen support", {
      fullscreenEnabled,
      hasStandard: typeof target.requestFullscreen === "function",
      hasWebkit: typeof target.webkitRequestFullscreen === "function",
      hasMs: typeof target.msRequestFullscreen === "function",
    });

    const request =
      target.requestFullscreen ||
      target.webkitRequestFullscreen ||
      target.msRequestFullscreen;

    if (!request) {
      console.error("[AssessmentPage] Fullscreen API not supported in this browser");
      return false;
    }

    try {
      const result = request.call(target);
      if (result && typeof (result as Promise<void>).then === "function") {
        await result;
      }
      return true;
    } catch (error) {
      console.error("[AssessmentPage] requestFullscreen failed", error);
      return false;
    }
  }, []);

  const exitFullscreenSafe = useCallback(async (): Promise<boolean> => {
    if (!document.fullscreenElement) {
      return true;
    }

    const exit =
      document.exitFullscreen ||
      (document as Document & { webkitExitFullscreen?: () => Promise<void> | void; msExitFullscreen?: () => Promise<void> | void }).webkitExitFullscreen ||
      (document as Document & { webkitExitFullscreen?: () => Promise<void> | void; msExitFullscreen?: () => Promise<void> | void }).msExitFullscreen;

    if (!exit) {
      console.warn("[AssessmentPage] Exit fullscreen API not supported");
      return false;
    }

    try {
      const result = exit.call(document);
      if (result && typeof (result as Promise<void>).then === "function") {
        await result;
      }
      return true;
    } catch (error) {
      console.error("[AssessmentPage] exitFullscreen failed", error);
      return false;
    }
  }, []);

  const handleReenterFullscreen = useCallback(async () => {
    const success = await requestFullscreenSafe();
    if (success) {
      setIsFullscreenLost(false);
    }
  }, [requestFullscreenSafe]);

  const sendViolation = useCallback((type: string) => {
    if (!sessionId || hasSubmittedRef.current) return;

    const now = Date.now();
    if (now - lastViolationEventRef.current < VIOLATION_SPAM_DEBOUNCE_MS) {
      return;
    }
    lastViolationEventRef.current = now;

    const last = lastSentRef.current[type] ?? 0;
    if (now - last < 1000) {
      return;
    }
    lastSentRef.current[type] = now;

    setViolationByType((prev) => ({
      ...prev,
      [type]: (prev[type] ?? 0) + 1,
    }));

    setViolationTimestamps((prev) => {
      const recent = prev.filter((timestamp) => now - timestamp <= VIOLATION_WINDOW_MS);
      return [...recent, now];
    });

    const nextCount = violationCountRef.current + 1;
    violationCountRef.current = nextCount;
    setViolationCount(nextCount);

    pushViolationToast(`Suspicious activity detected: ${type}`);

    if (nextCount === 1) {
      pushViolationToast("Please avoid switching tabs during assessment", "mild");
    } else if (nextCount === 3) {
      pushViolationToast("Repeated violations may be flagged", "strong");
    } else if (nextCount === 5) {
      pushViolationToast("Your session may be marked suspicious", "final");
    }

    void reportViolation(sessionId, {
      type,
      timestamp: new Date().toISOString(),
    });
  }, [pushViolationToast, sessionId]);

  const handleStartAssessment = useCallback(async () => {
    if (hasStartedAssessment) {
      return;
    }

    console.debug("[AssessmentPage] Start Assessment clicked");

    const entered = await requestFullscreenSafe();
    if (!entered) {
      pushViolationToast("Please allow fullscreen to start the assessment", "strong");
      return;
    }
    setHasStartedAssessment(true);
    setSubmissionError(null);
  }, [hasStartedAssessment, pushViolationToast, requestFullscreenSafe]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const currentlyFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(currentlyFullscreen);

      if (currentlyFullscreen) {
        setIsFullscreenLost(false);
        return;
      }

      if (!hasStartedAssessment || isSessionExpired || hasSubmittedRef.current) {
        return;
      }

      if (isIntentionalExitRef.current) {
        return;
      }

      setIsFullscreenLost(true);

      const now = Date.now();
      if (now - lastFullscreenExitRef.current > 1000) {
        sendViolation("fullscreen_exit");
        lastFullscreenExitRef.current = now;
      }
      pushViolationToast("Fullscreen mode is required", "strong");

      setFullscreenViolations((prev) => {
        const next = prev + 1;
        if (next === 1) {
          pushViolationToast("Please stay in fullscreen mode during the assessment", "mild");
        } else if (next === 3) {
          pushViolationToast("Repeated fullscreen exits may be flagged", "strong");
        } else if (next === 5) {
          pushViolationToast("Your session may be marked suspicious", "final");
        }
        return next;
      });
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [hasStartedAssessment, isSessionExpired, pushViolationToast, sendViolation]);

  useEffect(() => {
    return () => {
      if (intentionalExitResetTimerRef.current !== null) {
        window.clearTimeout(intentionalExitResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendViolation("tab_switch");
      }
    };

    const handleWindowBlur = () => {
      sendViolation("window_blur");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [sendViolation, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const logDevtoolsOpen = () => {
      const now = Date.now();
      if (now - lastDevtoolsRef.current <= 3000) {
        return;
      }
      lastDevtoolsRef.current = now;
      sendViolation("devtools_open");
    };

    const sizeIntervalId = window.setInterval(() => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > 160 || heightDiff > 160) {
        logDevtoolsOpen();
      }
    }, 2000);

    let timingIntervalId: number | null = null;
    if (import.meta.env.DEV) {
      timingIntervalId = window.setInterval(() => {
        const start = Date.now();
        debugger;
        const end = Date.now();
        if (end - start > 100) {
          logDevtoolsOpen();
        }
      }, 3000);
    }

    return () => {
      window.clearInterval(sizeIntervalId);
      if (timingIntervalId !== null) {
        window.clearInterval(timingIntervalId);
      }
    };
  }, [sendViolation, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();

      const now = Date.now();
      if (now - lastRightClickRef.current <= 1000) {
        return;
      }

      lastRightClickRef.current = now;
      sendViolation("right_click");
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [sendViolation, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") {
        return;
      }

      let type: string | null = null;
      const key = (event.key || "").toLowerCase();
      const isCtrl = event.ctrlKey || event.metaKey;

      if (isCtrl && !event.shiftKey && key === "c") {
        type = "copy";
      } else if (isCtrl && !event.shiftKey && key === "x") {
        type = "cut";
      } else if (isCtrl && !event.shiftKey && key === "a") {
        type = "select_all";
      } else if (isCtrl && event.shiftKey && key === "i") {
        type = "devtools_shortcut";
      } else if (key === "f12") {
        type = "devtools_shortcut";
      } else if (isCtrl && key === "tab") {
        type = "tab_switch_shortcut";
      }

      if (!type) return;

      const now = Date.now();
      const last = lastShortcutRef.current[type] ?? 0;
      if (now - last <= 1000) {
        return;
      }

      lastShortcutRef.current[type] = now;
      if (import.meta.env.DEV) {
        console.log("Shortcut detected:", type);
      }
      sendViolation(type);
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [sendViolation, sessionId]);

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

  const resolvedAllowedLanguages = allowedLanguages;

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
  const [language, setLanguage] = useState(initialState?.allowed_languages?.[0]?.monaco ?? "");

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

  useEffect(() => {
    latestCodeRef.current = code;
  }, [code]);

  useEffect(() => {
    if (!sessionId || isSessionExpired || hasViolationAutoSubmittedRef.current || hasSubmittedRef.current) {
      return;
    }
    if (isSubmitting || submitInFlightRef.current) {
      return;
    }

    const now = Date.now();
    const recent = violationTimestamps.filter((timestamp) => now - timestamp <= VIOLATION_WINDOW_MS);
    if (recent.length !== violationTimestamps.length) {
      setViolationTimestamps(recent);
      return;
    }

    if (recent.length < 2) {
      warnedThresholdRef.current = false;
    } else if (recent.length === 2 && !warnedThresholdRef.current) {
      warnedThresholdRef.current = true;
      pushViolationToast("Next violation will auto-submit your test", "strong");
    }

    if (recent.length < 3) {
      return;
    }

    if (!language) {
      setSubmissionError("No language selected. Auto-submit could not start.");
      return;
    }

    hasViolationAutoSubmittedRef.current = true;
    submitInFlightRef.current = true;
    setIsLocked(true);
    console.log("Violation burst detected:", recent);
    console.info("[AssessmentPage] Auto-submit reason:", AUTO_SUBMIT_VIOLATIONS_REASON);
    setSubmissionError("Assessment auto-submitted due to repeated violations.");
    const autoSubmitPayload = {
      code: latestCodeRef.current,
      language,
      metadata: {
        trigger: AUTO_SUBMIT_VIOLATIONS_REASON,
      },
    };
    submit(
      { session_id: sessionId, payload: autoSubmitPayload },
      {
        onSuccess: async () => {
          submitInFlightRef.current = false;
          hasSubmittedRef.current = true;
          markIntentionalFullscreenExit();
          await exitFullscreenSafe();
          navigate("/candidate/thankyou");
        },
        onError: (error: any) => {
          submitInFlightRef.current = false;
          setIsLocked(false);
          const status = error?.response?.status;
          if (status === 409 || status === 410) {
            handleSessionExpired(true);
            return;
          }
          hasViolationAutoSubmittedRef.current = false;
          setSubmissionError("Auto-submit failed. Please submit now.");
        },
      },
    );
  }, [
    isSessionExpired,
    isSubmitting,
    language,
    markIntentionalFullscreenExit,
    navigate,
    sessionId,
    submit,
    violationTimestamps,
  ]);

  const handleSessionExpired = (redirectToThankYou = false) => {
    setIsSessionExpired(true);
    hasSubmittedRef.current = true;
    setSubmissionError("Your session has expired");
    if (redirectToThankYou) {
      navigate("/candidate/thankyou");
    }
  };

  const handleRun = () => {
    if (!sessionId || isSessionExpired || hasSubmittedRef.current || isLocked) return;
    if (submitInFlightRef.current || isSubmitting) return;
    if (!hasStartedAssessment || !isFullscreen) {
      setSubmissionError("Please return to fullscreen mode to continue the assessment.");
      return;
    }
    if (!language) {
      setSubmissionError("No language selected. Please pick a language before running.");
      return;
    }

    setSubmissionError(null);
    run(
      { sessionId, code: latestCodeRef.current, language },
      {
        onSuccess: (data) => {
          setRunResult(data);
        },
        onError: (error: any) => {
          const status = error?.response?.status;
          if (status === 409 || status === 410) {
            handleSessionExpired();
            return;
          }
          setSubmissionError("Run failed. Please try again.");
        },
      }
    );
  };

  const handleSubmit = () => {
    if (!sessionId || isSessionExpired || hasSubmittedRef.current || isLocked) return;
    if (submitInFlightRef.current || isSubmitting) return;
    if (!hasStartedAssessment || !isFullscreen) {
      setSubmissionError("Please return to fullscreen mode to continue the assessment.");
      return;
    }

    if (!language) {
      setSubmissionError("No language selected. Please pick a language before submitting.");
      return;
    }

    setSubmissionError(null);
    submitInFlightRef.current = true;
    submit(
      { session_id: sessionId, payload: { code: latestCodeRef.current, language } },
      {
        onSuccess: (data) => {
          submitInFlightRef.current = false;
          hasSubmittedRef.current = true;
          markIntentionalFullscreenExit();
          void exitFullscreenSafe();
          setSubmissionResult(data);
          sessionStorage.removeItem(SESSION_ID_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_LANGUAGES_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_SKILL_NAME_STORAGE_KEY);
        },
        onError: (error: any) => {
          submitInFlightRef.current = false;
          const status = error?.response?.status;
          if (status === 409 || status === 410) {
            handleSessionExpired();
            return;
          }
          setSubmissionError("Submission failed. Please try again.");
        },
      }
    );
  };

  const handleEndTest = async () => {
    if (!sessionId || isSessionExpired || hasSubmittedRef.current || isLocked) return;
    if (submitInFlightRef.current || isSubmitting) return;
    if (!hasStartedAssessment || !isFullscreen) {
      setSubmissionError("Please return to fullscreen mode to continue the assessment.");
      return;
    }

    if (!language) {
      setSubmissionError("No language selected. Please pick a language before ending the test.");
      return;
    }

    setSubmissionError(null);
    submitInFlightRef.current = true;
    try {
      await submitAsync({ session_id: sessionId, payload: { code: latestCodeRef.current, language } });
      submitInFlightRef.current = false;
      hasSubmittedRef.current = true;
      markIntentionalFullscreenExit();
      await exitFullscreenSafe();
      navigate("/candidate/thankyou");
    } catch (error: any) {
      submitInFlightRef.current = false;
      console.log("End test submission error:", error);
      const status = error?.response?.status;
      if (status === 409 || status === 410) {
        handleSessionExpired(true);
      } else {
        setSubmissionError("Failed to end test. Please try again.");
      }
    }
  };

  const handleTimeExpired = () => {
    if (!sessionId || isSessionExpired || hasSubmittedRef.current) return;
    if (submitInFlightRef.current || isSubmitting) return;
    if (hasAutoSubmittedRef.current) return;
    hasAutoSubmittedRef.current = true;

    if (!language) {
      hasAutoSubmittedRef.current = false;
      setSubmissionError("No language selected. Please pick a language before submitting.");
      return;
    }

    setSubmissionError(null);
    submitInFlightRef.current = true;
    submit(
      { session_id: sessionId, payload: { code: latestCodeRef.current, language } },
      {
        onSuccess: async () => {
          markIntentionalFullscreenExit();
          await exitFullscreenSafe();
          submitInFlightRef.current = false;
          hasSubmittedRef.current = true;
          navigate("/candidate/thankyou");
        },
        onError: (error: any) => {
          submitInFlightRef.current = false;
          const status = error?.response?.status;
          if (status === 409 || status === 410) {
            handleSessionExpired(true);
          } else {
            hasAutoSubmittedRef.current = false;
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
          onClick={async () => {
            markIntentionalFullscreenExit();
            await exitFullscreenSafe();
            navigate("/candidate/dashboard");
          }}
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
        onEndTestIntent={markIntentionalFullscreenExit}
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

      {!hasStartedAssessment && (
        <div className='absolute inset-0 z-[1100] flex items-center justify-center bg-black/55 px-4'>
          <div className='w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl'>
            <h2 className='text-xl font-bold text-slate-900'>Start Assessment</h2>
            <p className='mt-2 text-sm text-slate-600'>
              Fullscreen mode is required to begin and continue this assessment.
            </p>
            <button
              onClick={() => void handleStartAssessment()}
              className='mt-5 rounded-lg bg-admin-orange px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90'
            >
              Start Assessment
            </button>
          </div>
        </div>
      )}

      {isLocked && (
        <div className='absolute inset-0 z-[1300] flex items-center justify-center bg-black/70 px-4'>
          <div className='w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center shadow-xl'>
            <h2 className='text-xl font-bold text-rose-700'>Submitting Assessment</h2>
            <p className='mt-2 text-sm text-slate-700'>
              Repeated violations detected. Your assessment is being auto-submitted.
            </p>
            <p className='mt-1 text-xs text-slate-500'>Please wait...</p>
          </div>
        </div>
      )}

      {isFullscreenLost && !hasSubmittedRef.current && (
        <div className='absolute inset-0 z-[1400] flex items-center justify-center bg-black/75 px-4'>
          <div className='w-full max-w-md rounded-xl border border-amber-300 bg-white p-6 text-center shadow-2xl'>
            <h2 className='text-xl font-bold text-amber-700'>Fullscreen Required</h2>
            <p className='mt-3 text-sm text-slate-700'>
              You must return to fullscreen to continue.
            </p>
            <button
              onClick={() => void handleReenterFullscreen()}
              className='mt-4 rounded-lg bg-admin-orange px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90'
            >
              Re-enter Fullscreen
            </button>
          </div>
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
              <CodePlayground code={code} onChange={setCode} onPaste={() => sendViolation("paste")} />
            ) : (
              <Editor
                code={code}
                onChange={setCode}
                language={activeLanguage?.monaco || "plaintext"}
                onPaste={() => sendViolation("paste")}
              />
            )}
          </div>
          
          {(submissionResult || runResult) && skillName !== "HTML, CSS, JS" && (
            <div className='h-2/5 overflow-y-auto border-t-2 border-admin-orange bg-white'>
              <TestCases submissionResult={submissionResult} runResult={runResult} />
            </div>
          )}
        </div>
      </div>

      {violationToasts.length > 0 && (
        <div className='pointer-events-none fixed right-4 top-4 z-[1200] flex w-[320px] flex-col gap-2'>
          {violationToasts.map((toast) => {
            const toneClass =
              toast.tone === "final"
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : toast.tone === "strong"
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-orange-300 bg-orange-50 text-orange-900";

            return (
              <div
                key={toast.id}
                className={`rounded-lg border px-3 py-2 text-sm shadow-md ${toneClass}`}
              >
                {toast.message}
              </div>
            );
          })}
        </div>
      )}

      <div className='sr-only' aria-live='polite'>
        Violations detected: {violationCount}. Fullscreen exits: {fullscreenViolations}. {Object.keys(violationByType).length > 0 ? "Types tracked." : ""}
      </div>
    </div>
  );
}
