import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import InstructionsScreen from "./components/InstructionsScreen";
import type { CandidateSelection, CandidateSelectionIds } from "./types/candidate";
import { useStartSession } from "../assessment/hooks/useAssessment";

type InstructionsRouteState = {
  confirmed?: CandidateSelection;
  confirmedIds?: CandidateSelectionIds;
};

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

export default function InstructionsRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as InstructionsRouteState | null;
  const confirmed = state?.confirmed ?? null;
  const confirmedIds = state?.confirmedIds ?? null;
  const { mutate: startSession, isPending: isStarting } = useStartSession();

  const requestFullscreenSafe = useCallback(async (): Promise<boolean> => {
    const target = document.documentElement as FullscreenTarget;
    const request =
      target.requestFullscreen ||
      target.webkitRequestFullscreen ||
      target.msRequestFullscreen;

    if (!request) {
      return false;
    }

    try {
      const result = request.call(target);
      if (result && typeof (result as Promise<void>).then === "function") {
        await result;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!confirmed || !confirmedIds) {
      navigate("/candidate/dashboard", { replace: true });
    }
  }, [confirmed, confirmedIds, navigate]);

  if (!confirmed || !confirmedIds) {
    return null;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-admin-bg px-4 py-6">
      <InstructionsScreen
        confirmed={confirmed}
        onBack={() =>
          navigate("/candidate/dashboard")
        }
        onContinue={async () => {
          const enteredFullscreen = await requestFullscreenSafe();
          startSession(confirmedIds, {
            onSuccess: (data) => {
              navigate("/candidate/assessment", {
                state: {
                  session_id: data.session_id,
                  problem: data.problem,
                  problems: data.problems ?? [],
                  skill_name: confirmed.skill,
                  allowed_languages: data.allowed_languages ?? [],
                  auto_start: enteredFullscreen,
                },
              });
            },
            onError: (error: unknown) => {
              const detail =
                typeof (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail === "string"
                  ? ((error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? null)
                  : null;

              alert(
                detail
                  ? `Failed to start assessment session: ${detail}`
                  : "Failed to start assessment session. Please try again.",
              );
            },
          });
        }}
      />
      {isStarting && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center bg-black/10">
          <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow">
            Starting session...
          </div>
        </div>
      )}
    </div>
  );
}
