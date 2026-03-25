import { useState } from "react";

const ORANGE = "#F97316";

interface ScoreRecord {
  id: string;
  campaign: string;
  role: string;
  date: string;
  score: number;
  maxScore: number;
  timeTaken: string;
  status: "passed" | "failed" | "under_review";
  round: string;
  breakdown: { topic: string; score: number; max: number }[];
}

const MOCK_SCORES: ScoreRecord[] = [
  {
    id: "1",
    campaign: "INSDIUM — Full Stack Developer",
    role: "Full Stack Developer",
    date: "2026-03-22",
    score: 78,
    maxScore: 100,
    timeTaken: "48 min",
    status: "passed",
    round: "Round 1 — Technical",
    breakdown: [
      { topic: "JavaScript", score: 22, max: 25 },
      { topic: "React", score: 18, max: 25 },
      { topic: "Node.js", score: 20, max: 25 },
      { topic: "System Design", score: 18, max: 25 },
    ],
  },
  {
    id: "2",
    campaign: "Test 1 — Data Analytics",
    role: "Data Analyst",
    date: "2026-03-20",
    score: 54,
    maxScore: 100,
    timeTaken: "55 min",
    status: "failed",
    round: "Round 1 — Aptitude",
    breakdown: [
      { topic: "SQL", score: 14, max: 25 },
      { topic: "Python", score: 16, max: 25 },
      { topic: "Statistics", score: 12, max: 25 },
      { topic: "Visualization", score: 12, max: 25 },
    ],
  },
  {
    id: "3",
    campaign: "Test — Full Stack",
    role: "Full Stack Developer",
    date: "2026-03-18",
    score: 91,
    maxScore: 100,
    timeTaken: "42 min",
    status: "passed",
    round: "Round 2 — Advanced",
    breakdown: [
      { topic: "Algorithms", score: 24, max: 25 },
      { topic: "Database", score: 23, max: 25 },
      { topic: "Architecture", score: 22, max: 25 },
      { topic: "Cloud Basics", score: 22, max: 25 },
    ],
  },
];

const STATUS_CONFIG = {
  passed: { label: "Passed", bg: "#DCFCE7", color: "#16A34A" },
  failed: { label: "Failed", bg: "#FEE2E2", color: "#DC2626" },
  under_review: { label: "Under Review", bg: "#FEF3C7", color: "#D97706" },
};

