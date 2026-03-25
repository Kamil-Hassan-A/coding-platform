import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetSession, useSubmitSession } from "./hooks/useAssessment";
import { useEditor } from "./hooks/useEditor";
import Toolbar from "./components/Toolbar";
import ProblemPanel from "./components/ProblemPanel";
import Editor from "./components/Editor";
import TestCases from "./components/TestCases";
import type { SessionSubmitResponse, SessionProblemPayload } from "./types/assessment";

// DEV_MODE
const DEV_MODE = true;

const MOCK_PROBLEM: SessionProblemPayload = {
  title: "Mock Assessment: Sum of Two Numbers",
  description: "Write a function that takes two numbers as input and returns their sum.\n\n### Example\nInput: 2 3\nOutput: 5",
  templateCode: "def solve(a, b):\n    # TODO: Implement sum logic\n    return a + b\n\n# Standard boilerplate\nimport sys\nif __name__ == '__main__':\n    line = sys.stdin.readline()\n    if line:\n        a, b = map(int, line.split())\n        print(solve(a, b))",
  sample_test_cases: [
    { stdin: "2 3", expected_output: "5" },
    { stdin: "10 20", expected_output: "30" }
  ],
  time_limit_minutes: 60
};

export default function AssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 1. Session ID Recovery
  const initialState = location.state as { session_id: string; problem: SessionProblemPayload } | null;
  const [sessionId, setSessionId] = useState<string | null>(initialState?.session_id || null);
  const [initialProblem, setInitialProblem] = useState<SessionProblemPayload | null>(initialState?.problem || null);
  const [isSessionResolved, setIsSessionResolved] = useState(false);

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
    !DEV_MODE && !initialState ? sessionId : null
  );

  const activeProblem = DEV_MODE ? MOCK_PROBLEM : (initialProblem || recoveredSession?.problem);
  const draftCode = recoveredSession?.draft_code;

  // 3. Editor & Language State
  const { code, setCode } = useEditor(
    DEV_MODE 
      ? MOCK_PROBLEM.templateCode 
      : (initialState?.problem?.templateCode ?? recoveredSession?.draft_code ?? "")
  );
  const [language, setLanguage] = useState("python");
  const [submissionResult, setSubmissionResult] = useState<SessionSubmitResponse | null>(null);

  // 4. Submission Logic
  const { mutate: submit, isPending: isSubmitting } = useSubmitSession();

  const handleSubmit = () => {
    if (DEV_MODE) {
      alert("DEV_MODE: Submission mocked successfully!");
      setSubmissionResult({
        submission_id: "mock-sub-123",
        session_id: sessionId || "mock-sess-123",
        status: "cleared",
        score: 100,
        passed_tests: 2,
        total_tests: 2,
        time_taken_seconds: 45,
        cases: [
          {
            stdin: "2 3", expected_output: "5", stdout: "5", stderr: null,
            message: "Correct", status: { id: 3, description: "Accepted" }, passed: true
          },
          {
            stdin: "10 20", expected_output: "30", stdout: "30", stderr: null,
            message: "Correct", status: { id: 3, description: "Accepted" }, passed: true
          }
        ]
      });
      return;
    }

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

  if (!DEV_MODE && isSessionResolved && !sessionId && !isRecovering) {
    return (
      <div style={{ 
        height: "100vh", display: "flex", flexDirection: "column", 
        alignItems: "center", justifyContent: "center", background: "#f5f6fa",
        fontFamily: "'Segoe UI', sans-serif" 
      }}>
        <h2 style={{ color: "#333", marginBottom: "20px" }}>No active session found.</h2>
        <button 
          onClick={() => navigate("/dashboard")}
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
