import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAdminCredentials } from "./dashboardService";
import type { SortKey, SortOrder } from "./types/admin";

const DEPARTMENTS = ["All", "Engineering", "Data", "Design", "QA", "HR", "Sales", "Product"];

export default function CredentialsPage() {
  const [empIdFilter, setEmpIdFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [expIndiumMin, setExpIndiumMin] = useState<number | "">("");
  const [expIndiumMax, setExpIndiumMax] = useState<number | "">("");
  const [expOverallMin, setExpOverallMin] = useState<number | "">("");
  const [expOverallMax, setExpOverallMax] = useState<number | "">("");

  const [sortKey, setSortKey] = useState<SortKey>("employeeId");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);
  const rowsPerPage = 5;

  const { data: credentialRows = [] } = useQuery({
    queryKey: ["admin-credentials"],
    queryFn: getAdminCredentials,
    staleTime: 1000 * 60,
  });

  const handleReset = () => {
    setEmpIdFilter("");
    setDeptFilter("All");
    setExpIndiumMin("");
    setExpIndiumMax("");
    setExpOverallMin("");
    setExpOverallMax("");
    setPage(1);
  };

  const filteredData = useMemo(() => {
    return credentialRows.filter((item) => {
      if (empIdFilter && !item.employeeId.toLowerCase().includes(empIdFilter.toLowerCase())) return false;
      if (deptFilter !== "All" && item.department !== deptFilter) return false;
      if (expIndiumMin !== "" && item.expIndium < Number(expIndiumMin)) return false;
      if (expIndiumMax !== "" && item.expIndium > Number(expIndiumMax)) return false;
      if (expOverallMin !== "" && item.expOverall < Number(expOverallMin)) return false;
      if (expOverallMax !== "" && item.expOverall > Number(expOverallMax)) return false;
      return true;
    });
  }, [credentialRows, empIdFilter, deptFilter, expIndiumMin, expIndiumMax, expOverallMin, expOverallMax]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === "verifiedSkills") {
        aVal = a.verifiedSkills.length;
        bVal = b.verifiedSkills.length;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage) || 1;
  const currentData = sortedData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortKey !== colKey) return <span className='ml-1 text-gray-300'>↕</span>;
    return <span className='ml-1 text-admin-orange'>{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className='flex flex-col gap-5'>
      <div className='mb-1'>
        <h1 className='m-0 text-[26px] font-bold'>
          <span className='text-admin-orange'>Credentials</span> Management
        </h1>
        <p className='mt-1 text-[13px] text-admin-text-muted'>
          Filter and manage employee certifications, experience, and verified skills.
        </p>
      </div>

      <div className='rounded-xl border border-admin-border bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
        <div className='mb-4 text-[13px] font-bold uppercase tracking-[0.5px] text-gray-700'>Filters</div>

        <div className='mb-5 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]'>
          <div className='flex flex-col gap-1.5'>
            <label className='text-[12px] font-semibold text-gray-600'>Employee ID</label>
            <input
              className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
              value={empIdFilter}
              onChange={(e) => {
                setEmpIdFilter(e.target.value);
                setPage(1);
              }}
              placeholder='e.g. IND-1042'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <label className='text-[12px] font-semibold text-gray-600'>Department</label>
            <select
              className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(1);
              }}
            >
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className='flex flex-col gap-1.5'>
            <label className='text-[12px] font-semibold text-gray-600'>Years with Indium (Min - Max)</label>
            <div className='flex gap-2'>
              <input
                type='number'
                min='0'
                className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
                value={expIndiumMin}
                onChange={(e) => {
                  setExpIndiumMin(e.target.value as unknown as number);
                  setPage(1);
                }}
                placeholder='Min'
              />
              <input
                type='number'
                min='0'
                className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
                value={expIndiumMax}
                onChange={(e) => {
                  setExpIndiumMax(e.target.value as unknown as number);
                  setPage(1);
                }}
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
                value={expOverallMin}
                onChange={(e) => {
                  setExpOverallMin(e.target.value as unknown as number);
                  setPage(1);
                }}
                placeholder='Min'
              />
              <input
                type='number'
                min='0'
                className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-[13px] outline-none'
                value={expOverallMax}
                onChange={(e) => {
                  setExpOverallMax(e.target.value as unknown as number);
                  setPage(1);
                }}
                placeholder='Max'
              />
            </div>
          </div>
        </div>

        <div className='flex justify-end gap-3'>
          <button className='cursor-pointer rounded-md border-none bg-gray-100 px-4 py-2 text-[13px] font-semibold text-gray-600' onClick={handleReset}>Reset</button>
        </div>
      </div>

      <div className='overflow-hidden rounded-xl border border-admin-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]'>
        <div className='overflow-x-auto'>
          <table className='min-w-[800px] w-full border-collapse'>
            <thead>
              <tr className='border-b border-admin-border bg-admin-bg'>
                <th className='cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase text-admin-text-muted' onClick={() => handleSort("employeeId")}>Employee ID <SortIcon colKey="employeeId" /></th>
                <th className='cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase text-admin-text-muted' onClick={() => handleSort("name")}>Name <SortIcon colKey="name" /></th>
                <th className='cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase text-admin-text-muted' onClick={() => handleSort("department")}>Department <SortIcon colKey="department" /></th>
                <th className='cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase text-admin-text-muted' onClick={() => handleSort("expIndium")}>Years (Indium) <SortIcon colKey="expIndium" /></th>
                <th className='cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase text-admin-text-muted' onClick={() => handleSort("expOverall")}>Years (Overall) <SortIcon colKey="expOverall" /></th>
                <th className='cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase text-admin-text-muted' onClick={() => handleSort("verifiedSkills")}>Verified Skills <SortIcon colKey="verifiedSkills" /></th>
                <th className='cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase text-admin-text-muted' onClick={() => handleSort("status")}>Status <SortIcon colKey="status" /></th>
              </tr>
            </thead>
            <tbody>
              {currentData.length > 0 ? currentData.map((row) => (
                <tr key={row.id} className='border-b border-slate-100'>
                  <td className='align-middle px-4 py-3.5 text-[13px] text-gray-600'><span className='rounded-md bg-gray-100 px-2 py-1 font-mono text-[12px] font-semibold text-admin-text'>{row.employeeId}</span></td>
                  <td className='align-middle px-4 py-3.5 text-[13px] font-semibold text-admin-text'>{row.name}</td>
                  <td className='align-middle px-4 py-3.5 text-[13px] text-gray-600'>{row.department}</td>
                  <td className='align-middle px-4 py-3.5 text-[13px] text-gray-600'>{row.expIndium}</td>
                  <td className='align-middle px-4 py-3.5 text-[13px] text-gray-600'>{row.expOverall}</td>
                  <td className='align-middle px-4 py-3.5 text-[13px] text-gray-600'>
                    <div className='flex flex-wrap gap-1.5'>
                      {row.verifiedSkills.length === 0 ? (
                        <span className='rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-admin-text-muted'>
                          None
                        </span>
                      ) : (
                        row.verifiedSkills.map((s) => (
                          <span key={s} className='rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600'>
                            {s}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className='align-middle px-4 py-3.5 text-[13px] text-gray-600'>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                        row.status === "Active"
                          ? 'bg-admin-green-bg text-admin-green'
                          : 'bg-admin-red-bg text-admin-red'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className='px-4 py-10 text-center text-admin-text-muted'>No credentials found matching your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION */}
        <div className='flex items-center justify-between border-t border-admin-border p-4'>
          <div className='text-[13px] text-admin-text-muted'>
            Showing {Math.min((page - 1) * rowsPerPage + 1, sortedData.length)} to {Math.min(page * rowsPerPage, sortedData.length)} of {sortedData.length} records
          </div>
          <div className='flex gap-2'>
            <button
              className='cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50'
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className='px-3 py-1.5 text-[13px] font-semibold text-gray-700'>Page {page} of {totalPages}</span>
            <button
              className='cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50'
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
