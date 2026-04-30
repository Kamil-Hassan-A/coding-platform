import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from "recharts";

import { getAdminCandidates, getDashboardStats } from "../dashboardService";

export type PieDatum = { name: string; value: number; fill: string };

const SKILL_PALETTE = ["#f97316", "#14b8a6", "#6366f1", "#eab308", "#94a3b8", "#ef4444", "#22c55e"];
const COLORS = { green: "#16a34a", red: "#dc2626" };

// ── Small presentational pieces ─────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className='flex-1 rounded-xl border border-admin-border bg-white px-[22px] py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
      <div className='text-[30px] font-bold leading-none tracking-[-0.5px] text-admin-text'>{value}</div>
      <div className='mt-1.5 text-[13px] font-medium text-admin-text-muted'>{label}</div>
      {sub && <div className='mt-1 text-[11px] font-semibold text-admin-orange'>{sub}</div>}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboardOverview() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60,
  });

  // Fetch all candidates (no filters) for dashboard-level stats
  const { data: candidateRows = [] } = useQuery({
    queryKey: ["admin-candidates-overview"],
    queryFn: () => getAdminCandidates(),
    staleTime: 1000 * 60,
  });

  const statusCounts = useMemo(
    () => candidateRows.reduce(
      (acc, row) => { acc[row.status] += 1; return acc; },
      { Pass: 0, Fail: 0, Pending: 0 },
    ),
    [candidateRows],
  );

  const totalPass = statusCounts.Pass;
  const passRate = candidateRows.length > 0 ? Math.round((totalPass / candidateRows.length) * 100) : 0;

  const passFailPie: PieDatum[] = [
    { name: "Pass", value: statusCounts.Pass, fill: COLORS.green },
    { name: "Fail", value: statusCounts.Fail, fill: COLORS.red },
  ];

  const skillPie = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of candidateRows) {
      if (row.skill === "Not Attempted") continue;
      grouped.set(row.skill, (grouped.get(row.skill) ?? 0) + 1);
    }
    return Array.from(grouped.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: SKILL_PALETTE[i % SKILL_PALETTE.length],
    }));
  }, [candidateRows]);

  return (
    <>
      <div className='mb-6'>
        <h1 className='m-0 text-[26px] font-bold tracking-[-0.5px]'>
          <span className='text-admin-orange'>Dashboard</span>
        </h1>
        <p className='mt-1 text-[13px] text-admin-text-muted'>Internal skill assessment overview</p>
      </div>

      {/* Stat cards */}
      <div className='mb-7 flex gap-3.5'>
        <StatCard label='Total Employees' value={stats?.totalEmployees ?? 0} />
        <StatCard label='Assessments Taken' value={stats?.totalAssessments ?? 0} />
        <StatCard label='Pass Rate' value={`${passRate}%`} sub={`${totalPass} passed out of ${candidateRows.length}`} />
        <StatCard label='Pending' value={statusCounts.Pending} sub='awaiting assessment' />
      </div>

      {/* Charts */}
      <div className='mb-5 grid grid-cols-2 gap-[18px]'>
        <div className='rounded-xl border border-admin-border bg-white px-5 py-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
          <div className='mb-0.5 text-[15px] font-bold'>Pass / Fail Breakdown</div>
          <div className='mb-3.5 text-[12px] text-admin-text-muted'>All assessments</div>
          <ResponsiveContainer width='100%' height={210}>
            <PieChart>
              <Pie data={passFailPie} dataKey='value' cx='50%' cy='50%' outerRadius={82} innerRadius={50} paddingAngle={4} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(v: unknown) => [Number(v) || 0, "Employees"]} />
              <Legend iconType='circle' iconSize={9} formatter={(v) => <span className='text-[12px] text-admin-text-muted'>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className='rounded-xl border border-admin-border bg-white px-5 py-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
          <div className='mb-0.5 text-[15px] font-bold'>Skill Distribution</div>
          <div className='mb-3.5 text-[12px] text-admin-text-muted'>Employees by assessed skill</div>
          <ResponsiveContainer width='100%' height={210}>
            <PieChart>
              <Pie data={skillPie} dataKey='value' cx='50%' cy='50%' outerRadius={82} innerRadius={50} paddingAngle={4} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(v: unknown) => [Number(v) || 0, "Employees"]} />
              <Legend iconType='circle' iconSize={9} formatter={(v) => <span className='text-[12px] text-admin-text-muted'>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pass / Fail by Skill bar list */}
      <div className='rounded-xl border border-admin-border bg-white px-6 py-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
        <div className='mb-4 text-[15px] font-bold'>Pass / Fail by Skill</div>
        {(() => {
          const grouped = new Map<string, { skill: string; pass: number; fail: number }>();
          for (const row of candidateRows) {
            if (row.skill === "Not Attempted") continue;
            const existing = grouped.get(row.skill) ?? { skill: row.skill, pass: 0, fail: 0 };
            if (row.status === "Pass") existing.pass += 1;
            else if (row.status === "Fail") existing.fail += 1;
            grouped.set(row.skill, existing);
          }
          const visibleStats = Array.from(grouped.values());
          return visibleStats.length === 0 ? (
            <div className='py-5 text-center text-[13px] text-admin-text-light'>No data for selected skill.</div>
          ) : (
            <div className='flex flex-col gap-3'>
              {visibleStats.map((row, i) => {
                const total = row.pass + row.fail;
                const pct = total > 0 ? Math.round((row.pass / total) * 100) : 0;
                return (
                  <div key={i} className='flex items-center gap-3.5'>
                    <div className='w-[190px] shrink-0 text-[13px] font-medium'>{row.skill}</div>
                    <div className='h-[7px] flex-1 overflow-hidden rounded-full bg-gray-100'>
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${pct >= 60 ? "bg-admin-green" : "bg-admin-red"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className={`w-[38px] shrink-0 text-right text-[12px] font-bold ${pct >= 60 ? "text-admin-green" : "text-admin-red"}`}>
                      {pct}%
                    </div>
                    <div className='w-[72px] shrink-0 text-right text-[12px] text-admin-text-light'>
                      {row.pass}P - {row.fail}F
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </>
  );
}
