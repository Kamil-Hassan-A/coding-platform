import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetSession, useSubmitSession } from "./hooks/useAssessment";
import { useEditor } from "./hooks/useEditor";
import Toolbar from "./components/Toolbar";
import ProblemPanel from "./components/ProblemPanel";
import Editor from "./components/Editor";
import TestCases from "./components/TestCases";
import type { SessionSubmitResponse, SessionProblemPayload } from "./types/assessment";

export default function AssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 1. Session ID Recovery
  const initialState = location.state as { session_id: string; problem: SessionProblemPayload } | null;
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

  // 3. Editor & Language State
  const { code, setCode } = useEditor(
    initialState?.problem?.templateCode ?? draftCode ?? "",
  );
  const [language, setLanguage] = useState(recoveredSession?.last_draft_lang ?? "python");
  const [submissionResult, setSubmissionResult] = useState<SessionSubmitResponse | null>(null);

  // 4. Submission Logic
  const { mutate: submit, isPending: isSubmitting } = useSubmitSession();

  const handleSubmit = () => {
    if (!sessionId) return;
    submit(
      { session_id: sessionId, payload: { code, language } },
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
      setLanguage(recoveredSession.last_draft_lang);
    }
  }, [recoveredSession?.last_draft_lang]);

  if (isSessionResolved && !sessionId && !isRecovering) {
    return (
      <div style={{ 
        height: "100vh", display: "flex", flexDirection: "column", 
        alignItems: "center", justifyContent: "center", background: "#f5f6fa",
        fontFamily: "'Segoe UI', sans-serif" 
      }}>
        <h2 style={{ color: "#333", marginBottom: "20px" }}>No active session found.</h2>
        <button 
          onClick={() => navigate("/candidate/dashboard")}
          style={{
            background: "#E8620A", color: "#fff", border: "none",
            borderRadius: "8px", padding: "12px 32px", fontWeight: 700, cursor: "pointer"
          }}
        >
          Go back to Dashboard
        </button>
      </div>
    );
  }

  if (isRecovering || !activeProblem) {
    return (
      <div style={{ 
        height: "100vh", display: "flex", alignItems: "center", 
        justifyContent: "center", background: "#f5f6fa" 
      }}>
        <div style={{ color: "#E8620A", fontWeight: 600 }}>Loading Assessment...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      height: "100vh", display: "flex", flexDirection: "column", 
      background: "#f5f6fa", overflow: "hidden", fontFamily: "'Segoe UI', sans-serif" 
    }}>
      <Toolbar 
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        language={language}
        onLanguageChange={setLanguage}
        timeLimit={activeProblem.time_limit_minutes}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Panel - 40% */}
        <div style={{ width: "40%", borderRight: "1px solid #e0e0e0", display: "flex", flexDirection: "column" }}>
          <ProblemPanel problem={activeProblem} />
        </div>

        {/* Right Panel - 60% */}
        <div style={{ width: "60%", display: "flex", flexDirection: "column", background: "#1e1e1e" }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Editor code={code} onChange={setCode} language={language} />
          </div>
          
          {submissionResult && (
            <div style={{ height: "40%", borderTop: "2px solid #E8620A", background: "#fff", overflowY: "auto" }}>
              <TestCases result={submissionResult} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
