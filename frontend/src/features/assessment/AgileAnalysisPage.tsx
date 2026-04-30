import { useLocation, useNavigate } from "react-router-dom";

type AgileAnalysisItem = {
  questionLabel: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
};

type AgileAnalysisState = {
  items?: AgileAnalysisItem[];
  score?: number;
  status?: string;
};

export default function AgileAnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as AgileAnalysisState | null) ?? null;
  const items = state?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg p-6 font-['Segoe_UI',sans-serif]">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-admin-text">No analysis data found</h2>
          <p className="mt-3 text-sm text-slate-600">Please submit an Agile assessment first.</p>
          <button
            onClick={() => navigate("/candidate/dashboard")}
            className="mt-6 rounded-lg bg-admin-orange px-5 py-2.5 text-sm font-semibold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-admin-bg p-6 font-['Segoe_UI',sans-serif]">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold text-admin-text">Agile Answer Analysis</h1>
          <div className="flex gap-4 text-sm font-semibold text-slate-700">
            <span>Score: {state?.score ?? 0}%</span>
            <span>Status: {(state?.status ?? "submitted").toString()}</span>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.questionLabel} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="font-bold text-slate-900">{item.questionLabel}</span>
              <span className="ml-3 text-slate-700">Your answer: {item.selectedAnswer}</span>
              <span className={`ml-3 font-semibold ${item.isCorrect ? "text-green-600" : "text-red-600"}`}>
                {item.isCorrect ? "Right" : "Wrong"}
              </span>
              <span className="ml-3 text-slate-700">Right answer: {item.correctAnswer}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => navigate("/candidate/thankyou")}
            className="rounded-lg bg-admin-orange px-5 py-2.5 text-sm font-semibold text-white"
          >
            End Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
