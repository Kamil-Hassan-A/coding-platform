import { useMemo } from "react";

import type { SessionProblemPayload } from "../types/assessment";

type McqOption = {
  key: string;
  text: string;
};

interface Props {
  problem: SessionProblemPayload;
  selectedOption: string | null;
  savedOption: string | null;
  onSelect: (option: string) => void;
  onSaveAnswer: () => void;
  onClearResponse: () => void;
  onNextQuestion: () => void;
  onSubmitTest: () => void;
  isLastQuestion?: boolean;
}

function parseMcqContent(description: string): { stem: string; options: McqOption[] } {
  const lines = description.split(/\r?\n/);
  const optionPattern = /^\s*([A-D])\)\s*(.+)$/i;

  const stemLines: string[] = [];
  const options: McqOption[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (options.length === 0) {
        stemLines.push("");
      }
      continue;
    }

    const match = line.match(optionPattern);
    if (match) {
      options.push({ key: match[1].toUpperCase(), text: match[2].trim() });
      continue;
    }

    if (options.length === 0) {
      stemLines.push(line);
    }
  }

  return {
    stem: stemLines.join("\n").trim() || description,
    options,
  };
}

export default function AgileMcqPanel({
  problem,
  selectedOption,
  savedOption,
  onSelect,
  onSaveAnswer,
  onClearResponse,
  onNextQuestion,
  onSubmitTest,
  isLastQuestion,
}: Props) {
  const parsed = useMemo(() => parseMcqContent(problem.description ?? ""), [problem.description]);

  return (
    <div className="h-full overflow-y-auto bg-white px-6 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="border-b border-slate-200 pb-5">
          <h2 className="text-[16px] font-semibold text-slate-600">{problem.title}</h2>
          <h3 className="mt-3 whitespace-pre-wrap text-[28px] font-medium leading-9 tracking-[-0.01em] text-slate-900">{parsed.stem}</h3>
        </div>

        <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-[0.4px] text-slate-500">
          Pick One Option
        </div>

        <div className="space-y-3">
          {parsed.options.length > 0 ? (
            parsed.options.map((option) => {
              const isSelected = selectedOption === option.key;
              const isSaved = savedOption === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSelect(option.key)}
                  className={`w-full rounded-xl border px-5 py-3.5 text-left transition-all ${
                    isSelected
                      ? "border-admin-orange bg-orange-50 text-slate-900 shadow-sm"
                      : isSaved
                        ? "border-orange-300 bg-orange-50/50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        isSelected || isSaved ? "bg-admin-orange text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {option.key}
                    </div>
                    <div className="flex-1">
                      <span className="text-[16px] leading-7">{option.text}</span>
                      {isSaved && (
                        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.4px] text-admin-orange">
                          Saved
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No MCQ options were detected in this question description.
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onSaveAnswer}
            className="rounded-lg border border-admin-orange bg-white px-4 py-2 text-sm font-semibold text-admin-orange transition-colors hover:bg-orange-50"
          >
            Save Answer
          </button>
          <button
            type="button"
            onClick={onClearResponse}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Clear Response
          </button>
          <button
            type="button"
            onClick={isLastQuestion ? onSubmitTest : onNextQuestion}
            className="rounded-lg border border-admin-orange bg-admin-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            {isLastQuestion ? "Submit Test" : "Next Question"}
          </button>
        </div>
      </div>
    </div>
  );
}
