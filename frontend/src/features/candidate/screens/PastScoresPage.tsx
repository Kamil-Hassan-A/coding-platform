import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getSkills, getUserProgress } from "../candidateService";

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

export default function PastScoresPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "cleared" | "active" | "locked">(
    "all",
  );
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
    if (filter === "active")
      return levelRows.filter((r) => r.unlocked && !r.cleared);
    return levelRows.filter((r) => !r.unlocked);
  }, [levelRows, filter]);

  const totalLevels = levelRows.length;
  const clearedCount = levelRows.filter((r) => r.cleared).length;
  const attemptedCount = levelRows.filter((r) => r.attemptsUsed > 0).length;
  const unlockedCount = levelRows.filter((r) => r.unlocked).length;

  return (
    <div className="mx-auto w-full max-w-[980px] pb-10">
      <div className="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <SummaryCard label="Levels" value={`${totalLevels}`} icon="📋" />
        <SummaryCard label="Attempted" value={`${attemptedCount}`} icon="🧪" />
        <SummaryCard label="Unlocked" value={`${unlockedCount}`} icon="🔓" />
        <SummaryCard
          label="Cleared"
          value={`${clearedCount}`}
          icon="✅"
          highlight
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[24px] font-bold">
          <span className="text-admin-orange">Past</span> Assessment Progress
        </h2>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={activeSkillId ?? ""}
            onChange={(e) => {
              setSelectedSkillId(e.target.value || null);
              setExpanded(null);
            }}
            className="min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] outline-none"
          >
            {skills.map((skill) => (
              <option key={skill.skill_id} value={skill.skill_id}>
                {skill.name}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["cleared", "Cleared"],
                ["active", "Unlocked"],
                ["locked", "Locked"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`cursor-pointer rounded-lg border-none px-3 py-1.5 text-[12px] font-semibold ${
                  filter === key
                    ? "bg-admin-orange text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-400">
            No level records match the selected filter.
          </div>
        )}

        {filtered.map((row) => {
          const recordId = `${activeSkillId}-${row.level}`;
          const isOpen = expanded === recordId;
          const status = row.cleared
            ? { label: "Cleared", bg: "bg-green-100", color: "text-green-600" }
            : row.unlocked
              ? {
                  label: "Unlocked",
                  bg: "bg-amber-100",
                  color: "text-amber-600",
                }
              : {
                  label: "Locked",
                  bg: "bg-slate-100",
                  color: "text-slate-500",
                };

          const totalAttempts = row.attemptsUsed + row.attemptsRemaining;
          const attemptPercent =
            totalAttempts > 0
              ? Math.round((row.attemptsUsed / totalAttempts) * 100)
              : 0;

          return (
            <div
              key={recordId}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div
                className="flex cursor-pointer items-center gap-3.5 px-4 py-3.5"
                onClick={() => setExpanded(isOpen ? null : recordId)}
              >
                <ScoreRing pct={attemptPercent} />

                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[15px] font-bold text-admin-text">
                    {activeSkill?.name ?? "Skill"}
                  </p>
                  <p className="mt-1 text-[12px] text-admin-text-muted">
                    {row.label} • Attempts used: {row.attemptsUsed} • Remaining:{" "}
                    {row.attemptsRemaining}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${status.bg} ${status.color}`}
                  >
                    {status.label}
                  </span>
                  <button className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-admin-text-muted">
                    {isOpen ? "▲ Hide" : "▼ Details"}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3.5">
                  <p className="mb-2 text-[13px] font-semibold text-admin-text">
                    Progress Details
                  </p>
                  <div className="flex flex-col gap-2">
                    <TopicRow
                      topic="Eligibility"
                      score={row.unlocked ? 1 : 0}
                      max={1}
                      barClass={row.unlocked ? "bg-green-500" : "bg-red-500"}
                    />
                    <TopicRow
                      topic="Completion"
                      score={row.cleared ? 1 : 0}
                      max={1}
                      barClass={row.cleared ? "bg-green-500" : "bg-amber-500"}
                    />
                    <TopicRow
                      topic="Attempts Remaining"
                      score={row.attemptsRemaining}
                      max={Math.max(1, totalAttempts)}
                      barClass="bg-blue-500"
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
      className={`rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        highlight
          ? "border-none bg-admin-orange text-white"
          : "border border-admin-border bg-white text-admin-text"
      }`}
    >
      <span className="text-[22px]">{icon}</span>
      <p className="mb-0.5 mt-2 text-[13px] opacity-85">{label}</p>
      <h3 className="m-0 text-[24px] font-bold">{value}</h3>
    </div>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div
      className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#f97316 ${clamped * 3.6}deg, #e5e7eb 0deg)`,
      }}
    >
      <div className="grid h-[50px] w-[50px] place-items-center rounded-full bg-white text-[11px] font-bold text-admin-text">
        {clamped}%
      </div>
    </div>
  );
}

function TopicRow({
  topic,
  score,
  max,
  barClass,
}: {
  topic: string;
  score: number;
  max: number;
  barClass: string;
}) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const safePct = Math.max(0, Math.min(100, pct));

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <div>
        <div className="mb-1 flex items-center justify-between text-[12px] text-admin-text-muted">
          <span className="font-semibold text-admin-text">{topic}</span>
          <span>
            {score}/{max}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${safePct}%` }}
          />
        </div>
      </div>
      <span className="w-10 text-right text-[12px] font-semibold text-admin-text-muted">
        {safePct}%
      </span>
    </div>
  );
}
