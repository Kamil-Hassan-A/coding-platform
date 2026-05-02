import axiosInstance from "../../../api/axiosInstance";
import type {
  ActiveSession,
  SessionRunResponse,
  StartSessionPayload,
  SessionStartResponse,
  SessionSubmitResponse,
  SubmitSessionPayload,
  SubmissionResultsResponse,
} from "../types/assessment";

export type { StartSessionPayload, SubmitSessionPayload } from "../types/assessment";

export const startSession = async (
  payload: StartSessionPayload
): Promise<SessionStartResponse> => {
  const response = await axiosInstance.post<SessionStartResponse>(
    "/sessions/start",
    payload
  );
  return response.data;
};

export const submitSession = async (
  session_id: string,
  payload: SubmitSessionPayload
): Promise<SessionSubmitResponse> => {
  const response = await axiosInstance.post<SessionSubmitResponse>(
    `/sessions/${session_id}/submit`,
    payload
  );
  return response.data;
};

export const runCode = async (
  sessionId: string,
  code: string,
  language: string,
  problemId?: string
): Promise<SessionRunResponse> => {
  const response = await axiosInstance.post<SessionRunResponse>(
    `/sessions/${sessionId}/run`,
    { code, language, problem_id: problemId }
  );
  return response.data;
};

export const getTestQuestions = async (skill: string | null) => {
  const response = await axiosInstance.get("/api/test/questions", { params: skill ? { skill } : {} });
  return response.data;
};

export const getSession = async (session_id: string): Promise<ActiveSession> => {
  const response = await axiosInstance.get<ActiveSession>(
    `/sessions/${session_id}`
  );
  return response.data;
};

export const getSubmissionResults = async (
  submission_id: string
): Promise<SubmissionResultsResponse> => {
  const response = await axiosInstance.get<SubmissionResultsResponse>(
    `/submissions/${submission_id}/results`
  );
  return response.data;
};
