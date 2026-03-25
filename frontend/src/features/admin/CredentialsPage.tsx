import { useState, useMemo } from "react";

const ORANGE = "#F97316";

interface Credential {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  expIndium: number;
  expOverall: number;
  verifiedSkills: string[];
  status: "Active" | "Inactive";
}

const MOCK_DATA: Credential[] = [
  { id: "1", employeeId: "IND-1042", name: "Arun Sharma", department: "Engineering", expIndium: 5, expOverall: 8, verifiedSkills: ["React JS", "Node.js"], status: "Active" },
  { id: "2", employeeId: "IND-1078", name: "Priya Nair", department: "Data", expIndium: 2, expOverall: 4, verifiedSkills: ["Python", "SQL"], status: "Active" },
  { id: "3", employeeId: "IND-1015", name: "Rohan Mehta", department: "Engineering", expIndium: 7, expOverall: 12, verifiedSkills: ["Java", "Springboot", "AWS"], status: "Inactive" },
  { id: "4", employeeId: "IND-1102", name: "Aisha Khan", department: "Design", expIndium: 4, expOverall: 6, verifiedSkills: ["Figma", "UI/UX"], status: "Active" },
  { id: "5", employeeId: "IND-1205", name: "Kiran Kumar", department: "HR", expIndium: 1, expOverall: 5, verifiedSkills: ["Recruitment"], status: "Active" },
  { id: "6", employeeId: "IND-1088", name: "Suresh Pillai", department: "QA", expIndium: 8, expOverall: 15, verifiedSkills: ["Selenium", "Java", "Cypress"], status: "Active" },
  { id: "7", employeeId: "IND-1304", name: "Neha Gupta", department: "Engineering", expIndium: 3, expOverall: 3, verifiedSkills: ["TypeScript", "Next.js"], status: "Active" },
  { id: "8", employeeId: "IND-1155", name: "Vikram Das", department: "Sales", expIndium: 6, expOverall: 10, verifiedSkills: ["CRM", "Negotiation"], status: "Inactive" },
  { id: "9", employeeId: "IND-1221", name: "Anita Bose", department: "Product", expIndium: 2, expOverall: 7, verifiedSkills: ["Agile", "Scrum"], status: "Active" },
  { id: "10", employeeId: "IND-1099", name: "Manoj Reddy", department: "Engineering", expIndium: 10, expOverall: 14, verifiedSkills: ["C#", ".NET", "Azure"], status: "Active" },
  { id: "11", employeeId: "IND-1310", name: "Ritika Singh", department: "Data", expIndium: 0, expOverall: 2, verifiedSkills: ["Python", "Pandas"], status: "Active" },
  { id: "12", employeeId: "IND-1175", name: "Deepak Verma", department: "Engineering", expIndium: 5, expOverall: 9, verifiedSkills: ["React JS", "GraphQL"], status: "Active" },
];

const DEPARTMENTS = ["All", "Engineering", "Data", "Design", "QA", "HR", "Sales", "Product"];