export default function PastScores() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "passed" | "failed">("all");

  const filtered =
    filter === "all"
      ? MOCK_SCORES
      : MOCK_SCORES.filter((s) => s.status === filter);

  const avg =
    MOCK_SCORES.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) /
    MOCK_SCORES.length;

  const best = MOCK_SCORES.reduce((a, b) =>
    b.score / b.maxScore > a.score / a.maxScore ? b : a
  );

  return (
    <div style={styles.page}>
      {/* Summary Cards */}
      <div style={styles.summaryRow}>
        <SummaryCard
          label="Assessments Taken"
          value={MOCK_SCORES.length.toString()}
          icon="📋"
        />
        <SummaryCard
          label="Average Score"
          value={`${avg.toFixed(1)}%`}
          icon="📊"
          highlight
        />
        <SummaryCard
          label="Best Score"
          value={`${best.score}/${best.maxScore}`}
          icon="🏆"
        />
        <SummaryCard
          label="Passed"
          value={MOCK_SCORES.filter((s) => s.status === "passed")
            .length.toString()}
          icon="✅"
        />
      </div>

      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{ color: ORANGE }}>Past</span> Assessment Scores
        </h2>
        <div style={styles.filterRow}>
          {(["all", "passed", "failed"] as const).map((f) => (
            <button
              key={f}
              style={{
                ...styles.filterBtn,
                background: filter === f ? ORANGE : "#F3F4F6",
                color: filter === f ? "#fff" : "#666",
              }}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Score Cards */}
      <div style={styles.cardsList}>
        {filtered.length === 0 && (
          <div style={styles.empty}>No assessments match this filter.</div>
        )}
        {filtered.map((record) => {
          const pct = Math.round((record.score / record.maxScore) * 100);
          const isOpen = expanded === record.id;
          const cfg = STATUS_CONFIG[record.status];

          return (
            <div key={record.id} style={styles.scoreCard}>
              <div
                style={styles.cardMain}
                onClick={() => setExpanded(isOpen ? null : record.id)}
              >
                {/* Score circle */}
                <ScoreRing pct={pct} />

                {/* Info */}
                <div style={styles.cardInfo}>
                  <p style={styles.campaign}>{record.campaign}</p>
                  <p style={styles.meta}>
                    {record.round} · {record.timeTaken} ·{" "}
                    {new Date(record.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {/* Status + expand */}
                <div style={styles.cardRight}>
                  <span
                    style={{
                      ...styles.statusBadge,
                      background: cfg.bg,
                      color: cfg.color,
                    }}
                  >
                    {cfg.label}
                  </span>
                  <button style={styles.expandBtn}>
                    {isOpen ? "▲ Hide" : "▼ Details"}
                  </button>
                </div>
              </div>

              {/* Breakdown */}
              {isOpen && (
                <div style={styles.breakdown}>
                  <p style={styles.breakdownTitle}>Score Breakdown</p>
                  <div style={styles.breakdownGrid}>
                    {record.breakdown.map((b) => {
                      const topicPct = Math.round((b.score / b.max) * 100);
                      return (
                        <div key={b.topic} style={styles.topicRow}>
                          <div style={styles.topicMeta}>
                            <span style={styles.topicName}>{b.topic}</span>
                            <span style={styles.topicScore}>
                              {b.score}/{b.max}
                            </span>
                          </div>
                          <div style={styles.barTrack}>
                            <div
                              style={{
                                ...styles.barFill,
                                width: `${topicPct}%`,
                                background:
                                  topicPct >= 80
                                    ? "#22c55e"
                                    : topicPct >= 60
                                    ? ORANGE
                                    : "#ef4444",
                              }}
                            />
                          </div>
                          <span style={styles.topicPct}>{topicPct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.summaryCard,
        background: highlight ? ORANGE : "#fff",
        color: highlight ? "#fff" : "#111",
        border: highlight ? "none" : "1px solid #E5E7EB",
      }}
    >
      <span style={{ fontSize: "22px" }}>{icon}</span>
      <p
        style={{
          fontSize: "22px",
          fontWeight: 800,
          margin: "8px 0 4px",
          color: highlight ? "#fff" : "#111",
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "12px",
          color: highlight ? "rgba(255,255,255,0.8)" : "#888",
          margin: 0,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? ORANGE : "#ef4444";

  return (
    <div style={{ position: "relative", width: "64px", height: "64px", flexShrink: 0 }}>
      <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#F3F4F6" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          fontWeight: 800,
          color,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "28px 32px",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    background: "#F9FAFB",
    minHeight: "100%",
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "28px",
  },
  summaryCard: {
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#111",
    margin: 0,
  },
  filterRow: { display: "flex", gap: "8px" },
  filterBtn: {
    border: "none",
    borderRadius: "6px",
    padding: "7px 16px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  cardsList: { display: "flex", flexDirection: "column", gap: "12px" },
  scoreCard: {
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  },
  cardMain: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    padding: "20px 24px",
    cursor: "pointer",
  },
  cardInfo: { flex: 1 },
  campaign: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#111",
    margin: "0 0 4px",
  },
  meta: { fontSize: "13px", color: "#888", margin: 0 },
  cardRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
  },
  statusBadge: {
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 600,
  },
  expandBtn: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  breakdown: {
    borderTop: "1px solid #F3F4F6",
    padding: "20px 24px",
    background: "#FAFAFA",
  },
  breakdownTitle: {
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#888",
    margin: "0 0 16px",
  },
  breakdownGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  topicRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  topicMeta: {
    display: "flex",
    justifyContent: "space-between",
    width: "180px",
    flexShrink: 0,
  },
  topicName: { fontSize: "13px", color: "#444", fontWeight: 500 },
  topicScore: { fontSize: "12px", color: "#888" },
  barTrack: {
    flex: 1,
    height: "8px",
    background: "#EBEBEB",
    borderRadius: "99px",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: "99px",
    transition: "width 0.4s ease",
  },
  topicPct: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#555",
    minWidth: "36px",
    textAlign: "right",
  },
  empty: {
    textAlign: "center",
    padding: "40px",
    color: "#aaa",
    fontSize: "14px",
  },
};
