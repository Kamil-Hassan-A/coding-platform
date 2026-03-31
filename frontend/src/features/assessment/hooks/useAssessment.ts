import { useMutation, useQuery } from "@tanstack/react-query";
import {
  startSession,
  runCode,
  submitSession,
  getSession,
  getSubmissionResults,
} from "../services/assessmentService";
import type { StartSessionPayload, SubmitSessionPayload } from "../types/assessment";

export const useStartSession = () => {
  return useMutation({
    mutationFn: (payload: StartSessionPayload) => startSession(payload),
  });
};

export const useSubmitSession = () => {
  return useMutation({
    mutationFn: ({
      session_id,
      payload,
    }: {
      session_id: string;
      payload: SubmitSessionPayload;
    }) => submitSession(session_id, payload),
    retry: false,
  });
};

export const useRunCode = () => {
  return useMutation({
    mutationFn: ({
      sessionId,
      code,
      language,
    }: {
      sessionId: string;
      code: string;
      language: string;
    }) => runCode(sessionId, code, language),
    retry: false,
  });
};

export const useGetSession = (session_id: string | null) => {
  return useQuery({
    queryKey: ["session", session_id],
    queryFn: () => getSession(session_id!),
    enabled: !!session_id,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};

export const useSubmissionResults = (submission_id: string | null) => {
  return useQuery({
    queryKey: ["submission-results", submission_id],
    queryFn: () => getSubmissionResults(submission_id!),
    enabled: !!submission_id,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
