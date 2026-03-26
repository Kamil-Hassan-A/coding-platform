import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getSkills, getUserProgress } from "../candidate/candidateService";

const ORANGE = "#F97316";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate_1: "Intermediate 1",
  intermediate_2: "Intermediate 2",
  specialist_1: "Specialist 1",
  specialist_2: "Specialist 2",
};

type LevelRow = {
  level: string;
  label: string;
  attemptsUsed: number;
  attemptsRemaining: number;
  unlocked: boolean;
  cleared: boolean;
};

export default function PastScores() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "cleared" | "active" | "locked">("all");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const { data: skills = [] } = useQuery({
    queryKey: ["skills"],
    queryFn: getSkills,
    staleTime: 1000 * 60 * 5,
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["user-progress"],
    queryFn: getUserProgress,
    staleTime: 1000 * 60,
  });

  const activeSkillId = selectedSkillId ?? skills[0]?.skill_id ?? null;
  const activeSkill = skills.find((s) => s.skill_id === activeSkillId);
  const activeProgress = progress.find((p) => p.skill_id === activeSkillId);

  const levelRows: LevelRow[] = useMemo(() => {
    if (!activeProgress) return [];
    return activeProgress.levels.map((l) => ({
      level: l.level,
      label: LEVEL_LABELS[l.level] ?? l.label,
      attemptsUsed: l.attempts_used,
      attemptsRemaining: l.attempts_remaining,
      unlocked: l.unlocked,
      cleared: l.cleared,
    }));
  }, [activeProgress]);

  const filtered = useMemo(() => {
    if (filter === "all") return levelRows;
    if (filter === "cleared") return levelRows.filter((r) => r.cleared);
    if (filter === "active") return levelRows.filter((r) => r.unlocked && !r.cleared);
    return levelRows.filter((r) => !r.unlocked);
  }, [levelRows, filter]);

  const totalLevels = levelRows.length;
  const clearedCount = levelRows.filter((r) => r.cleared).length;
  const attemptedCount = levelRows.filter((r) => r.attemptsUsed > 0).length;
  const unlockedCount = levelRows.filter((r) => r.unlocked).length;

  return (
    <div style={styles.page}>
      <div style={styles.summaryRow}>
        <SummaryCard label="Levels" value={`${totalLevels}`} icon="📋" />
        <SummaryCard label="Attempted" value={`${attemptedCount}`} icon="🧪" />
        <SummaryCard label="Unlocked" value={`${unlockedCount}`} icon="🔓" />
        <SummaryCard label="Cleared" value={`${clearedCount}`} icon="✅" highlight />
      </div>

      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{ color: ORANGE }}>Past</span> Assessment Progress
        </h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={activeSkillId ?? ""}
            onChange={(e) => {
              setSelectedSkillId(e.target.value || null);
              setExpanded(null);
            }}
            style={styles.skillSelect}
          >
            {skills.map((skill) => (
              <option key={skill.skill_id} value={skill.skill_id}>
                {skill.name}
              </option>
            ))}
          </select>

          <div style={styles.filterRow}>
            {([
              ["all", "All"],
              ["cleared", "Cleared"],
              ["active", "Unlocked"],
              ["locked", "Locked"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                style={{
                  ...styles.filterBtn,
                  background: filter === key ? ORANGE : "#F3F4F6",
                  color: filter === key ? "#fff" : "#666",
                }}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.cardsList}>
        {filtered.length === 0 && (
          <div style={styles.empty}>No level records match the selected filter.</div>
        )}

        {filtered.map((row) => {
          const recordId = `${activeSkillId}-${row.level}`;
          const isOpen = expanded === recordId;
          const status = row.cleared
            ? { label: "Cleared", bg: "#DCFCE7", color: "#16A34A" }
            : row.unlocked
              ? { label: "Unlocked", bg: "#FEF3C7", color: "#D97706" }
              : { label: "Locked", bg: "#F1F5F9", color: "#64748B" };

          const attemptPercent = row.attemptsUsed + row.attemptsRemaining > 0
            ? Math.round((row.attemptsUsed / (row.attemptsUsed + row.attemptsRemaining)) * 100)
            : 0;

          return (
            <div key={recordId} style={styles.scoreCard}>
              <div style={styles.cardMain} onClick={() => setExpanded(isOpen ? null : recordId)}>
                <ScoreRing pct={attemptPercent} />

                <div style={styles.cardInfo}>
                  <p style={styles.campaign}>{activeSkill?.name ?? "Skill"}</p>
                  <p style={styles.meta}>
                    {row.label} • Attempts used: {row.attemptsUsed} • Remaining: {row.attemptsRemaining}
                  </p>
                </div>

                <div style={styles.cardRight}>
                  <span style={{ ...styles.statusBadge, background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                  <button style={styles.expandBtn}>{isOpen ? "▲ Hide" : "▼ Details"}</button>
                </div>
              </div>

              {isOpen && (
                <div style={styles.breakdown}>
                  <p style={styles.breakdownTitle}>Progress Details</p>
                  <div style={styles.breakdownGrid}>
                    <TopicRow
                      topic="Eligibility"
                      score={row.unlocked ? 1 : 0}
                      max={1}
                      color={row.unlocked ? "#22c55e" : "#ef4444"}
                    />
                    <TopicRow
                      topic="Completion"
                      score={row.cleared ? 1 : 0}
                      max={1}
                      color={row.cleared ? "#22c55e" : "#f59e0b"}
                    />
                    <TopicRow
                      topic="Attempts Remaining"
                      score={row.attemptsRemaining}
                      max={Math.max(1, row.attemptsUsed + row.attemptsRemaining)}
                      color="#3b82f6"
                    />
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
      <p style={{ margin: "8px 0 2px", fontSize: "13px", opacity: 0.85 }}>{label}</p>
      <h3 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>{value}</h3>
    </div>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: `conic-gradient(${ORANGE} ${clamped * 3.6}deg, #e5e7eb 0deg)`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: "50%",
          background: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#111",
        }}
      >
        {clamped}%
      </div>
    </div>
  );
}

function TopicRow({ topic, score, max, color }: { topic: string; score: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div style={styles.topicRow}>
      <div style={styles.topicMeta}>
        <span style={styles.topicName}>{topic}</span>
        <span style={styles.topicScore}>
          {score}/{max}
        </span>
      </div>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      </div>
      <span style={styles.topicPct}>{pct}%</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
    paddingBottom: 40,
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    borderRadius: 12,
    padding: "16px 16px 14px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
  },
  skillSelect: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 13,
    outline: "none",
    minWidth: 220,
    background: "#fff",
  },
  filterRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  filterBtn: {
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    padding: "7px 12px",
    cursor: "pointer",
  },
  cardsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  scoreCard: {
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    overflow: "hidden",
  },
  cardMain: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    cursor: "pointer",
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  campaign: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "#111827",
  },
  meta: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#6b7280",
  },
  cardRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
  },
  statusBadge: {
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  expandBtn: {
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },
  breakdown: {
    borderTop: "1px solid #f1f5f9",
    padding: "14px 16px 16px",
    background: "#fcfcfd",
  },
  breakdownTitle: {
    margin: "0 0 10px",
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  breakdownGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  topicRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 2fr auto",
    gap: 10,
    alignItems: "center",
  },
  topicMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  },
  topicName: {
    fontSize: 12,
    color: "#374151",
    fontWeight: 600,
  },
  topicScore: {
    fontSize: 12,
    color: "#6b7280",
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    background: "#e5e7eb",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  topicPct: {
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    minWidth: 36,
    textAlign: "right",
  },
  empty: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    background: "#fff",
  },
};
