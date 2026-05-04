import { useMutation, useQuery } from "@tanstack/react-query";
import {
  startSession,
  runCode,
  submitSession,
  getSession,
  getTestQuestions,
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
      problemId,
    }: {
      sessionId: string;
      code: string;
      language: string;
      /** Required for multi-question SQL/code runs so Judge0/setup/reference match this tab */
      problemId?: string | null;
    }) => runCode(sessionId, code, language, problemId),
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

export const useGetTestQuestions = (skill: string | null) => {
  return useQuery({
    queryKey: ['test-questions', skill],
    queryFn: () => getTestQuestions(skill),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};

