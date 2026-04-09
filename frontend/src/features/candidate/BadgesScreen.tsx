import { useEffect, useMemo, useState } from "react";
import { Award, ChevronDown, Lock } from "lucide-react";

import type { BadgesScreenProps, CandidateBadge } from "./types/candidate";
import { IronBadge, BronzeBadge, SilverBadge, GoldBadge, PlatinumBadge } from "./BadgeIcons";

type BadgeTier = {
  level: string;
  rank: string;
  subtitle: string;
  IconComponent: React.ComponentType<{ size?: number; unlocked?: boolean; label?: string }>;
};

type ParsedBadge = {
  badge: CandidateBadge;
  level: string | null;
  skillName: string | null;
};

type TierRow = {
  level: string;
  rank: string;
  subtitle: string;
  unlocked: boolean;
  badge: CandidateBadge | null;
  skillName: string | null;
  IconComponent: React.ComponentType<{ size?: number; unlocked?: boolean; label?: string }>;
};

const TIER_ORDER: BadgeTier[] = [
  {
    level: "beginner",
    rank: "Iron",
    subtitle: "Beginner",
    IconComponent: IronBadge,
  },
  {
    level: "intermediate_1",
    rank: "Bronze",
    subtitle: "Intermediate 1",
    IconComponent: BronzeBadge,
  },
  {
    level: "intermediate_2",
    rank: "Silver",
    subtitle: "Intermediate 2",
    IconComponent: SilverBadge,
  },
  {
    level: "specialist_1",
    rank: "Gold",
    subtitle: "Specialist 1",
    IconComponent: GoldBadge,
  },
  {
    level: "specialist_2",
    rank: "Platinum",
    subtitle: "Specialist 2",
    IconComponent: PlatinumBadge,
  },
];

const ALL_SKILLS = "All Skills";

function parseBadgeCriteria(criteria: string): {
  skillName: string | null;
  level: string | null;
} {
  try {
    const parsed = JSON.parse(criteria) as {
      skill_name?: unknown;
      level?: unknown;
    };
    return {
      skillName: typeof parsed?.skill_name === "string" ? parsed.skill_name : null,
      level: typeof parsed?.level === "string" ? parsed.level : null,
    };
  } catch {
    return { skillName: null, level: null };
  }
}

function formatAwardDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently";
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAwardTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeSkillName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function trimSkillName(value: string): string {
  const cleaned = value.trim();
  return cleaned.length <= 12 ? cleaned : `${cleaned.slice(0, 12)}.`;
}

function composeBadgeLabel(skillName: string | null, levelLabel: string): string {
  if (!skillName) return levelLabel;
  return `${trimSkillName(skillName)} ${levelLabel}`;
}

