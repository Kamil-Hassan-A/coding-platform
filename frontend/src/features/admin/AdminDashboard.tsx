import { type CSSProperties, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { logout } from '../auth/authService';
import Sidebar from '../../components/layout/Sidebar';
import {
  getAdminCandidates,
  getDashboardStats,
  type AdminCandidate,
} from './dashboardService';

const C = {
  orange: '#f97316',
  orangeLight: '#fff7ed',
  white: '#ffffff',
  bg: '#f8fafc',
  border: '#e5e7eb',
  text: '#111827',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  green: '#16a34a',
  greenBg: '#dcfce7',
  red: '#dc2626',
  redBg: '#fee2e2',
};

const dropdownStyle = (active: boolean): CSSProperties => ({
  padding: '9px 36px 9px 12px',
  borderRadius: 8,
  border: `1.5px solid ${active ? C.orange : C.border}`,
  background: active ? C.orangeLight : C.white,
  color: active ? C.orange : C.text,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
  minWidth: 260,
  appearance: 'none' as const,
  backgroundImage:
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
});

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: C.white, borderRadius: 10, padding: '20px 22px', border: `1px solid ${C.border}`, flex: '1 1 0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.text, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
      <div style={{ color: C.textMuted, fontSize: 13, marginTop: 5, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.orange, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: active ? C.orange : '#f3f4f6', color: active ? C.white : C.textMuted, transition: 'all 0.15s' }}>
      {label}
    </button>
  );
}

function ActiveTag({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 11, background: C.orangeLight, color: C.orange, padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
      {label}
    </span>
  );
}

