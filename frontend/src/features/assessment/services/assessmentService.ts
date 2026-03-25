import axiosInstance from "../../../api/axiosInstance";
import type {
  ActiveSession,
  SessionStartResponse,
  SessionSubmitResponse,
  SubmissionResultsResponse,
} from "../types/assessment";

export interface StartSessionPayload {
  skill_id: string;
  level: string;
}

export interface SubmitSessionPayload {
  code: string;
  language: string;
}

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
