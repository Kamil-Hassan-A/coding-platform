import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LogOut } from "lucide-react";

import { logout } from "../auth/authService";
import Sidebar from "../../components/layout/Sidebar";
import SessionDownloadModal from "../../components/SessionDownloadModal";
import { downloadBlob } from "../../api/axiosInstance";
import useUserStore from "../../stores/userStore";
import { getAdminCandidates, getDashboardStats, type AdminCandidate } from "./dashboardService";

type SortField = "score" | "submittedAt";
type SortDirection = "asc" | "desc";

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
  const [page, setPage] = useState<"dashboard" | "candidates">("dashboard");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [dashSkill, setDashSkill] = useState("");
  const [filterGender, setFilterGender] = useState("All");
  const [filterDept, setFilterDept] = useState("All");
  const [filterSkill, setFilterSkill] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [yearsMin, setYearsMin] = useState<number | null>(null);
  const [yearsMax, setYearsMax] = useState<number | null>(null);
  const [experienceMin, setExperienceMin] = useState<number | null>(null);
  const [experienceMax, setExperienceMax] = useState<number | null>(null);
  const [sessionModalCandidateId, setSessionModalCandidateId] = useState<string | null>(null);
  const [sessionModalMode, setSessionModalMode] = useState<"pdf" | "csv">("pdf");
  const [sortField, setSortField] = useState<SortField>("submittedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [activeDownloadKey, setActiveDownloadKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const user = useUserStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedYearsRange = useMemo(() => {
    if (yearsMin === null || yearsMax === null) {
      return { min: yearsMin, max: yearsMax };
    }
    return yearsMin <= yearsMax
      ? { min: yearsMin, max: yearsMax }
      : { min: yearsMax, max: yearsMin };
  }, [yearsMax, yearsMin]);

  const normalizedExperienceRange = useMemo(() => {
    if (experienceMin === null || experienceMax === null) {
      return { min: experienceMin, max: experienceMax };
    }
    return experienceMin <= experienceMax
      ? { min: experienceMin, max: experienceMax }
      : { min: experienceMax, max: experienceMin };
  }, [experienceMax, experienceMin]);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60,
  });

  const candidateApiFilters = useMemo(
    () =>
      page === "candidates"
        ? {
            employeeId,
            yearsMin: normalizedYearsRange.min,
            yearsMax: normalizedYearsRange.max,
            experienceMin: normalizedExperienceRange.min,
            experienceMax: normalizedExperienceRange.max,
          }
        : undefined,
    [employeeId, normalizedExperienceRange.max, normalizedExperienceRange.min, normalizedYearsRange.max, normalizedYearsRange.min, page],
  );

  const { data: candidateRows = [] } = useQuery({
    queryKey: ["admin-candidates", candidateApiFilters],
    queryFn: () => getAdminCandidates(candidateApiFilters),
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

  const filtered = useMemo(() => candidateRows.filter((c) => {
    const candidateEmployeeId = String(c.employeeId ?? c.employee_id ?? c.user_id ?? "").toLowerCase();
    const yearsWithCompany = (
      typeof c.expIndium === "number"
        ? c.expIndium
        : typeof c.exp_indium_years === "number"
          ? c.exp_indium_years
          : 0
    ) ?? 0;
    const overallExperience = (
      typeof c.expOverall === "number"
        ? c.expOverall
        : typeof c.exp_overall_years === "number"
          ? c.exp_overall_years
          : 0
    ) ?? 0;

    if (filterGender !== "All" && c.gender !== filterGender) return false;
    if (filterDept !== "All" && c.dept !== filterDept) return false;
    if (filterSkill && c.skill !== filterSkill) return false;
    if (employeeId.trim() && !candidateEmployeeId.includes(employeeId.trim().toLowerCase())) return false;

    if (normalizedYearsRange.min !== null && yearsWithCompany < normalizedYearsRange.min) return false;
    if (normalizedYearsRange.max !== null && yearsWithCompany > normalizedYearsRange.max) return false;
    if (normalizedExperienceRange.min !== null && overallExperience < normalizedExperienceRange.min) return false;
    if (normalizedExperienceRange.max !== null && overallExperience > normalizedExperienceRange.max) return false;
    return true;
  }), [candidateRows, employeeId, filterDept, filterGender, filterSkill, normalizedExperienceRange.max, normalizedExperienceRange.min, normalizedYearsRange.max, normalizedYearsRange.min]);

  const hasFilters =
    filterGender !== "All" ||
    filterDept !== "All" ||
    Boolean(filterSkill) ||
    Boolean(employeeId) ||
    yearsMin !== null ||
    yearsMax !== null ||
    experienceMin !== null ||
    experienceMax !== null;

  const sortedFiltered = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortField === "score") {
        return sortDirection === "asc" ? a.score - b.score : b.score - a.score;
      }

      const aTime = a.latest_submitted_at ? new Date(a.latest_submitted_at).getTime() : 0;
      const bTime = b.latest_submitted_at ? new Date(b.latest_submitted_at).getTime() : 0;
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
    return rows;
  }, [filtered, sortDirection, sortField]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "submittedAt" ? "desc" : "asc");
  };

  const formatSubmittedAt = (value?: string | null): string => {
    if (!value) {
      return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString();
  };

  const resetCandidateFilters = () => {
    setFilterGender("All");
    setFilterDept("All");
    setFilterSkill("");
    setEmployeeId("");
    setYearsMin(null);
    setYearsMax(null);
    setExperienceMin(null);
    setExperienceMax(null);
  };

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
    { id: "dashboard", label: "Dashboard" },
    { id: "candidates", label: "Candidates" },
  ];

  const runDownload = (
    key: string,
    action: () => Promise<void>,
  ) => {
    setActiveDownloadKey(key);
    setDownloadError(null);
    setRetryAction(null);

    void action()
      .catch((error: unknown) => {
        console.error("Download failed", error);
        setDownloadError("Download failed. Please try again.");
        setRetryAction(() => () => runDownload(key, action));
      })
      .finally(() => {
        setActiveDownloadKey((current) => (current === key ? null : current));
      });
  };

  const buildExportCsvUrl = (mode: "latest" | "all", includeFilters: boolean): string => {
    const baseUrl = `${import.meta.env.VITE_API_BASE_URL}/admin/export/candidates-csv`;
    const params = new URLSearchParams({ mode });

    if (includeFilters) {
      if (filterSkill) {
        params.set("skill", filterSkill);
      }
      if (filterGender !== "All") {
        params.set("gender", filterGender);
      }
      if (filterDept !== "All") {
        params.set("department", filterDept);
      }
    }

    return `${baseUrl}?${params.toString()}`;
  };

  const handleExportCsv = (mode: "latest" | "all", includeFilters: boolean) => {
    if (includeFilters && !hasFilters) {
      setDownloadError("Apply at least one filter to export the current view.");
      setRetryAction(null);
      setIsExportDropdownOpen(false);
      return;
    }

    if (includeFilters && sortedFiltered.length === 0) {
      setDownloadError("No data available for selected filters.");
      setRetryAction(null);
      setIsExportDropdownOpen(false);
      return;
    }

    const key = includeFilters ? `export-${mode}-filtered` : `export-${mode}`;
    const url = buildExportCsvUrl(mode, includeFilters);
    const filename = `candidates_${mode}.csv`;
    runDownload(key, () => downloadBlob(url, filename));
    setIsExportDropdownOpen(false);
  };

  const handleOpenPdfReport = (candidateId: string) => {
    runDownload(
      `candidate-pdf-${candidateId}`,
      () => downloadBlob(
        `${import.meta.env.VITE_API_BASE_URL}/admin/candidate-report/${candidateId}/pdf`,
        `${candidateId}_report.pdf`,
      ),
    );
  };

  const handleOpenTestPdfReport = (candidate: AdminCandidate) => {
    setSessionModalMode("pdf");
    setSessionModalCandidateId(candidate.user_id);
  };

  const handleSessionCsvDownload = (candidate: AdminCandidate) => {
    setSessionModalMode("csv");
    setSessionModalCandidateId(candidate.user_id);
  };

  return (
    <div className='flex h-screen overflow-hidden bg-admin-bg text-admin-text text-[14px]'>
      <Sidebar
        items={NAV}
        active={page}
        onChange={(id) => {
          setPage(id as "dashboard" | "candidates");
          setIsDropdownOpen(false);
        }}
      />

      <main className='flex flex-1 flex-col overflow-hidden'>
        <header className='flex h-[52px] shrink-0 items-center justify-between border-b border-admin-border bg-white px-7'>
          <span className='text-[14px] font-semibold text-admin-text-muted'>
            {page === "dashboard" ? "Dashboard" : "Candidates"}
          </span>
          <div className='relative' ref={menuRef}>
            <div
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              role='button'
              tabIndex={0}
              aria-label='Open profile menu'
              aria-expanded={isDropdownOpen}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsDropdownOpen((prev) => !prev);
                }
                if (event.key === "Escape") {
                  setIsDropdownOpen(false);
                }
              }}
              className='flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-admin-orange text-[16px] font-bold text-white'
            >
              {(user?.name?.trim()?.[0] || "A").toUpperCase()}
            </div>

            <div
              className={`absolute right-0 top-12 z-[100] w-60 origin-top-right overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] will-change-transform transition-all duration-150 ease-out ${
                isDropdownOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
              }`}
              aria-hidden={!isDropdownOpen}
            >
              <div className='border-b border-slate-200 px-5 py-4'>
                <p className='m-0 text-[14px] font-semibold text-[#111]'>
                  {user?.name || "Platform Admin"}
                </p>
                <p className='mt-0.5 text-[12px] text-slate-500'>
                  {user?.department || "Admin"}
                </p>
              </div>
              <div
                onClick={() => {
                  setIsDropdownOpen(false);
                  void logout();
                }}
                role='button'
                tabIndex={0}
                aria-label='Sign out'
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setIsDropdownOpen(false);
                    void logout();
                  }
                }}
                className='flex cursor-pointer items-center gap-3 px-5 py-3 text-[14px] text-red-600'
              >
                <LogOut size={16} /> Sign Out
              </div>
            </div>
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

                <div className='mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]'>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-[12px] font-semibold text-gray-600'>Employee ID</label>
                    <input
                      className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder='e.g. IND-1042'
                    />
                  </div>

                  <div className='flex flex-col gap-1.5'>
                    <label className='text-[12px] font-semibold text-gray-600'>Years with Company (Min - Max)</label>
                    <div className='flex gap-2'>
                      <input
                        type='number'
                        min='0'
                        className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
                        value={yearsMin ?? ""}
                        onChange={(e) => setYearsMin(e.target.value === "" ? null : Number(e.target.value))}
                        placeholder='Min'
                      />
                      <input
                        type='number'
                        min='0'
                        className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
                        value={yearsMax ?? ""}
                        onChange={(e) => setYearsMax(e.target.value === "" ? null : Number(e.target.value))}
                        placeholder='Max'
                      />
                    </div>
                  </div>

                  <div className='flex flex-col gap-1.5'>
                    <label className='text-[12px] font-semibold text-gray-600'>Overall Experience (Min - Max)</label>
                    <div className='flex gap-2'>
                      <input
                        type='number'
                        min='0'
                        className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
                        value={experienceMin ?? ""}
                        onChange={(e) => setExperienceMin(e.target.value === "" ? null : Number(e.target.value))}
                        placeholder='Min'
                      />
                      <input
                        type='number'
                        min='0'
                        className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
                        value={experienceMax ?? ""}
                        onChange={(e) => setExperienceMax(e.target.value === "" ? null : Number(e.target.value))}
                        placeholder='Max'
                      />
                    </div>
                  </div>
                </div>

                {hasFilters && (
                  <div className='mt-3.5 flex flex-wrap items-center gap-2'>
                    <span className='text-[11px] font-semibold text-admin-text-light'>Active filters:</span>
                    {filterGender !== "All" && <ActiveTag label={filterGender} />}
                    {filterDept !== "All" && <ActiveTag label={filterDept} />}
                    {filterSkill && <ActiveTag label={filterSkill} />}
                    {employeeId && <ActiveTag label={`Employee ID: ${employeeId}`} />}
                    {yearsMin !== null && <ActiveTag label={`Years Min: ${yearsMin}`} />}
                    {yearsMax !== null && <ActiveTag label={`Years Max: ${yearsMax}`} />}
                    {experienceMin !== null && <ActiveTag label={`Exp Min: ${experienceMin}`} />}
                    {experienceMax !== null && <ActiveTag label={`Exp Max: ${experienceMax}`} />}
                    <button
                      onClick={resetCandidateFilters}
                      className='cursor-pointer border-none bg-transparent p-0 text-[11px] font-bold text-admin-red'
                    >
                      Reset
                    </button>
                  </div>
                )}

                <div className='mt-4 flex justify-end'>
                  <div className='relative' ref={exportMenuRef}>
                    <button
                      onClick={() => setIsExportDropdownOpen((prev) => !prev)}
                      disabled={activeDownloadKey?.startsWith("export-")}
                      className='cursor-pointer border-none bg-[#16a34a] px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px] disabled:cursor-not-allowed disabled:opacity-70'
                    >
                      {activeDownloadKey?.startsWith("export-") ? "Exporting..." : "Export CSV ▼"}
                    </button>

                    {isExportDropdownOpen && (
                      <div className='absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-admin-border bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]'>
                        <button
                          onClick={() => handleExportCsv("latest", false)}
                          className='block w-full cursor-pointer border-none bg-white px-3 py-2 text-left text-[12px] font-semibold text-admin-text hover:bg-admin-bg'
                        >
                          Latest Sessions
                        </button>
                        <button
                          onClick={() => handleExportCsv("all", false)}
                          className='block w-full cursor-pointer border-none bg-white px-3 py-2 text-left text-[12px] font-semibold text-admin-text hover:bg-admin-bg'
                        >
                          All Sessions
                        </button>
                        <button
                          onClick={() => handleExportCsv("latest", true)}
                          disabled={!hasFilters}
                          className='block w-full border-none bg-white px-3 py-2 text-left text-[12px] font-semibold text-admin-text hover:bg-admin-bg disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          Current View
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {downloadError && (
                <div className='mb-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[12px] text-[#991b1b]'>
                  <span>{downloadError}</span>
                  {retryAction && (
                    <button
                      onClick={() => retryAction()}
                      className='ml-3 cursor-pointer rounded-[6px] border-none bg-[#dc2626] px-2 py-1 text-[11px] font-semibold text-white'
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              <div className='overflow-hidden rounded-xl border border-admin-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
                <table className='w-full border-collapse'>
                  <thead>
                    <tr className='bg-admin-bg'>
                      <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Employee</th>
                      <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Gender</th>
                      <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Department</th>
                      <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Skill Tested</th>
                      <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>
                        <button
                          onClick={() => toggleSort("score")}
                          className='cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'
                        >
                          Score {sortField === "score" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                        </button>
                      </th>
                      <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>
                        <button
                          onClick={() => toggleSort("submittedAt")}
                          className='cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'
                        >
                          Date {sortField === "submittedAt" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                        </button>
                      </th>
                      <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Result</th>
                      <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className='px-[18px] py-12 text-center text-[13px] text-admin-text-light'>
                          No employees match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      sortedFiltered.map((c: AdminCandidate, i) => (
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
                          <td className='px-[18px] py-3 text-[12px] text-admin-text-muted'>{formatSubmittedAt(c.latest_submitted_at)}</td>
                          <td className='px-[18px] py-3'>
                            <span
                              className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${
                                c.status === "Pass"
                                  ? "bg-admin-green-bg text-admin-green"
                                  : c.status === "Pending"
                                    ? "bg-[#fef3c7] text-[#b45309]"
                                    : "bg-admin-red-bg text-admin-red"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className='px-[18px] py-3'>
                            <div className='flex items-center gap-2'>
                              <button
                                onClick={() => handleOpenPdfReport(c.user_id)}
                                disabled={activeDownloadKey === `candidate-pdf-${c.user_id}`}
                                className='cursor-pointer border-none bg-[#dc2626] px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px] disabled:cursor-not-allowed disabled:opacity-70'
                              >
                                {activeDownloadKey === `candidate-pdf-${c.user_id}` ? "Downloading..." : "PDF"}
                              </button>
                              <button
                                onClick={() => handleOpenTestPdfReport(c)}
                                title='Download report for a specific session'
                                className='cursor-pointer border-none bg-[#dc2626] px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px]'
                              >
                                Session Report
                              </button>
                              <button
                                onClick={() => handleSessionCsvDownload(c)}
                                title='Select a session and download CSV'
                                className='cursor-pointer border-none bg-[#16a34a] px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px] disabled:cursor-not-allowed disabled:opacity-70'
                              >
                                Session CSV
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      <SessionDownloadModal
        isOpen={sessionModalCandidateId !== null}
        onClose={() => setSessionModalCandidateId(null)}
        userId={sessionModalCandidateId ?? ""}
        mode={sessionModalMode}
      />
    </div>
  );
}