export default function AdminDashboard() {
  const [page, setPage] = useState<'dashboard' | 'candidates'>('dashboard');
  const [showMenu, setShowMenu] = useState(false);
  const [dashSkill, setDashSkill] = useState('');
  const [filterGender, setFilterGender] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [filterSkill, setFilterSkill] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60,
  });

  const { data: candidateRows = [] } = useQuery({
    queryKey: ['admin-candidates'],
    queryFn: getAdminCandidates,
    staleTime: 1000 * 60,
  });

  const SKILLS = useMemo(
    () => Array.from(new Set(candidateRows.map((c) => c.skill).filter((skill) => skill && skill !== 'Not Attempted'))).sort(),
    [candidateRows],
  );

  const DEPARTMENTS = useMemo(
    () => ['All', ...Array.from(new Set(candidateRows.map((c) => c.dept))).sort()],
    [candidateRows],
  );

  const totalPass = candidateRows.filter((c) => c.status === 'Pass').length;
  const passRate = candidateRows.length > 0 ? Math.round((totalPass / candidateRows.length) * 100) : 0;

  const filtered = candidateRows.filter((c) => {
    if (filterGender !== 'All' && c.gender !== filterGender) return false;
    if (filterDept !== 'All' && c.dept !== filterDept) return false;
    if (filterSkill && c.skill !== filterSkill) return false;
    return true;
  });

  const visibleStats = useMemo(() => {
    const grouped = new Map<string, { skill: string; pass: number; fail: number }>();
    for (const row of candidateRows) {
      if (row.skill === 'Not Attempted') continue;
      const existing = grouped.get(row.skill) ?? { skill: row.skill, pass: 0, fail: 0 };
      if (row.status === 'Pass') existing.pass += 1;
      else if (row.status === 'Fail') existing.fail += 1;
      grouped.set(row.skill, existing);
    }

    const values = Array.from(grouped.values());
    return dashSkill ? values.filter((v) => v.skill === dashSkill) : values;
  }, [candidateRows, dashSkill]);

  const passFailPie = [
    { name: 'Pass', value: candidateRows.filter((c) => c.status === 'Pass').length, color: C.green },
    { name: 'Fail', value: candidateRows.filter((c) => c.status === 'Fail').length, color: C.red },
  ];

  const skillPie = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of candidateRows) {
      if (row.skill === 'Not Attempted') continue;
      grouped.set(row.skill, (grouped.get(row.skill) ?? 0) + 1);
    }

    const palette = ['#f97316', '#14b8a6', '#6366f1', '#eab308', '#94a3b8', '#ef4444', '#22c55e'];
    return Array.from(grouped.entries()).map(([name, value], i) => ({
      name,
      value,
      color: palette[i % palette.length],
    }));
  }, [candidateRows]);

  const availableSkills = filtered
    .map((c) => c.skill)
    .filter((s, i, arr) => s !== 'Not Attempted' && arr.indexOf(s) === i)
    .sort();

  const NAV = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'candidates', label: 'Candidates' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", background: C.bg, color: C.text, fontSize: 14 }}>
      <Sidebar
        items={NAV}
        active={page}
        onChange={(id) => setPage(id as 'dashboard' | 'candidates')}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.textMuted }}>{page === 'dashboard' ? 'Dashboard' : 'Candidates'}</span>
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowMenu((prev) => !prev)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: C.orange, color: C.white, fontWeight: 700, fontSize: 12, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              AD
            </div>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: 40, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 140, zIndex: 100 }}>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    void logout();
                  }}
                  style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', fontWeight: 600 }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

          {/* ── DASHBOARD ── */}
          {page === 'dashboard' && (
            <>
              <div style={{ marginBottom: 22 }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>
                  <span style={{ color: C.orange }}>Dashboard</span>
                </h1>
                <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 13 }}>Internal skill assessment overview</p>
              </div>

              {/* Stat cards */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 26 }}>
                <StatCard label='Total Employees' value={stats?.totalEmployees ?? 0} />
                <StatCard label='Assessments Taken' value={stats?.totalAssessments ?? 0} />
                <StatCard label='Pass Rate' value={`${passRate}%`} sub={`${totalPass} passed out of ${candidateRows.length}`} />
                <StatCard label='Pending' value={candidateRows.filter((c) => c.status === 'Pending').length} sub='awaiting assessment' />
              </div>

              {/* Skill dropdown */}
              <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textLight, letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' }}>Filter by Skill</div>
                  <select value={dashSkill} onChange={(e) => setDashSkill(e.target.value)} style={dropdownStyle(dashSkill !== '') }>
                    <option value=''>- All Skills -</option>
                    {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {dashSkill && (
                  <button onClick={() => setDashSkill('')} style={{ padding: '9px 14px', fontSize: 12, color: C.red, background: C.redBg, border: 'none', cursor: 'pointer', fontWeight: 700, borderRadius: 8 }}>
                    ✕ Clear
                  </button>
                )}
              </div>

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                <div style={{ background: C.white, borderRadius: 12, padding: '22px 20px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Pass / Fail Breakdown</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>{dashSkill ? `Showing: ${dashSkill}` : 'All assessments'}</div>
                  <ResponsiveContainer width='100%' height={210}>
                    <PieChart>
                      <Pie data={passFailPie} dataKey='value' cx='50%' cy='50%' outerRadius={82} innerRadius={50} paddingAngle={4}>
                        {passFailPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} formatter={(v: unknown) => [Number(v) || 0, 'Employees']} />
                      <Legend iconType='circle' iconSize={9} formatter={(v) => <span style={{ fontSize: 12, color: C.textMuted }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: C.white, borderRadius: 12, padding: '22px 20px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Skill Distribution</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Employees by assessed skill</div>
                  <ResponsiveContainer width='100%' height={210}>
                    <PieChart>
                      <Pie data={skillPie} dataKey='value' cx='50%' cy='50%' outerRadius={82} innerRadius={50} paddingAngle={4}>
                        {skillPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} formatter={(v: unknown) => [Number(v) || 0, 'Employees']} />
                      <Legend iconType='circle' iconSize={9} formatter={(v) => <span style={{ fontSize: 12, color: C.textMuted }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pass/fail per skill bars */}
              <div style={{ background: C.white, borderRadius: 12, padding: '22px 24px', border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>Pass / Fail by Skill</div>
                {visibleStats.length === 0
                  ? <div style={{ color: C.textLight, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data for selected skill.</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                      {visibleStats.map((row, i) => {
                        const total = row.pass + row.fail;
                        const pct = total > 0 ? Math.round((row.pass / total) * 100) : 0;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 190, fontSize: 13, fontWeight: 500, color: C.text, flexShrink: 0 }}>{row.skill}</div>
                            <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: pct >= 60 ? C.green : C.red, transition: 'width 0.5s ease' }} />
                            </div>
                            <div style={{ width: 38, fontSize: 12, fontWeight: 700, color: pct >= 60 ? C.green : C.red, textAlign: 'right', flexShrink: 0 }}>{pct}%</div>
                            <div style={{ fontSize: 12, color: C.textLight, width: 72, textAlign: 'right', flexShrink: 0 }}>{row.pass}P - {row.fail}F</div>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            </>
          )}

          {page === 'candidates' && (
            <>
              <div style={{ marginBottom: 22 }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>
                  <span style={{ color: C.orange }}>Candidate</span> Management
                </h1>
                <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 13 }}>
                  {filtered.length} employee{filtered.length !== 1 ? 's' : ''} shown
                </p>
              </div>

              <div style={{ background: C.white, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: 32, marginBottom: 18, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textLight, letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' }}>Gender</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['All', 'Male', 'Female'].map((g) => (
                        <FilterBtn key={g} label={g} active={filterGender === g} onClick={() => { setFilterGender(g); setFilterSkill(''); }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textLight, letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' }}>Department</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {DEPARTMENTS.map((d) => (
                        <FilterBtn key={d} label={d} active={filterDept === d} onClick={() => { setFilterDept(d); setFilterSkill(''); }} />
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textLight, letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' }}>Skill</div>
                    <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} style={dropdownStyle(filterSkill !== '') }>
                      <option value=''>- All Skills -</option>
                      {availableSkills.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {filterSkill && (
                    <button onClick={() => setFilterSkill('')} style={{ padding: '9px 14px', fontSize: 12, color: C.red, background: C.redBg, border: 'none', cursor: 'pointer', fontWeight: 700, borderRadius: 8 }}>
                      Clear
                    </button>
                  )}
                </div>

                {(filterGender !== 'All' || filterDept !== 'All' || filterSkill) && (
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600 }}>Active filters:</span>
                    {filterGender !== 'All' && <ActiveTag label={filterGender} />}
                    {filterDept !== 'All' && <ActiveTag label={filterDept} />}
                    {filterSkill && <ActiveTag label={filterSkill} />}
                    <button onClick={() => { setFilterGender('All'); setFilterDept('All'); setFilterSkill(''); }} style={{ fontSize: 11, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* Table */}
              <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      {['Employee', 'Gender', 'Department', 'Skill Tested', 'Score', 'Result'].map((h) => (
                        <th key={h} style={{ padding: '11px 18px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textLight, letterSpacing: 1, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: C.textLight, fontSize: 13 }}>
                          No employees match the selected filters.
                        </td>
                      </tr>
                    ) : filtered.map((c: AdminCandidate, i) => (
                      <tr key={`${c.user_id}-${i}`} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.bg; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = C.white; }}
                      >
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.orangeLight, color: C.orange, fontWeight: 800, fontSize: 11, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              {c.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: 13, color: C.textMuted }}>{c.gender}</td>
                        <td style={{ padding: '12px 18px', fontSize: 13, color: C.textMuted }}>{c.dept}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, background: C.orangeLight, color: C.orange, padding: '3px 10px', borderRadius: 6 }}>{c.skill}</span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 52, background: '#f3f4f6', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                              <div style={{ width: `${c.score}%`, height: '100%', background: c.score >= 60 ? C.green : C.red, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.score}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: c.status === 'Pass' ? C.greenBg : C.redBg, color: c.status === 'Pass' ? C.green : C.red }}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
