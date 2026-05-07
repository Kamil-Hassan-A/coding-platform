import { useState } from "react";
import type {
  SessionRunResponse,
  TestCaseResult,
} from "../types/assessment";

interface Props {
  /** Result from "Submit Question" — /run with use_hidden=true. Per-question. */
  submitResult: SessionRunResponse | null;
  /** Result from "Run Code" — /run with use_hidden=false. Cleared on question switch. */
  runResult: SessionRunResponse | null;
}

/**
 * Displays test case results.
 * - submitResult: shown after "Submit Question" (all cases, hidden ones redacted)
 * - runResult:    shown after "Run Code" (sample cases only)
 * Parent remounts via key={questionKey} when the active question changes.
 */
export default function TestCases({ submitResult, runResult }: Props) {
  // ── Submit Question view ──────────────────────────────────────────────────
  if (submitResult) {
    const allCases = submitResult.cases ?? [];
    const sampleCases = allCases.filter((tc) => !tc.is_hidden);
    const hiddenCases = allCases.filter((tc) => tc.is_hidden);
    const passedSample = sampleCases.filter((tc) => tc.passed).length;
    const passedHidden = hiddenCases.filter((tc) => tc.passed).length;
    const totalPassed = allCases.filter((tc) => tc.passed).length;
    const totalCases = allCases.length;
    const allPassed = totalCases > 0 && totalPassed === totalCases;
    const score = totalCases > 0 ? Math.round((totalPassed / totalCases) * 100) : 0;

    return (
      <div className="p-6 font-['Segoe_UI',sans-serif]">
        {/* Header banner */}
        <div
          className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${
            allPassed
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {allPassed ? "✓ All test cases passed!" : "✗ Some test cases failed"}
        </div>

        {/* Stats row */}
        <div className="mb-6 flex items-center justify-between border-b border-[#eee] pb-4">
          <div className="flex gap-6">
            <div>
              <div className="text-[11px] font-bold tracking-[0.5px] text-[#999]">SCORE</div>
              <div className="text-[24px] font-extrabold text-[#111]">{score}%</div>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-[0.5px] text-[#999]">SAMPLE CASES</div>
              <div className="text-[24px] font-extrabold text-[#111]">
                {passedSample} / {sampleCases.length}
              </div>
            </div>
            {hiddenCases.length > 0 && (
              <div>
                <div className="text-[11px] font-bold tracking-[0.5px] text-[#999]">HIDDEN CASES</div>
                <div className={`text-[24px] font-extrabold ${passedHidden === hiddenCases.length ? "text-green-600" : "text-red-500"}`}>
                  {passedHidden} / {hiddenCases.length}
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-[#999]">TIME</div>
            <div className="text-[14px] font-semibold text-[#555]">{submitResult.time_taken_ms}ms</div>
          </div>
        </div>

        {/* Sample cases — full detail */}
        {sampleCases.length > 0 && (
          <div className="flex flex-col gap-3">
            {sampleCases.map((tc, i) => (
              <TestCaseRow key={`s-${i}`} index={i} tc={tc} label="Sample" />
            ))}
          </div>
        )}

        {/* Hidden cases — statistics only */}
        {hiddenCases.length > 0 && (
          <div className={sampleCases.length > 0 ? "mt-4 pt-4 border-t border-[#eee]" : ""}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[12px] font-bold tracking-[0.5px] text-[#666]">HIDDEN TEST CASES</div>
              <div className={`text-[12px] font-bold ${passedHidden === hiddenCases.length ? "text-green-600" : "text-red-600"}`}>
                {passedHidden} / {hiddenCases.length} passed
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-[#ddd] bg-[#fafafa] p-4 text-sm text-[#777]">
              Hidden test case inputs and outputs are not shown to prevent hardcoding.
              Your code passed{" "}
              <strong className={passedHidden === hiddenCases.length ? "text-green-600" : "text-red-600"}>
                {passedHidden} of {hiddenCases.length}
              </strong>{" "}
              hidden test cases.
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Run Code view ─────────────────────────────────────────────────────────
  if (!runResult) return null;

  const runCases = runResult.cases ?? [];
  const passedCases = runCases.filter((tc) => tc.passed).length;
  const allPassed = runCases.length > 0 && passedCases === runCases.length;

  if (runResult.sql_run === true) {
    const tc0 = runCases[0];
    const userOut =
      (runResult.stdout as string | null | undefined) ??
      (typeof tc0?.stdout === "string" ? tc0.stdout : tc0?.stdout != null ? String(tc0.stdout) : null);
    const expectedOut =
      (runResult.expected_output as string | null | undefined) ??
      (typeof tc0?.expected_output === "string"
        ? tc0.expected_output
        : tc0?.expected_output != null
          ? String(tc0.expected_output)
          : null);

    const outBlock =
      "m-0 max-h-[min(420px,50vh)] min-h-[4rem] overflow-auto whitespace-pre-wrap rounded-md border border-[#eee] bg-white p-3 font-mono text-[13px] text-[#333]";

    return (
      <div className="p-6 font-['Segoe_UI',sans-serif]">
        <div
          className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${
            allPassed
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {allPassed ? "✓ Query ran and output matches the expected result" : "✗ Output differs or the query did not run successfully"}
        </div>

        <div className="mb-6 flex items-center justify-between border-b border-[#eee] pb-4">
          <div className="flex gap-6">
            <div>
              <div className="text-[11px] font-bold tracking-[0.5px] text-[#999]">SQL RUN</div>
              <div className="text-[24px] font-extrabold text-[#111]">
                {allPassed ? "PASS" : "FAIL"}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-[#999]">TIME</div>
            <div className="text-[14px] font-semibold text-[#555]">{runResult.time_taken_ms}ms</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="min-h-0 min-w-0">
            <div className="mb-2 text-[11px] font-bold tracking-[0.5px] text-[#999]">YOUR OUTPUT (STDOUT)</div>
            <pre className={outBlock}>{userOut != null && userOut !== "" ? userOut : "(empty)"}</pre>
          </div>
          <div className="min-h-0 min-w-0">
            <div className="mb-2 text-[11px] font-bold tracking-[0.5px] text-[#999]">EXPECTED OUTPUT</div>
            {expectedOut != null && expectedOut !== "" ? (
              <pre className={outBlock}>{expectedOut}</pre>
            ) : (
              <div className="max-h-[min(420px,50vh)] min-h-[4rem] overflow-auto rounded-md border border-dashed border-[#ddd] bg-[#fafafa] p-3 text-sm text-[#777]">
                No reference output is available for this problem. Your query still runs against the seeded tables.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 font-['Segoe_UI',sans-serif]">
      <div
        className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${
          allPassed
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        {allPassed ? "✓ Code compiled and ran successfully" : "✗ Some test cases failed"}
      </div>

      <div className="mb-6 flex items-center justify-between border-b border-[#eee] pb-4">
        <div className="flex gap-6">
          <div>
            <div className="text-[11px] font-bold tracking-[0.5px] text-[#999]">SAMPLE TEST CASES</div>
            <div className="text-[24px] font-extrabold text-[#111]">
              {passedCases} / {runCases.length}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold text-[#999]">TIME TAKEN</div>
          <div className="text-[14px] font-semibold text-[#555]">{runResult.time_taken_ms}ms</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {runCases.map((tc, i) => (
          <TestCaseRow key={`r-${i}`} index={i} tc={tc} label="Sample" />
        ))}
      </div>
    </div>
  );
}

function TestCaseRow({
  index,
  tc,
  label = "Test Case",
}: {
  index: number;
  tc: TestCaseResult;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusDescription =
    typeof tc.status?.description === "string"
      ? tc.status.description
      : tc.passed
        ? "Accepted"
        : "Wrong Answer";
  const actualOutput = tc.stdout ?? (!tc.passed ? tc.stderr ?? tc.compile_output ?? tc.message ?? statusDescription : null);

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#eee]">
      <div
        onClick={() => setExpanded(!expanded)}
        className={`flex cursor-pointer items-center justify-between px-5 py-3.5 transition-colors ${
          expanded ? "bg-gray-50" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-[18px] ${tc.passed ? "text-green-500" : "text-red-500"}`}>
            {tc.passed ? "✓" : "✗"}
          </span>
          <span className="text-[14px] font-semibold text-[#333]">
            {label} Test Case {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-[#999]">
          {statusDescription}
          <span className={`transition-transform ${expanded ? "rotate-180" : "rotate-0"}`}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#eee] bg-[#fcfcfc] p-5">
          {tc.is_hidden ? (
            <div className="rounded-md border border-dashed border-[#ddd] bg-[#fafafa] p-4 text-center text-sm text-[#777]">
              Input and output details for hidden test cases are not shown.
              <br />
              Status:{" "}
              <strong className={tc.passed ? "text-green-600" : "text-red-600"}>
                {tc.passed ? "Passed" : "Failed"}
              </strong>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="mb-1.5 text-[11px] font-bold text-[#999]">INPUT</div>
                <pre className="m-0 whitespace-pre-wrap rounded-md border border-[#eee] bg-white p-3 font-mono text-[13px]">
                  {tc.stdin || "(empty)"}
                </pre>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-bold text-[#999]">EXPECTED OUTPUT</div>
                <pre className="m-0 whitespace-pre-wrap rounded-md border border-[#eee] bg-white p-3 font-mono text-[13px]">
                  {tc.expected_output || "(empty)"}
                </pre>
              </div>
              <div className="col-span-2">
                <div className="mb-1.5 text-[11px] font-bold text-[#999]">ACTUAL OUTPUT</div>
                <pre
                  className={`m-0 whitespace-pre-wrap rounded-md border p-3 font-mono text-[13px] ${
                    tc.passed
                      ? "border-[#eee] bg-white text-[#333]"
                      : "border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  {actualOutput || "(empty)"}
                </pre>
              </div>
              {tc.stderr && (
                <div className="col-span-2">
                  <div className="mb-1.5 text-[11px] font-bold text-red-500">ERROR</div>
                  <pre className="m-0 whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50 p-3 font-mono text-[13px] text-red-500">
                    {tc.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
