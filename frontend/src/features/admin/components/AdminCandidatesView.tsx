import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import { downloadBlob } from "../../../api/axiosInstance";
import { getAdminCandidates } from "../dashboardService";
import type { AdminCandidate } from "../types/admin";

type SortField = "score" | "submittedAt";
type SortDirection = "asc" | "desc";

const normalizeRange = (min: number | null, max: number | null) => {
  if (min === null || max === null) return { min, max };
  return min <= max ? { min, max } : { min: max, max: min };
};

const formatSubmittedAt = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

// ── Small presentational pieces ─────────────────────────────────────────────

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type='button'
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

function SkillSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`min-w-[260px] appearance-none rounded-lg border-[1.5px] bg-no-repeat px-3 py-[9px] pr-9 text-[13px] font-semibold outline-none [background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")] [background-position:right_10px_center] ${
        value
          ? "border-admin-orange bg-admin-orange-light text-admin-orange"
          : "border-admin-border bg-white text-admin-text"
      }`}
    >
      <option value=''>- All Skills -</option>
      {options.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

type CandidateGroup = {
  user_id: string;
  name: string;
  gender: string;
  dept: string;
  assessments: AdminCandidate[];
};

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminCandidatesView() {
  // Filter state
  const [filterGender, setFilterGender] = useState("All");
  const [filterDept, setFilterDept] = useState("All");
  const [filterSkill, setFilterSkill] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [yearsMin, setYearsMin] = useState<number | null>(null);
  const [yearsMax, setYearsMax] = useState<number | null>(null);
  const [experienceMin, setExperienceMin] = useState<number | null>(null);
  const [experienceMax, setExperienceMax] = useState<number | null>(null);

  // Sort & UI state
  const [sortField, setSortField] = useState<SortField>("submittedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Download / export state
  const [activeDownloadKey, setActiveDownloadKey] = useState<string | null>(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Normalised ranges (swap min/max if user enters them backwards) ──────────

  const normalizedYears = useMemo(() => normalizeRange(yearsMin, yearsMax), [yearsMin, yearsMax]);
  const normalizedExp = useMemo(() => normalizeRange(experienceMin, experienceMax), [experienceMin, experienceMax]);

  // ── Server-side filters (only what the API supports) ──────────────────────

  const apiFilters = useMemo(() => ({
    employeeId,
    yearsMin: normalizedYears.min,
    yearsMax: normalizedYears.max,
    experienceMin: normalizedExp.min,
    experienceMax: normalizedExp.max,
  }), [employeeId, normalizedYears, normalizedExp]);

  const { data: candidateRows = [] } = useQuery({
    queryKey: ["admin-candidates", apiFilters],
    queryFn: () => getAdminCandidates(apiFilters),
    staleTime: 1000 * 60,
  });

  // ── Client-side filtering ─────────────────────────────────────────────────

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(candidateRows.map((c) => c.dept))).sort()],
    [candidateRows],
  );

  // Pre-skill filter: used to populate the skill dropdown so it always shows
  // all skills available for the current gender/dept, not just the selected one.
  const filteredByGenderDept = useMemo(() =>
    candidateRows.filter((c) => {
      if (filterGender !== "All" && c.gender !== filterGender) return false;
      if (filterDept !== "All" && c.dept !== filterDept) return false;
      return true;
    }),
    [candidateRows, filterDept, filterGender],
  );

  const filtered = useMemo(() =>
    filteredByGenderDept.filter((c) => {
      if (filterSkill && c.skill !== filterSkill) return false;
      return true;
    }),
    [filteredByGenderDept, filterSkill],
  );

  const availableSkills = useMemo(
    () => filteredByGenderDept.map((c) => c.skill).filter((s, i, arr) => s !== "Not Attempted" && arr.indexOf(s) === i).sort(),
    [filteredByGenderDept],
  );

  const hasFilters =
    filterGender !== "All" || filterDept !== "All" || Boolean(filterSkill) ||
    Boolean(employeeId) || yearsMin !== null || yearsMax !== null ||
    experienceMin !== null || experienceMax !== null;

  // ── Sorting ───────────────────────────────────────────────────────────────

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

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groupedCandidates = useMemo(() => {
    const groups = new Map<string, CandidateGroup>();
    // Because sortedFiltered is already sorted by date or score, 
    // iterating it in order guarantees that the candidate groups 
    // will be inserted into the map ordered by their "best" or "latest" matching assessment.
    for (const c of sortedFiltered) {
      if (!groups.has(c.user_id)) {
        groups.set(c.user_id, {
          user_id: c.user_id,
          name: c.name,
          gender: c.gender,
          dept: c.dept,
          assessments: [],
        });
      }
      groups.get(c.user_id)!.assessments.push(c);
    }
    return Array.from(groups.values());
  }, [sortedFiltered]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const toggleExpand = (userId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const resetFilters = () => {
    setFilterGender("All");
    setFilterDept("All");
    setFilterSkill("");
    setEmployeeId("");
    setYearsMin(null);
    setYearsMax(null);
    setExperienceMin(null);
    setExperienceMax(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) { setSortDirection((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortField(field);
    setSortDirection(field === "submittedAt" ? "desc" : "asc");
  };

  const runDownload = (key: string, action: () => Promise<void>) => {
    setActiveDownloadKey(key);
    setDownloadError(null);
    setRetryAction(null);
    void action()
      .catch((err: unknown) => {
        console.error("Download failed", err);
        setDownloadError("Download failed. Please try again.");
        setRetryAction(() => () => runDownload(key, action));
      })
      .finally(() => {
        setActiveDownloadKey((cur) => (cur === key ? null : cur));
      });
  };

  const buildExportUrl = (mode: "latest" | "all", includeFilters: boolean) => {
    const base = `/admin/export/candidates-csv`;
    const params = new URLSearchParams({ mode });
    if (includeFilters) {
      if (filterSkill) params.set("skill", filterSkill);
      if (filterGender !== "All") params.set("gender", filterGender);
      if (filterDept !== "All") params.set("department", filterDept);
    }
    return `${base}?${params.toString()}`;
  };

  const handleExportCsv = (mode: "latest" | "all", includeFilters: boolean) => {
    if (includeFilters && !hasFilters) {
      setDownloadError("Apply at least one filter to export the current view.");
      setIsExportDropdownOpen(false);
      return;
    }
    if (includeFilters && sortedFiltered.length === 0) {
      setDownloadError("No data available for selected filters.");
      setIsExportDropdownOpen(false);
      return;
    }
    const key = includeFilters ? `export-${mode}-filtered` : `export-${mode}`;
    runDownload(key, () => downloadBlob(buildExportUrl(mode, includeFilters), `candidates_${mode}.csv`));
    setIsExportDropdownOpen(false);
  };

  const handleFullPdf = (e: React.MouseEvent, candidateId: string) => {
    e.stopPropagation(); // prevent row expand
    runDownload(
      `full-pdf-${candidateId}`,
      () => downloadBlob(
        `/admin/candidate-report/${candidateId}/pdf`,
        `${candidateId}_full_report.pdf`,
      ),
    );
  };

  const handleSessionPdf = (e: React.MouseEvent, candidate: AdminCandidate) => {
    e.stopPropagation();
    if (!candidate.latest_session_id) return;
    runDownload(
      `session-pdf-${candidate.latest_session_id}`,
      () => downloadBlob(
        `/admin/candidate-report/${candidate.user_id}/session/${candidate.latest_session_id}/pdf`,
        `session_${candidate.latest_session_id}_report.pdf`,
      ),
    );
  };

  const handleSessionCsv = (e: React.MouseEvent, candidate: AdminCandidate) => {
    e.stopPropagation();
    if (!candidate.latest_session_id) return;
    runDownload(
      `session-csv-${candidate.latest_session_id}`,
      () => downloadBlob(
        `/admin/session-report/${candidate.latest_session_id}/csv?type=detailed`,
        `session_${candidate.latest_session_id}.csv`,
      ),
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className='mb-6'>
        <h1 className='m-0 text-[26px] font-bold tracking-[-0.5px]'>
          <span className='text-admin-orange'>Candidate</span> Management
        </h1>
        <p className='mt-1 text-[13px] text-admin-text-muted'>
          {groupedCandidates.length} employee{groupedCandidates.length !== 1 ? "s" : ""} shown across {sortedFiltered.length} assessment record{sortedFiltered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters panel */}
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
            <SkillSelect value={filterSkill} onChange={setFilterSkill} options={availableSkills} />
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
              <input type='number' min='0' placeholder='Min' className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none' value={yearsMin ?? ""} onChange={(e) => setYearsMin(e.target.value === "" ? null : Number(e.target.value))} />
              <input type='number' min='0' placeholder='Max' className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none' value={yearsMax ?? ""} onChange={(e) => setYearsMax(e.target.value === "" ? null : Number(e.target.value))} />
            </div>
          </div>
          <div className='flex flex-col gap-1.5'>
            <label className='text-[12px] font-semibold text-gray-600'>Overall Experience (Min - Max)</label>
            <div className='flex gap-2'>
              <input type='number' min='0' placeholder='Min' className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none' value={experienceMin ?? ""} onChange={(e) => setExperienceMin(e.target.value === "" ? null : Number(e.target.value))} />
              <input type='number' min='0' placeholder='Max' className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none' value={experienceMax ?? ""} onChange={(e) => setExperienceMax(e.target.value === "" ? null : Number(e.target.value))} />
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
            <button onClick={resetFilters} className='cursor-pointer border-none bg-transparent p-0 text-[11px] font-bold text-admin-red'>
              Reset
            </button>
          </div>
        )}

        <div className='mt-4 flex justify-end'>
          <div className='relative' ref={exportMenuRef}>
            <button
              onClick={() => setIsExportDropdownOpen((p) => !p)}
              disabled={activeDownloadKey?.startsWith("export-")}
              className='cursor-pointer border-none bg-[#16a34a] px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px] disabled:cursor-not-allowed disabled:opacity-70'
            >
              {activeDownloadKey?.startsWith("export-") ? "Exporting..." : "Export CSV ▼"}
            </button>
            {isExportDropdownOpen && (
              <div className='absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-admin-border bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]'>
                <button onClick={() => handleExportCsv("latest", false)} className='block w-full cursor-pointer border-none bg-white px-3 py-2 text-left text-[12px] font-semibold text-admin-text hover:bg-admin-bg'>Latest Sessions</button>
                <button onClick={() => handleExportCsv("all", false)} className='block w-full cursor-pointer border-none bg-white px-3 py-2 text-left text-[12px] font-semibold text-admin-text hover:bg-admin-bg'>All Sessions</button>
                <button onClick={() => handleExportCsv("latest", true)} disabled={!hasFilters} className='block w-full border-none bg-white px-3 py-2 text-left text-[12px] font-semibold text-admin-text hover:bg-admin-bg disabled:cursor-not-allowed disabled:opacity-60'>Current View</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Download error banner */}
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

      {/* Expandable Candidates table */}
      <div className='overflow-hidden rounded-xl border border-admin-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
        <table className='w-full border-collapse'>
          <thead>
            <tr className='bg-admin-bg'>
              <th className='w-10 border-b border-admin-border px-4 py-[11px]'></th>
              {["Employee", "Gender", "Department", "Assessments Taken"].map((h) => (
                <th key={h} className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>{h}</th>
              ))}
              <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>
                <button onClick={() => toggleSort("score")} className='cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light hover:text-admin-orange'>
                  Top Score {sortField === "score" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                </button>
              </th>
              <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>
                <button onClick={() => toggleSort("submittedAt")} className='cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light hover:text-admin-orange'>
                  Date {sortField === "submittedAt" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                </button>
              </th>
              <th className='border-b border-admin-border px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>
                Report
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedCandidates.length === 0 ? (
              <tr>
                <td colSpan={8} className='px-[18px] py-12 text-center text-[13px] text-admin-text-light'>
                  No employees match the selected filters.
                </td>
              </tr>
            ) : (
              groupedCandidates.map((group) => {
                const isExpanded = expandedRows.has(group.user_id);
                // "Top Score" and "Date" at the master row level just represent the best/latest out of the visible filtered assessments.
                // We grab the first assessment since the array was grouped from `sortedFiltered`
                const bestAssessment = group.assessments[0]; 

                return (
                  <Fragment key={group.user_id}>
                    {/* Master Row */}
                    <tr 
                      className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${isExpanded ? "bg-slate-50" : ""}`}
                      onClick={() => toggleExpand(group.user_id)}
                    >
                      <td className='px-4 py-3 text-admin-text-muted'>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </td>
                      <td className='px-[18px] py-3'>
                        <div className='flex items-center gap-2.5'>
                          <div className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-admin-orange-light text-[11px] font-extrabold text-admin-orange'>
                            {group.name.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}
                          </div>
                          <span className='text-[13px] font-semibold text-admin-text'>{group.name}</span>
                        </div>
                      </td>
                      <td className='px-[18px] py-3 text-[13px] text-admin-text-muted'>{group.gender}</td>
                      <td className='px-[18px] py-3 text-[13px] text-admin-text-muted'>{group.dept}</td>
                      <td className='px-[18px] py-3'>
                        <span className='inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-bold text-slate-600'>
                          {group.assessments.length} Attempt{group.assessments.length > 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className='px-[18px] py-3'>
                        <span className='text-[13px] font-bold text-admin-text'>{bestAssessment.score}</span>
                      </td>
                      <td className='px-[18px] py-3 text-[12px] text-admin-text-muted'>{formatSubmittedAt(bestAssessment.latest_submitted_at)}</td>
                      <td className='px-[18px] py-3'>
                        <button
                          onClick={(e) => handleFullPdf(e, group.user_id)}
                          disabled={activeDownloadKey === `full-pdf-${group.user_id}`}
                          title='Download full candidate history'
                          className='cursor-pointer border-none bg-slate-600 px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px] disabled:cursor-not-allowed disabled:opacity-70'
                        >
                          {activeDownloadKey === `full-pdf-${group.user_id}` ? "..." : "Full Profile"}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Sub-Table */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className='bg-slate-50 p-0'>
                          <div className='animate-slide-down border-b border-slate-200 bg-white shadow-inner'>
                            <table className='w-full border-collapse'>
                              <thead className='bg-slate-50'>
                                <tr>
                                  <th className='w-14 pl-[60px] py-2 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Skill</th>
                                  <th className='px-[18px] py-2 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Score</th>
                                  <th className='px-[18px] py-2 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Date</th>
                                  <th className='px-[18px] py-2 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Result</th>
                                  <th className='px-[18px] py-2 text-left text-[10px] font-bold uppercase tracking-[1px] text-admin-text-light'>Session Downloads</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.assessments.map((a, j) => (
                                  <tr key={`${a.latest_session_id || j}`} className='border-t border-slate-100 hover:bg-slate-50'>
                                    <td className='pl-[60px] py-2.5'>
                                      <span className='rounded-md bg-admin-orange-light px-2.5 py-0.5 text-[12px] font-semibold text-admin-orange'>
                                        {a.skill}
                                      </span>
                                    </td>
                                    <td className='px-[18px] py-2.5'>
                                      <div className='flex items-center gap-2'>
                                        <div className='h-[5px] w-[52px] overflow-hidden rounded-full bg-gray-100'>
                                          <div
                                            className={`h-full rounded-full ${a.score >= 60 ? "bg-admin-green" : "bg-admin-red"}`}
                                            style={{ width: `${a.score}%` }}
                                          />
                                        </div>
                                        <span className='text-[13px] font-bold text-admin-text'>{a.score}</span>
                                      </div>
                                    </td>
                                    <td className='px-[18px] py-2.5 text-[12px] text-admin-text-muted'>{formatSubmittedAt(a.latest_submitted_at)}</td>
                                    <td className='px-[18px] py-2.5'>
                                      <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${
                                        a.status === "Pass"
                                          ? "bg-admin-green-bg text-admin-green"
                                          : a.status === "Pending"
                                            ? "bg-[#fef3c7] text-[#b45309]"
                                            : "bg-admin-red-bg text-admin-red"
                                      }`}>
                                        {a.status}
                                      </span>
                                    </td>
                                    <td className='px-[18px] py-2.5'>
                                      <div className='flex items-center gap-2'>
                                        <button
                                          onClick={(e) => handleSessionPdf(e, a)}
                                          disabled={!a.latest_session_id || activeDownloadKey === `session-pdf-${a.latest_session_id}`}
                                          title='Download PDF for this specific assessment'
                                          className='cursor-pointer border-none bg-[#dc2626] px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px] disabled:cursor-not-allowed disabled:opacity-70'
                                        >
                                          {activeDownloadKey === `session-pdf-${a.latest_session_id}` ? "..." : "PDF"}
                                        </button>
                                        <button
                                          onClick={(e) => handleSessionCsv(e, a)}
                                          disabled={!a.latest_session_id || activeDownloadKey === `session-csv-${a.latest_session_id}`}
                                          title='Download CSV for this specific assessment'
                                          className='cursor-pointer border-none bg-[#16a34a] px-[10px] py-[3px] text-[11px] font-semibold text-white rounded-[6px] disabled:cursor-not-allowed disabled:opacity-70'
                                        >
                                          {activeDownloadKey === `session-csv-${a.latest_session_id}` ? "..." : "CSV"}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
