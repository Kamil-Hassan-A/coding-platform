import { useState } from "react";
import type {
  SessionRunResponse,
  SessionSubmitResponse,
  TestCaseResult,
} from "../types/assessment";

interface Props {
  submissionResult: SessionSubmitResponse | null;
  runResult: SessionRunResponse | null;
}

export default function TestCases({ submissionResult, runResult }: Props) {
  if (!submissionResult && runResult) {
    const runCases = runResult.cases ?? [];
    const passedCases = runCases.filter((tc) => tc.passed).length;
    const allPassed = runCases.length > 0 && passedCases === runCases.length;

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

        <div className='mb-6 flex items-center justify-between border-b border-[#eee] pb-4'>
          <div className='flex gap-6'>
            <div>
              <div className='text-[11px] font-bold tracking-[0.5px] text-[#999]'>SAMPLE TEST CASES</div>
              <div className='text-[24px] font-extrabold text-[#111]'>
                {passedCases} / {runCases.length}
              </div>
            </div>
          </div>
          <div className='text-right'>
            <div className='text-[11px] font-bold text-[#999]'>TIME TAKEN</div>
            <div className='text-[14px] font-semibold text-[#555]'>{runResult.time_taken_ms}ms</div>
          </div>
        </div>

        <div className='flex flex-col gap-3'>
          {runCases.map((tc, i) => (
            <TestCaseRow key={i} index={i} tc={tc} />
          ))}
        </div>
      </div>
    );
  }

  if (!submissionResult) {
    return null;
  }

  const result = submissionResult;
  return (
    <div className="p-6 font-['Segoe_UI',sans-serif]">
      <div className='mb-6 flex items-center justify-between border-b border-[#eee] pb-4'>
        <div className='flex gap-6'>
          <div>
            <div className='text-[11px] font-bold tracking-[0.5px] text-[#999]'>OVERALL SCORE</div>
            <div className='text-[24px] font-extrabold text-[#111]'>{result.score}%</div>
          </div>
          <div>
            <div className='text-[11px] font-bold tracking-[0.5px] text-[#999]'>TEST CASES</div>
            <div className='text-[24px] font-extrabold text-[#111]'>
              {result.passed_tests} / {result.total_tests}
            </div>
          </div>
        </div>

        <div className='flex items-center gap-4'>
          <div className='text-right'>
            <div className='text-[11px] font-bold text-[#999]'>TIME TAKEN</div>
            <div className='text-[14px] font-semibold text-[#555]'>{result.time_taken_seconds}s</div>
          </div>
          <div
            className={`rounded-full px-4 py-2 text-[13px] font-bold uppercase ${
              result.status === "cleared" ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
            }`}
          >
            {result.status}
          </div>
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        {result.cases.map((tc, i) => (
          <TestCaseRow key={i} index={i} tc={tc} />
        ))}
      </div>
    </div>
  );
}

function TestCaseRow({ index, tc }: { index: number; tc: TestCaseResult }) {
  const [expanded, setExpanded] = useState(false);
  const statusDescription =
    typeof tc.status?.description === "string"
      ? tc.status.description
      : tc.passed
        ? "Accepted"
        : "Wrong Answer";
  const actualOutput = tc.stdout ?? (!tc.passed ? tc.stderr ?? tc.compile_output ?? tc.message ?? statusDescription : null);

  return (
    <div className='overflow-hidden rounded-[10px] border border-[#eee]'>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`flex cursor-pointer items-center justify-between px-5 py-3.5 transition-colors ${
          expanded ? "bg-gray-50" : "bg-white"
        }`}
      >
        <div className='flex items-center gap-3'>
          <span className={`text-[18px] ${tc.passed ? "text-green-500" : "text-red-500"}`}>{tc.passed ? "✓" : "✗"}</span>
          <span className='text-[14px] font-semibold text-[#333]'>Test Case {index + 1}</span>
        </div>
        <div className='flex items-center gap-1 text-[12px] text-[#999]'>
          {statusDescription}
          <span className={`transition-transform ${expanded ? "rotate-180" : "rotate-0"}`}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className='border-t border-[#eee] bg-[#fcfcfc] p-5'>
          <div className='grid grid-cols-2 gap-5'>
            <div>
              <div className='mb-1.5 text-[11px] font-bold text-[#999]'>INPUT</div>
              <pre className='m-0 whitespace-pre-wrap rounded-md border border-[#eee] bg-white p-3 font-mono text-[13px]'>{tc.stdin || "(empty)"}</pre>
            </div>
            <div>
              <div className='mb-1.5 text-[11px] font-bold text-[#999]'>EXPECTED OUTPUT</div>
              <pre className='m-0 whitespace-pre-wrap rounded-md border border-[#eee] bg-white p-3 font-mono text-[13px]'>{tc.expected_output || "(empty)"}</pre>
            </div>
            <div className='col-span-2'>
              <div className='mb-1.5 text-[11px] font-bold text-[#999]'>ACTUAL OUTPUT</div>
              <pre
                className={`m-0 whitespace-pre-wrap rounded-md border p-3 font-mono text-[13px] ${
                  tc.passed
                    ? "border-green-200 bg-green-50 text-green-900"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
              >
                {actualOutput || "(empty)"}
              </pre>
            </div>
            {tc.stderr && (
              <div className='col-span-2'>
                <div className='mb-1.5 text-[11px] font-bold text-red-500'>ERROR</div>
                <pre className='m-0 whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50 p-3 font-mono text-[13px] text-red-500'>
                  {tc.stderr}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