type SortKey = keyof Credential;
type SortOrder = "asc" | "desc";

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
    return MOCK_DATA.filter(item => {
      if (empIdFilter && !item.employeeId.toLowerCase().includes(empIdFilter.toLowerCase())) return false;
      if (deptFilter !== "All" && item.department !== deptFilter) return false;
      if (expIndiumMin !== "" && item.expIndium < Number(expIndiumMin)) return false;
      if (expIndiumMax !== "" && item.expIndium > Number(expIndiumMax)) return false;
      if (expOverallMin !== "" && item.expOverall < Number(expOverallMin)) return false;
      if (expOverallMax !== "" && item.expOverall > Number(expOverallMax)) return false;
      return true;
    });
  }, [empIdFilter, deptFilter, expIndiumMin, expIndiumMax, expOverallMin, expOverallMax]);

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
    if (sortKey !== colKey) return <span style={{ color: "#d1d5db", marginLeft: 4 }}>↕</span>;
    return <span style={{ color: ORANGE, marginLeft: 4 }}>{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>
          <span style={{ color: ORANGE }}>Credentials</span> Management
        </h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
          Filter and manage employee certifications, experience, and verified skills.
        </p>
      </div>

      {/* FILTERS */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>Filters</div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          <div style={styles.filterGroup}>
            <label style={styles.label}>Employee ID</label>
            <input style={styles.input} value={empIdFilter} onChange={e => { setEmpIdFilter(e.target.value); setPage(1); }} placeholder="e.g. IND-1042" />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.label}>Department</label>
            <select style={styles.input} value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>Years with Indium (Min - Max)</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="number" min="0" style={styles.input} value={expIndiumMin} onChange={e => { setExpIndiumMin(e.target.value as unknown as number); setPage(1); }} placeholder="Min" />
              <input type="number" min="0" style={styles.input} value={expIndiumMax} onChange={e => { setExpIndiumMax(e.target.value as unknown as number); setPage(1); }} placeholder="Max" />
            </div>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>Overall Experience (Min - Max)</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="number" min="0" style={styles.input} value={expOverallMin} onChange={e => { setExpOverallMin(e.target.value as unknown as number); setPage(1); }} placeholder="Min" />
              <input type="number" min="0" style={styles.input} value={expOverallMax} onChange={e => { setExpOverallMax(e.target.value as unknown as number); setPage(1); }} placeholder="Max" />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button style={styles.resetBtn} onClick={handleReset}>Reset</button>
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                <th style={styles.th} onClick={() => handleSort("employeeId")}>Employee ID <SortIcon colKey="employeeId" /></th>
                <th style={styles.th} onClick={() => handleSort("name")}>Name <SortIcon colKey="name" /></th>
                <th style={styles.th} onClick={() => handleSort("department")}>Department <SortIcon colKey="department" /></th>
                <th style={styles.th} onClick={() => handleSort("expIndium")}>Years (Indium) <SortIcon colKey="expIndium" /></th>
                <th style={styles.th} onClick={() => handleSort("expOverall")}>Years (Overall) <SortIcon colKey="expOverall" /></th>
                <th style={styles.th} onClick={() => handleSort("verifiedSkills")}>Verified Skills <SortIcon colKey="verifiedSkills" /></th>
                <th style={styles.th} onClick={() => handleSort("status")}>Status <SortIcon colKey="status" /></th>
              </tr>
            </thead>
            <tbody>
              {currentData.length > 0 ? currentData.map(row => (
                <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={styles.td}><span style={styles.idBadge}>{row.employeeId}</span></td>
                  <td style={{ ...styles.td, fontWeight: 600, color: "#111827" }}>{row.name}</td>
                  <td style={styles.td}>{row.department}</td>
                  <td style={styles.td}>{row.expIndium}</td>
                  <td style={styles.td}>{row.expOverall}</td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {row.verifiedSkills.map(s => (
                        <span key={s} style={{ background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: "4px", fontSize: 11, fontWeight: 600 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      background: row.status === "Active" ? "#dcfce7" : "#fee2e2",
                      color: row.status === "Active" ? "#16a34a" : "#dc2626",
                      padding: "4px 10px", borderRadius: "99px", fontSize: 12, fontWeight: 600
                    }}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>No credentials found matching your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION */}
        <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Showing {Math.min((page - 1) * rowsPerPage + 1, sortedData.length)} to {Math.min(page * rowsPerPage, sortedData.length)} of {sortedData.length} records
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              style={{ ...styles.pageBtn, opacity: page === 1 ? 0.5 : 1 }} 
              disabled={page === 1} 
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#374151" }}>Page {page} of {totalPages}</span>
            <button 
              style={{ ...styles.pageBtn, opacity: page === totalPages ? 0.5 : 1 }} 
              disabled={page === totalPages} 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filterGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: 12, fontWeight: 600, color: "#4b5563" },
  input: { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", background: "#f9fafb" },
  resetBtn: { padding: "8px 16px", background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: "6px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  th: { padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" },
  td: { padding: "14px 16px", fontSize: 13, color: "#4b5563", verticalAlign: "middle" },
  idBadge: { background: "#f3f4f6", padding: "4px 8px", borderRadius: "6px", fontSize: 12, fontFamily: "monospace", color: "#111827", fontWeight: 600 },
  pageBtn: { padding: "6px 12px", border: "1px solid #d1d5db", background: "#fff", borderRadius: "6px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" },
};
