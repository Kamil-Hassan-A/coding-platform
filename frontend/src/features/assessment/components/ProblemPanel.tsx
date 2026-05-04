import type { SessionProblemPayload, SqlTableSchema } from "../types/assessment";
import { isSqlLikeLanguage, looksLikeRawSqlSetup } from "../utils/sqlUi";

interface Props {
  problem: SessionProblemPayload;
  /** Currently selected language (Monaco id). Used to decide whether to render
   *  the SQL Schema panel and to suppress sample test-cases that contain raw
   *  CREATE/INSERT setup. */
  language?: string | null;
}

/**
 * HackerRank-style problem panel.
 *
 *  - Title and description always.
 *  - For SQL problems with a structured `schema`, render a "Schema Definition"
 *    section: one card per table, with a clean two-column (Field / Type) grid.
 *  - For SQL problems we deliberately HIDE the "Sample Cases" block: the
 *    dataset's `sample_test_cases` here are descriptive prose that does not
 *    match the real `__hidden_setup__` Judge0 executes, which used to cause
 *    "expected output" mismatches and ghost CREATE TABLEs in the UI.
 *  - For non-SQL problems we render Sample / Expected blocks as before, while
 *    still filtering anything that smells like raw CREATE/INSERT SQL setup.
 */
export default function ProblemPanel({ problem, language }: Props) {
  const schemaTables: SqlTableSchema[] = Array.isArray(problem.schema_tables)
    ? problem.schema_tables
    : [];
  const hasSchema = schemaTables.length > 0;
  const isSql = hasSchema || isSqlLikeLanguage(language ?? "");

  const visibleSamples = isSql
    ? []
    : (problem.sample_test_cases ?? []).filter(
        (tc) => !(looksLikeRawSqlSetup(tc.input) || looksLikeRawSqlSetup(tc.output)),
      );

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-white">
      <div className="p-8">
        <h1 className="mb-5 text-[24px] font-extrabold leading-[1.3] text-[#111]">
          {problem.title}
        </h1>

        <div className="mb-10 whitespace-pre-wrap text-[15px] leading-[1.7] text-[#444]">
          {problem.description}
        </div>

        {hasSchema && (
          <div className="mb-10 border-t border-[#eee] pt-8">
            <h3 className="mb-5 text-[14px] font-bold uppercase tracking-[0.5px] text-[#999]">
              Schema Definition
            </h3>
            <div className="flex flex-col gap-6">
              {schemaTables.map((table) => (
                <SchemaTableCard key={table.table} table={table} />
              ))}
            </div>
          </div>
        )}

        {isSql ? (
          <div className="border-t border-[#eee] pt-8">
            <div className="rounded-lg border border-dashed border-[#ddd] bg-[#fafafa] p-4 text-sm text-[#777]">
              Your query will be evaluated against the schema shown above. Use <strong className="text-[#555]">Run Code</strong>{" "}
              to execute on the seeded data. In the panel below the editor, compare{" "}
              <strong className="text-[#555]">Your Output (stdout)</strong> with{" "}
              <strong className="text-[#555]">Expected Output</strong> when a reference solution is available.
            </div>
          </div>
        ) : (
          <div className="border-t border-[#eee] pt-8">
            <h3 className="mb-5 text-[14px] font-bold uppercase tracking-[0.5px] text-[#999]">
              Sample Test Cases
            </h3>

            <div className="flex flex-col gap-4">
              {visibleSamples.map((tc, i) => (
                <div key={i} className="rounded-xl border border-[#eef0f2] bg-[#f8f9fa] p-5">
                  <div className="flex gap-6">
                    <div className="flex-1">
                      <div className="mb-2 text-[11px] font-bold text-[#aaa]">INPUT</div>
                      <pre className="m-0 whitespace-pre-wrap rounded-md border border-[#eee] bg-white p-2.5 font-mono text-[13px] text-[#333]">
                        {tc.input || " (empty) "}
                      </pre>
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 text-[11px] font-bold text-[#aaa]">
                        EXPECTED OUTPUT
                      </div>
                      <pre className="m-0 whitespace-pre-wrap rounded-md border border-[#eee] bg-white p-2.5 font-mono text-[13px] text-[#333]">
                        {tc.output || "(empty)"}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}

              {visibleSamples.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#ddd] bg-[#fafafa] p-4 text-sm text-[#777]">
                  No sample test cases available.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SchemaTableCard({ table }: { table: SqlTableSchema }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e3e6ea] bg-white shadow-sm">
      <div className="border-b border-[#e3e6ea] bg-[#f7f9fc] px-5 py-3">
        <div className="text-[11px] font-bold uppercase tracking-[1px] text-[#9aa1ad]">
          Table
        </div>
        <div className="font-mono text-[16px] font-semibold text-[#1f2a37]">
          {table.table}
        </div>
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-[#fafbfc]">
            <th className="border-b border-[#eef0f2] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.6px] text-[#6b7280]">
              Field
            </th>
            <th className="border-b border-[#eef0f2] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.6px] text-[#6b7280]">
              Type
            </th>
          </tr>
        </thead>
        <tbody>
          {table.columns.map((col) => (
            <tr key={col.name} className="even:bg-[#fbfcfd]">
              <td className="border-b border-[#f1f3f5] px-5 py-2.5 font-mono text-[13px] text-[#1f2a37]">
                {col.name}
              </td>
              <td className="border-b border-[#f1f3f5] px-5 py-2.5 font-mono text-[13px] text-[#4b5563]">
                {col.type}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
