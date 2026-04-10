import { useEffect, useMemo, useState } from "react";

import axiosInstance from "../api/axiosInstance";
import { downloadWithAuth } from "../lib/downloadWithAuth";

type SessionDownloadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  mode: "pdf" | "csv";
  csvType?: "summary" | "detailed";
};

type CandidateSessionRow = {
  session_id: string;
  skill: string;
  score: number;
  status: string;
  submitted_at: string | null;
};

const PASS_STATUSES = new Set(["cleared", "submitted", "success", "pass"]);

function toDisplayDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default function SessionDownloadModal({ isOpen, onClose, userId, mode, csvType = "summary" }: SessionDownloadModalProps) {
  const [sessions, setSessions] = useState<CandidateSessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingSessionId, setDownloadingSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!userId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.get<CandidateSessionRow[]>(`/admin/candidate/${userId}/sessions`);
      setSessions(response.data ?? []);
    } catch {
      setError("Failed to load sessions");
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !userId) {
      return;
    }
    void fetchSessions();
  }, [isOpen, userId]);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return bTime - aTime;
      }),
    [sessions],
  );

  const handleDownload = (sessionId: string) => {
    setDownloadingSessionId(sessionId);
    const endpoint =
      mode === "csv"
        ? `${import.meta.env.VITE_API_BASE_URL}/admin/session-report/${sessionId}/csv?type=${csvType}`
        : `${import.meta.env.VITE_API_BASE_URL}/admin/session-report/${sessionId}/pdf`;
    const fileName =
      mode === "csv"
        ? `${userId}_session_${sessionId}_${csvType}.csv`
        : `${userId}_session_${sessionId}.pdf`;

    void downloadWithAuth(endpoint, fileName)
      .catch((downloadError: unknown) => {
        console.error("Session download failed", downloadError);
      })
      .finally(() => {
        setDownloadingSessionId((current) => (current === sessionId ? null : current));
      });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 px-4'
      onClick={onClose}
      role='button'
      tabIndex={-1}
      aria-label='Close session download modal'
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
    >
      <div
        className='w-full max-w-3xl rounded-xl border border-admin-border bg-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
        onClick={(event) => event.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-label='Select Session to Download'
      >
        <div className='flex items-center justify-between border-b border-admin-border px-5 py-4'>
          <h2 className='text-[18px] font-bold text-admin-text'>
            {mode === "csv" ? "Select Session for CSV" : "Select Session for PDF"}
          </h2>
          <button
            onClick={onClose}
            className='cursor-pointer border-none bg-transparent text-[20px] leading-none text-admin-text-muted'
            aria-label='Close'
          >
            x
          </button>
        </div>

        <div className='max-h-[70vh] overflow-y-auto p-5'>
          {isLoading && (
            <div className='flex items-center justify-center gap-3 py-10 text-[13px] font-semibold text-admin-text-muted'>
              <span className='inline-block h-4 w-4 animate-spin rounded-full border-2 border-admin-border border-t-admin-orange' />
              Loading tests...
            </div>
          )}

          {!isLoading && error && (
            <div className='rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#991b1b]'>
              <div>{error}</div>
              <button
                onClick={() => {
                  void fetchSessions();
                }}
                className='mt-3 cursor-pointer rounded-[6px] border-none bg-[#dc2626] px-[10px] py-[3px] text-[11px] font-semibold text-white'
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && sortedSessions.length === 0 && (
            <div className='flex items-center justify-center py-10 text-[13px] font-semibold text-admin-text-muted'>
              No tests available
            </div>
          )}

          {!isLoading && !error && sortedSessions.length > 0 && (
            <div className='overflow-hidden rounded-lg border border-admin-border'>
              <table className='w-full border-collapse'>
                <thead>
                  <tr className='bg-admin-bg'>
                    <th className='border-b border-admin-border px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Skill</th>
                    <th className='border-b border-admin-border px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Score</th>
                    <th className='border-b border-admin-border px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Status</th>
                    <th className='border-b border-admin-border px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Date</th>
                    <th className='border-b border-admin-border px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.map((session, index) => {
                    const isPass = PASS_STATUSES.has(session.status.toLowerCase());
                    const isDownloading = downloadingSessionId === session.session_id;

                    return (
                      <tr key={session.session_id} className={`border-b border-slate-100 last:border-b-0 ${index === 0 ? "bg-[#fff7ed]" : ""}`}>
                        <td className='px-4 py-3 text-[13px] font-semibold text-admin-text'>
                          <span>{session.skill}</span>
                          {index === 0 && (
                            <span className='ml-2 rounded-md bg-admin-orange-light px-2 py-0.5 text-[10px] font-bold text-admin-orange'>
                              Latest
                            </span>
                          )}
                        </td>
                        <td className='px-4 py-3 text-[13px] font-semibold text-admin-text'>{session.score}</td>
                        <td className='px-4 py-3'>
                          <span
                            className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${
                              isPass ? "bg-admin-green-bg text-admin-green" : "bg-admin-red-bg text-admin-red"
                            }`}
                          >
                            {isPass ? "Pass" : "Fail"}
                          </span>
                        </td>
                        <td className='px-4 py-3 text-[12px] text-admin-text-muted'>{toDisplayDate(session.submitted_at)}</td>
                        <td className='px-4 py-3'>
                          <button
                            onClick={() => handleDownload(session.session_id)}
                            disabled={isDownloading}
                            className='inline-flex cursor-pointer items-center gap-1.5 border-none bg-[#dc2626] px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px] disabled:cursor-not-allowed disabled:opacity-70'
                          >
                            {isDownloading && (
                              <span className='inline-block h-4 w-4 animate-spin rounded-full border-2 border-admin-border border-t-admin-orange' />
                            )}
                            <span>{isDownloading ? "Downloading..." : mode === "csv" ? "Download CSV" : "Download PDF"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
