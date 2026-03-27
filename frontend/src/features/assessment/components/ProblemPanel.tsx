import type { SessionProblemPayload } from "../types/assessment";

interface Props {
  problem: SessionProblemPayload;
}

export default function ProblemPanel({ problem }: Props) {
  return (
    <div className='flex h-full flex-1 flex-col overflow-y-auto bg-white'>
      <div className='p-8'>
        {/* Title */}
        <h1 className='mb-5 text-[24px] font-extrabold leading-[1.3] text-[#111]'>
          {problem.title}
        </h1>

        {/* Description */}
        <div className='mb-10 whitespace-pre-wrap text-[15px] leading-[1.7] text-[#444]'>
          {problem.description}
        </div>

        {/* Sample Test Cases */}
        <div className='border-t border-[#eee] pt-8'>
          <h3 className='mb-5 text-[14px] font-bold uppercase tracking-[0.5px] text-[#999]'>
            Sample Test Cases
          </h3>

          <div className='flex flex-col gap-4'>
            {(problem.sample_test_cases ?? []).map((tc, i) => (
              <div key={i} className='rounded-xl border border-[#eef0f2] bg-[#f8f9fa] p-5'>
                <div className='flex gap-6'>
                  <div className='flex-1'>
                    <div className='mb-2 text-[11px] font-bold text-[#aaa]'>INPUT</div>
                    <pre className='m-0 rounded-md border border-[#eee] bg-white p-2.5 font-mono text-[13px] text-[#333]'>
                      {tc.stdin || " (empty) "}
                    </pre>
                  </div>
                  <div className='flex-1'>
                    <div className='mb-2 text-[11px] font-bold text-[#aaa]'>EXPECTED OUTPUT</div>
                    <pre className='m-0 rounded-md border border-[#eee] bg-white p-2.5 font-mono text-[13px] text-[#333]'>
                      {tc.expected_output || "(empty)"}
                    </pre>
                  </div>
                </div>
              </div>
            ))}

            {(problem.sample_test_cases ?? []).length === 0 && (
              <div className='rounded-lg border border-dashed border-[#ddd] bg-[#fafafa] p-4 text-sm text-[#777]'>
                No sample test cases available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