export default function BadgesScreen({
  badges,
  allSkillNames,
  isBadgesLoading,
  isBadgesError,
}: BadgesScreenProps) {
  const [selectedSkill, setSelectedSkill] = useState<string>(ALL_SKILLS);
  const [statusFilter, setStatusFilter] = useState<"all" | "unlocked" | "locked">(
    "all",
  );
  const [expandedTierLevel, setExpandedTierLevel] = useState<string | null>(
    TIER_ORDER[0].level,
  );

  const parsedBadges = useMemo<ParsedBadge[]>(() => {
    return badges
      .map((badge) => {
        const meta = parseBadgeCriteria(badge.criteria);
        return {
          badge,
          level: meta.level,
          skillName: meta.skillName,
        };
      })
      .sort(
        (a, b) =>
          getAwardTimestamp(b.badge.awarded_at) - getAwardTimestamp(a.badge.awarded_at),
      );
  }, [badges]);

  const skillOptions = useMemo(() => {
    const unique = new Map<string, string>();

    const addSkill = (value: string | null | undefined) => {
      if (!value || !value.trim()) return;
      const normalized = normalizeSkillName(value);
      if (!unique.has(normalized)) {
        unique.set(normalized, value.trim());
      }
    };

    allSkillNames.forEach((skillName) => addSkill(skillName));
    parsedBadges.forEach((item) => addSkill(item.skillName));

    return [
      ALL_SKILLS,
      ...Array.from(unique.values()).sort((a, b) => a.localeCompare(b)),
    ];
  }, [allSkillNames, parsedBadges]);

  const filteredBadges = useMemo(
    () =>
      selectedSkill === ALL_SKILLS
        ? parsedBadges
        : parsedBadges.filter(
            (item) => normalizeSkillName(item.skillName) === normalizeSkillName(selectedSkill),
          ),
    [parsedBadges, selectedSkill],
  );

  const latestBadgeByLevel = useMemo(() => {
    const map = new Map<string, { badge: CandidateBadge; skillName: string | null }>();
    filteredBadges.forEach((item) => {
      if (!item.level || map.has(item.level)) return;
      map.set(item.level, { badge: item.badge, skillName: item.skillName });
    });
    return map;
  }, [filteredBadges]);

  const unlockedLevels = useMemo(
    () => new Set(Array.from(latestBadgeByLevel.keys())),
    [latestBadgeByLevel],
  );

  useEffect(() => {
    if (selectedSkill !== ALL_SKILLS && !skillOptions.includes(selectedSkill)) {
      setSelectedSkill(ALL_SKILLS);
    }
  }, [selectedSkill, skillOptions]);

  const tierRows = useMemo<TierRow[]>(
    () =>
      TIER_ORDER.map((tier) => {
        const tierBadge = latestBadgeByLevel.get(tier.level) ?? null;
        return {
          level: tier.level,
          rank: tier.rank,
          subtitle: tier.subtitle,
          unlocked: unlockedLevels.has(tier.level),
          badge: tierBadge?.badge ?? null,
          skillName: tierBadge?.skillName ?? null,
          IconComponent: tier.IconComponent,
        };
      }),
    [latestBadgeByLevel, unlockedLevels],
  );

  const visibleTierRows = useMemo(
    () =>
      tierRows.filter((row) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "unlocked") return row.unlocked;
        return !row.unlocked;
      }),
    [tierRows, statusFilter],
  );

  useEffect(() => {
    if (visibleTierRows.length === 0) {
      setExpandedTierLevel(null);
      return;
    }

    const exists = expandedTierLevel
      ? visibleTierRows.some((row) => row.level === expandedTierLevel)
      : false;
    if (!exists) {
      setExpandedTierLevel(visibleTierRows[0].level);
    }
  }, [expandedTierLevel, visibleTierRows]);

  const unlockedCount = unlockedLevels.size;
  const lockedCount = TIER_ORDER.length - unlockedCount;
  const earnedCount = filteredBadges.length;

  return (
    <div className="mx-auto w-full max-w-[980px] pb-10">
      <div className="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <SummaryCard label="Tiers" value={`${TIER_ORDER.length}`} icon="🏅" />
        <SummaryCard label="Earned" value={`${earnedCount}`} icon="🎖️" />
        <SummaryCard label="Locked" value={`${lockedCount}`} icon="🔒" />
        <SummaryCard label="Unlocked" value={`${unlockedCount}`} icon="✅" highlight />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[24px] font-bold">
          <span className="text-admin-orange">Badge</span> Achievement Progress
        </h2>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              id="badges-skill-filter"
              value={selectedSkill}
              onChange={(e) => {
                setSelectedSkill(e.target.value);
                setExpandedTierLevel(null);
              }}
              className="min-w-[220px] appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-[13px] outline-none"
            >
              {skillOptions.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
              <ChevronDown size={16} />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {([
              ["all", "All"],
              ["unlocked", "Unlocked"],
              ["locked", "Locked"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`cursor-pointer rounded-lg border-none px-3 py-1.5 text-[12px] font-semibold ${
                  statusFilter === key
                    ? "bg-admin-orange text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
        <p className="mb-2 text-[13px] font-semibold text-admin-text">Tier Journey</p>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
          {tierRows.map((row) => (
            <div
              key={row.level}
              className={`rounded-lg border px-2.5 py-2 ${
                row.unlocked
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <row.IconComponent
                  size={24}
                  unlocked={row.unlocked}
                  label={composeBadgeLabel(
                    selectedSkill === ALL_SKILLS ? row.skillName : selectedSkill,
                    row.subtitle,
                  )}
                />
                <span className="text-[12px] font-bold text-admin-text">{row.rank}</span>
              </div>
              <p className="m-0 text-[11px] text-admin-text-muted">{row.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      {isBadgesLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-400">
          Loading your badges...
        </div>
      )}

      {isBadgesError && (
        <div className="rounded-xl border border-red-200 bg-rose-50 p-6 text-center text-red-700">
          Failed to load badges right now. Please refresh in a moment.
        </div>
      )}

      {!isBadgesLoading && !isBadgesError && visibleTierRows.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-400">
          No badge records match the selected filter.
        </div>
      )}

      {!isBadgesLoading && !isBadgesError && visibleTierRows.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleTierRows.map((row) => {
            const isOpen = expandedTierLevel === row.level;
            const showcaseBadge = !isOpen && row.unlocked;

            return (
              <div
                key={row.level}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div
                  className={`flex cursor-pointer items-center px-4 ${
                    showcaseBadge ? "gap-5 py-5" : "gap-3.5 py-3.5"
                  }`}
                  onClick={() => setExpandedTierLevel(isOpen ? null : row.level)}
                >
                  <div
                    className={`grid shrink-0 place-items-center rounded-xl border transition-all duration-300 ${
                      showcaseBadge
                        ? "h-[136px] w-[136px] border-orange-200 bg-orange-50 shadow-[0_0_0_3px_rgba(249,115,22,0.14),0_14px_34px_rgba(249,115,22,0.3)]"
                        : "h-16 w-16 border-gray-200 bg-gray-50"
                    }`}
                  >
                    <row.IconComponent
                      size={showcaseBadge ? 108 : 52}
                      unlocked={row.unlocked}
                      label={composeBadgeLabel(
                        selectedSkill === ALL_SKILLS ? row.skillName : selectedSkill,
                        row.subtitle,
                      )}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[15px] font-bold text-admin-text">
                      {composeBadgeLabel(
                        selectedSkill === ALL_SKILLS ? row.skillName : selectedSkill,
                        row.subtitle,
                      )}
                    </p>
                    <p className="mt-1 text-[12px] text-admin-text-muted">
                      {row.subtitle} • {row.unlocked ? `Earned in ${row.skillName ?? "a skill"}` : "Not unlocked yet"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${
                        row.unlocked
                          ? "bg-green-100 text-green-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.unlocked ? "Unlocked" : "Locked"}
                    </span>
                    <span className="text-[12px] font-semibold text-admin-text-muted">
                      {isOpen ? "▲ Hide" : "▼ Details"}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3.5">
                    <p className="mb-2 text-[13px] font-semibold text-admin-text">Badge Details</p>

                    {row.badge ? (
                      <div className="grid gap-2.5 text-[13px] text-admin-text-muted">
                        <div className="grid grid-cols-[110px_1fr] gap-2">
                          <span className="font-semibold text-admin-text">Badge Name</span>
                          <span>{row.badge.name}</span>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] gap-2">
                          <span className="font-semibold text-admin-text">Skill</span>
                          <span>{row.skillName ?? "-"}</span>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] gap-2">
                          <span className="font-semibold text-admin-text">Awarded</span>
                          <span>{formatAwardDate(row.badge.awarded_at)}</span>
                        </div>
                        {row.badge.description && (
                          <div className="grid grid-cols-[110px_1fr] gap-2">
                            <span className="font-semibold text-admin-text">Summary</span>
                            <span>{row.badge.description}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[13px] text-admin-text-muted">
                        <Lock className="h-4 w-4 text-slate-400" />
                        <span>
                          This tier is currently locked. Clear the {row.subtitle} assessment to unlock this badge.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredBadges.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 text-center text-[13px] text-gray-500">
              <Award className="mr-2 inline h-4 w-4 align-text-bottom text-gray-400" />
              {selectedSkill === ALL_SKILLS
                ? "No badges earned yet. Complete and clear a level test to unlock your first badge."
                : `No badges earned yet for ${selectedSkill}.`}
            </div>
          )}
        </div>
      )}
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
