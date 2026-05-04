import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

import { logout } from "../auth/authService";
import Sidebar from "../../components/layout/Sidebar";
import CredentialsPage from "./CredentialsPage";
import { getAdminCandidates, getDashboardStats, type AdminCandidate } from "./dashboardService";

const COLORS = {
  orange: "#f97316",
  green: "#16a34a",
  red: "#dc2626",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className='flex-1 rounded-xl border border-admin-border bg-white px-[22px] py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
      <div className='text-[30px] font-bold leading-none tracking-[-0.5px] text-admin-text'>{value}</div>
      <div className='mt-1.5 text-[13px] font-medium text-admin-text-muted'>{label}</div>
      {sub && <div className='mt-1 text-[11px] font-semibold text-admin-orange'>{sub}</div>}
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-lg border-none px-4 py-1.5 text-[13px] font-semibold transition-all ${
        active ? "bg-admin-orange text-white" : "bg-gray-100 text-admin-text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function ActiveTag({ label }: { label: string }) {
  return <span className='rounded-full bg-admin-orange-light px-2.5 py-0.5 text-[11px] font-semibold text-admin-orange'>{label}</span>;
}

function SelectBox({
  value,
  onChange,
  active,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  active: boolean;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`min-w-[260px] appearance-none rounded-lg border-[1.5px] bg-no-repeat px-3 py-[9px] pr-9 text-[13px] font-semibold outline-none [background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")] [background-position:right_10px_center] ${
        active
          ? "border-admin-orange bg-admin-orange-light text-admin-orange"
          : "border-admin-border bg-white text-admin-text"
      }`}
    >
      <option value=''>- All Skills -</option>
      {options.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

export default function AdminDashboard() {
  const [page, setPage] = useState<"dashboard" | "candidates" | "credentials">("dashboard");
  const [showMenu, setShowMenu] = useState(false);
  const [dashSkill, setDashSkill] = useState("");
  const [filterGender, setFilterGender] = useState("All");
  const [filterDept, setFilterDept] = useState("All");
  const [filterSkill, setFilterSkill] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60,
  });

  const { data: candidateRows = [] } = useQuery({
    queryKey: ["admin-candidates"],
    queryFn: getAdminCandidates,
    staleTime: 1000 * 60,
  });

  const skills = useMemo(
    () => Array.from(new Set(candidateRows.map((c) => c.skill).filter((skill) => skill && skill !== "Not Attempted"))).sort(),
    [candidateRows],
  );

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(candidateRows.map((c) => c.dept))).sort()],
    [candidateRows],
  );

  const totalPass = candidateRows.filter((c) => c.status === "Pass").length;
  const passRate = candidateRows.length > 0 ? Math.round((totalPass / candidateRows.length) * 100) : 0;

  const filtered = candidateRows.filter((c) => {
    if (filterGender !== "All" && c.gender !== filterGender) return false;
    if (filterDept !== "All" && c.dept !== filterDept) return false;
    if (filterSkill && c.skill !== filterSkill) return false;
    return true;
  });

  const visibleStats = useMemo(() => {
    const grouped = new Map<string, { skill: string; pass: number; fail: number }>();
    for (const row of candidateRows) {
      if (row.skill === "Not Attempted") continue;
      const existing = grouped.get(row.skill) ?? { skill: row.skill, pass: 0, fail: 0 };
      if (row.status === "Pass") existing.pass += 1;
      else if (row.status === "Fail") existing.fail += 1;
      grouped.set(row.skill, existing);
    }

    const values = Array.from(grouped.values());
    return dashSkill ? values.filter((v) => v.skill === dashSkill) : values;
  }, [candidateRows, dashSkill]);

  const passFailPie = [
    { name: "Pass", value: candidateRows.filter((c) => c.status === "Pass").length, color: COLORS.green },
    { name: "Fail", value: candidateRows.filter((c) => c.status === "Fail").length, color: COLORS.red },
  ];

  const skillPie = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of candidateRows) {
      if (row.skill === "Not Attempted") continue;
      grouped.set(row.skill, (grouped.get(row.skill) ?? 0) + 1);
    }

    const palette = ["#f97316", "#14b8a6", "#6366f1", "#eab308", "#94a3b8", "#ef4444", "#22c55e"];
    return Array.from(grouped.entries()).map(([name, value], i) => ({
      name,
      value,
      color: palette[i % palette.length],
    }));
  }, [candidateRows]);

  const availableSkills = filtered
    .map((c) => c.skill)
    .filter((s, i, arr) => s !== "Not Attempted" && arr.indexOf(s) === i)
    .sort();

  const NAV = [
    { path: "/admin/dashboard", label: "Dashboard" },
    { path: "/admin/candidates", label: "Candidates" },
    { path: "/admin/credentials", label: "Credentials" },
  ];

  return (
    <div className='flex h-screen overflow-hidden bg-admin-bg text-admin-text text-[14px]'>
      <Sidebar
        items={NAV}
        active={page}
        onChange={(id: string) => setPage(id as "dashboard" | "candidates" | "credentials")}
      />

      <main className='flex flex-1 flex-col overflow-hidden'>
        <header className='flex h-[52px] shrink-0 items-center justify-between border-b border-admin-border bg-white px-7'>
          <span className='text-[14px] font-semibold text-admin-text-muted'>
            {page === "credentials" ? "Credentials" : page === "dashboard" ? "Dashboard" : "Candidates"}
          </span>
          <div className='relative'>
            <div
              onClick={() => setShowMenu((prev) => !prev)}
              className='grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-admin-orange text-[12px] font-bold text-white'
            >
              AD
            </div>
            {showMenu && (
              <div className='absolute right-0 top-10 z-[100] min-w-[140px] rounded-lg border border-admin-border bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]'>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    void logout();
                  }}
                  className='w-full cursor-pointer border-none bg-transparent px-4 py-2.5 text-left text-[13px] font-semibold text-admin-red'
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <div className='flex-1 overflow-y-auto px-8 py-7'>
          {page === "dashboard" && (
            <>
              <div className='mb-6'>
                <h1 className='m-0 text-[26px] font-bold tracking-[-0.5px]'>
                  <span className='text-admin-orange'>Dashboard</span>
                </h1>
                <p className='mt-1 text-[13px] text-admin-text-muted'>Internal skill assessment overview</p>
              </div>

              <div className='mb-7 flex gap-3.5'>
                <StatCard label='Total Employees' value={stats?.totalEmployees ?? 0} />
                <StatCard label='Assessments Taken' value={stats?.totalAssessments ?? 0} />
                <StatCard label='Pass Rate' value={`${passRate}%`} sub={`${totalPass} passed out of ${candidateRows.length}`} />
                <StatCard label='Pending' value={candidateRows.filter((c) => c.status === "Pending").length} sub='awaiting assessment' />
              </div>

              <div className='mb-6 flex items-end gap-2.5'>
                <div>
                  <div className='mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-admin-text-light'>Filter by Skill</div>
                  <SelectBox value={dashSkill} onChange={setDashSkill} active={dashSkill !== ""} options={skills} />
                </div>
                {dashSkill && (
                  <button
                    onClick={() => setDashSkill("")}
                    className='cursor-pointer rounded-lg border-none bg-admin-red-bg px-3.5 py-[9px] text-[12px] font-bold text-admin-red'
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className='mb-5 grid grid-cols-2 gap-[18px]'>
                <div className='rounded-xl border border-admin-border bg-white px-5 py-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
                  <div className='mb-0.5 text-[15px] font-bold'>Pass / Fail Breakdown</div>
                  <div className='mb-3.5 text-[12px] text-admin-text-muted'>{dashSkill ? `Showing: ${dashSkill}` : "All assessments"}</div>
                  <ResponsiveContainer width='100%' height={210}>
                    <PieChart>
                      <Pie data={passFailPie} dataKey='value' cx='50%' cy='50%' outerRadius={82} innerRadius={50} paddingAngle={4}>
                        {passFailPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
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
                      <Pie data={skillPie} dataKey='value' cx='50%' cy='50%' outerRadius={82} innerRadius={50} paddingAngle={4}>
                        {skillPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(v: unknown) => [Number(v) || 0, "Employees"]} />
                      <Legend iconType='circle' iconSize={9} formatter={(v) => <span className='text-[12px] text-admin-text-muted'>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className='rounded-xl border border-admin-border bg-white px-6 py-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
                <div className='mb-4 text-[15px] font-bold'>Pass / Fail by Skill</div>
                {visibleStats.length === 0 ? (
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
                              style={{
                                /* dynamic — intentionally inline */
                                width: `${pct}%`
                              }}
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
                )}
              </div>
            </>
          )}

          {page === "candidates" && (
            <>
              <div className='mb-6'>
                <h1 className='m-0 text-[26px] font-bold tracking-[-0.5px]'>
                  <span className='text-admin-orange'>Candidate</span> Management
                </h1>
                <p className='mt-1 text-[13px] text-admin-text-muted'>
                  {filtered.length} employee{filtered.length !== 1 ? "s" : ""} shown
                </p>
              </div>

              <div className='mb-[18px] rounded-xl border border-admin-border bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
                <div className='mb-[18px] flex flex-wrap gap-8'>
                  <div>
                    <div className='mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-admin-text-light'>Gender</div>
                    <div className='flex gap-1.5'>
                      {["All", "Male", "Female"].map((g) => (
                        <FilterBtn key={g} label={g} active={filterGender === g} onClick={() => { setFilterGender(g); setFilterSkill(""); }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className='mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-admin-text-light'>Department</div>
                    <div className='flex flex-wrap gap-1.5'>
                      {departments.map((d) => (
                        <FilterBtn key={d} label={d} active={filterDept === d} onClick={() => { setFilterDept(d); setFilterSkill(""); }} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className='flex items-end gap-2.5'>
                  <div>
                    <div className='mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-admin-text-light'>Skill</div>
                    <SelectBox value={filterSkill} onChange={setFilterSkill} active={filterSkill !== ""} options={availableSkills} />
                  </div>
                  {filterSkill && (
                    <button
                      onClick={() => setFilterSkill("")}
                      className='cursor-pointer rounded-lg border-none bg-admin-red-bg px-3.5 py-[9px] text-[12px] font-bold text-admin-red'
                    >
                      Clear
                    </button>
                  )}
                </div>

                {(filterGender !== "All" || filterDept !== "All" || filterSkill) && (
                  <div className='mt-3.5 flex flex-wrap items-center gap-2'>
                    <span className='text-[11px] font-semibold text-admin-text-light'>Active filters:</span>
                    {filterGender !== "All" && <ActiveTag label={filterGender} />}
                    {filterDept !== "All" && <ActiveTag label={filterDept} />}
                    {filterSkill && <ActiveTag label={filterSkill} />}
                    <button
                      onClick={() => { setFilterGender("All"); setFilterDept("All"); setFilterSkill(""); }}
                      className='cursor-pointer border-none bg-transparent p-0 text-[11px] font-bold text-admin-red'
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              <div className='overflow-hidden rounded-xl border border-admin-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
                <table className='w-full border-collapse'>
                  <thead>
                    <tr className='bg-admin-bg'>
                      {["Employee", "Gender", "Department", "Skill Tested", "Score", "Result"].map((h) => (
                        <th key={h} className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className='px-[18px] py-12 text-center text-[13px] text-admin-text-light'>
                          No employees match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((c: AdminCandidate, i) => (
                        <tr key={`${c.user_id}-${i}`} className='border-b border-slate-100 hover:bg-admin-bg'>
                          <td className='px-[18px] py-3'>
                            <div className='flex items-center gap-2.5'>
                              <div className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-admin-orange-light text-[11px] font-extrabold text-admin-orange'>
                                {c.name.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}
                              </div>
                              <span className='text-[13px] font-semibold'>{c.name}</span>
                            </div>
                          </td>
                          <td className='px-[18px] py-3 text-[13px] text-admin-text-muted'>{c.gender}</td>
                          <td className='px-[18px] py-3 text-[13px] text-admin-text-muted'>{c.dept}</td>
                          <td className='px-[18px] py-3'>
                            <span className='rounded-md bg-admin-orange-light px-2.5 py-0.5 text-[12px] font-semibold text-admin-orange'>{c.skill}</span>
                          </td>
                          <td className='px-[18px] py-3'>
                            <div className='flex items-center gap-2'>
                              <div className='h-[5px] w-[52px] overflow-hidden rounded-full bg-gray-100'>
                                <div
                                  className={`h-full rounded-full ${c.score >= 60 ? "bg-admin-green" : "bg-admin-red"}`}
                                  style={{
                                    /* dynamic — intentionally inline */
                                    width: `${c.score}%`
                                  }}
                                />
                              </div>
                              <span className='text-[13px] font-bold text-admin-text'>{c.score}</span>
                            </div>
                          </td>
                          <td className='px-[18px] py-3'>
                            <span
                              className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${
                                c.status === "Pass"
                                  ? "bg-admin-green-bg text-admin-green"
                                  : "bg-admin-red-bg text-admin-red"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {page === "credentials" && <CredentialsPage />}
        </div>
      </main>
    </div>
  );
}
