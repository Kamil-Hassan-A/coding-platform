import type { AllowedLanguage } from "../../candidate/types/candidate";

export interface Problem {
  id: string;
  title: string;
  description: string;
  templateCode: string;
}

export interface AssessmentState {
  code: string;
  problem: Problem | null;
}

export interface SampleTestCase {
  stdin: string;
  expected_output: string;
}

export interface TestCaseResult {
  stdin: string;
  expected_output: string | null;
  stdout: string | null;
  stderr: string | null;
  message: string | null;
  status: { description?: string } & Record<string, unknown>;
  passed: boolean;
}

export interface SessionProblemPayload {
  title: string;
  description: string;
  templateCode?: string;
  sample_test_cases: SampleTestCase[];
  time_limit_minutes: number;
}

export interface SessionStartResponse {
  session_id: string;
  problem: SessionProblemPayload;
}

export interface StartSessionPayload {
  skill_id: string;
  level: string;
}

export interface SubmitSessionPayload {
  code: string;
  language: string;
}

export interface SessionSubmitResponse {
  submission_id: string;
  session_id: string;
  status: string;
  score: number;
  passed_tests: number;
  total_tests: number;
  time_taken_seconds: number;
  cases: TestCaseResult[];
}

export interface SubmissionResultsResponse {
  submission_id: string;
  status: string;
  score: number;
  passed_tests: number;
  total_tests: number;
  time_taken_seconds: number;
  attempts_used: number;
  attempts_remaining: number;
  next_level_unlocked: boolean;
  cases: TestCaseResult[];
}

export interface ActiveSession {
  session_id: string;
  problem: SessionProblemPayload;
  last_draft_code?: string;
  last_draft_lang?: string;
  allowed_languages?: AllowedLanguage[];
}
