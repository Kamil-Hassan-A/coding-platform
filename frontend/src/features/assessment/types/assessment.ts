export interface Problem {
  id: string;
  title: string;
  description: string;
  templateCode: string;
}

export interface LanguageOption {
  id: number;
  name: string;
  monaco: string;
}

export interface AssessmentState {
  code: string;
  problem: Problem | null;
}

export interface SampleTestCase {
  input: string;
  output: string;
}

export interface TestCaseResult {
  stdin: string;
  expected_output: string | null;
  stdout: string | null;
  stderr: string | null;
  compile_output?: string | null;
  message: string | null;
  status: { description?: string } & Record<string, unknown>;
  passed: boolean;
}

export interface SqlTableColumn {
  name: string;
  type: string;
}

export interface SqlTableSchema {
  table: string;
  columns: SqlTableColumn[];
}

export interface StarterCodeFile {
  path: string;
  content: string;
}

export interface MultiFileStarterCode {
  files: StarterCodeFile[];
  entry_point: string;
  readonly_files: string[];
}

export interface SessionProblemPayload {
  problem_id?: string;
  title: string;
  description: string;
  templateCode?: string;
  starter_code?: Record<string, any> | MultiFileStarterCode;
  sample_test_cases: SampleTestCase[];
  time_limit_minutes: number;
  schema_tables?: SqlTableSchema[];
  question_type?: string | null;
  
  // MCQ specific
  options?: string[] | null;

  // Framework specific
  starter_files?: Array<Record<string, any>> | null;
  entry_point?: string | null;
  test_harness?: string | null;
  database_schema?: Array<Record<string, any>> | null;
}

export interface SessionStartResponse {
  session_id: string;
  problem_id: string;
  expires_at: string;
  attempt_number: number;
  attempts_remaining: number;
  problem: SessionProblemPayload;
  problems: SessionProblemPayload[];
  allowed_languages?: LanguageOption[];
}

export interface StartSessionPayload {
  skill_id: string;
  level: string;
}

export interface SubmitSessionPayload {
  code: string;
  language: string;
  metadata?: Record<string, unknown>;
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

export interface SessionRunResponse {
  cases: TestCaseResult[];
  time_taken_ms: number;
  /** Present on SQL `/run` responses: structured stdout vs reference output. */
  sql_run?: boolean;
  stdout?: string | null;
  expected_output?: string | null;
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
  status: string;
  expires_at: string;
  seconds_remaining: number;
  problem: SessionProblemPayload;
  problems: SessionProblemPayload[];
  allowed_languages?: LanguageOption[];
  last_draft_code: string | null;
  last_draft_lang: string | null;
}
