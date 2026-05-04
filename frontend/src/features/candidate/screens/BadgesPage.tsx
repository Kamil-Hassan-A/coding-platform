import { useMemo, useState } from "react";
import { Award, ChevronDown, Lock } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { CandidateBadge } from "../types/candidate";
import {
  IronBadge,
  BronzeBadge,
  SilverBadge,
  GoldBadge,
  PlatinumBadge,
} from "../components/BadgeIcons";
import { getSkills, getUserBadges } from "../candidateService";

type BadgeTier = {
  level: string;
  rank: string;
  subtitle: string;
  IconComponent: React.ComponentType<{
    size?: number;
    unlocked?: boolean;
    label?: string;
  }>;
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
  IconComponent: React.ComponentType<{
    size?: number;
    unlocked?: boolean;
    label?: string;
  }>;
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
      skillName:
        typeof parsed?.skill_name === "string" ? parsed.skill_name : null,
      level: typeof parsed?.level === "string" ? parsed.level : null,
    };
  } catch {
    return { skillName: null, level: null };
  }
}

function formatAwardDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
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

function composeBadgeLabel(
  skillName: string | null,
  levelLabel: string
): string {
  if (!skillName) return levelLabel;
  return `${skillName.trim()} ${levelLabel}`;
}

function BadgeCard({ row }: { row: TierRow }) {
  const isUnlocked = row.unlocked;
  const badgeLabel = composeBadgeLabel(row.skillName, row.subtitle);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div
        className={`relative flex flex-col items-center justify-center p-8 ${
          isUnlocked
            ? "bg-gradient-to-b from-orange-50 to-white"
            : "bg-slate-50"
        }`}
      >
        <div
          className={`grid place-items-center rounded-2xl transition-all duration-300 ${
            isUnlocked
              ? "h-[140px] w-[140px] bg-white shadow-[0_0_0_4px_rgba(249,115,22,0.1),0_12px_30px_rgba(249,115,22,0.2)]"
              : "h-[80px] w-[80px] bg-slate-100 opacity-60 grayscale filter"
          }`}
        >
          <row.IconComponent
            size={isUnlocked ? 110 : 48}
            unlocked={isUnlocked}
            label={badgeLabel}
          />
        </div>

        <div className="absolute right-4 top-4">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
              isUnlocked
                ? "bg-green-100 text-green-700"
                : "bg-slate-200 text-slate-500"
            }`}
          >
            {isUnlocked ? "Unlocked" : "Locked"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col border-t border-slate-100 p-6">
        <div className="mb-4 text-center">
          <h3 className="m-0 text-lg font-bold text-slate-900">{badgeLabel}</h3>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            {row.rank} Tier
          </p>
        </div>

        <div className="flex-1">
          {isUnlocked && row.badge ? (
            <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 text-[13px]">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-600">Skill</span>
                <span className="font-bold text-slate-900">
                  {row.skillName ?? "-"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-600">Awarded</span>
                <span className="font-bold text-slate-900">
                  {formatAwardDate(row.badge.awarded_at)}
                </span>
              </div>
              <div className="flex flex-col pt-1">
                <span className="font-semibold text-slate-600">Summary</span>
                <span className="mt-1 leading-relaxed text-slate-700">
                  {row.badge.description ||
                    "Demonstrated proficiency and passed the assessment."}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
              <Lock className="mb-2 h-6 w-6 opacity-50" />
              <p className="m-0 text-[13px]">
                Clear the {row.subtitle} assessment to unlock this rank.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BadgesPage() {
  const { data: apiSkills } = useQuery({
    queryKey: ["skills"],
    queryFn: getSkills,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
  });

  const {
    data: badges = [],
    isLoading: isBadgesLoading,
    isError: isBadgesError,
  } = useQuery({
    queryKey: ["user-badges"],
    queryFn: getUserBadges,
    staleTime: 0,
  });

  const allSkillNames = useMemo(
    () => (apiSkills ?? []).map((skill) => skill.name),
    [apiSkills]
  );
  const [selectedSkill, setSelectedSkill] = useState<string>(ALL_SKILLS);

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
          getAwardTimestamp(b.badge.awarded_at) -
          getAwardTimestamp(a.badge.awarded_at)
      );
  }, [badges]);

  const skillOptions = useMemo(() => {
    const unique = new Map<string, string>();
    const addSkill = (value: string | null | undefined) => {
      if (!value || !value.trim()) return;
      const normalized = normalizeSkillName(value);
      if (!unique.has(normalized)) unique.set(normalized, value.trim());
    };

    allSkillNames.forEach((skillName) => addSkill(skillName));
    parsedBadges.forEach((item) => addSkill(item.skillName));

    return [
      ALL_SKILLS,
      ...Array.from(unique.values()).sort((a, b) => a.localeCompare(b)),
    ];
  }, [allSkillNames, parsedBadges]);

  // Group all earned badges by skill
  const badgesBySkill = useMemo(() => {
    const map = new Map<
      string,
      Map<string, { badge: CandidateBadge; skillName: string | null }>
    >();

    parsedBadges.forEach((item) => {
      const skill = item.skillName || "Unknown Skill";
      if (!map.has(skill)) {
        map.set(skill, new Map());
      }
      if (item.level && !map.get(skill)!.has(item.level)) {
        map
          .get(skill)!
          .set(item.level, { badge: item.badge, skillName: item.skillName });
      }
    });
    return map;
  }, [parsedBadges]);

  // Determine which skills to display sections for
  const visibleSkills = useMemo(() => {
    // If a specific skill is selected, show it (even if 0 badges)
    if (selectedSkill !== ALL_SKILLS) {
      return [selectedSkill];
    }
    // If All Skills, only show skills that have at least one badge earned
    const active = Array.from(badgesBySkill.keys());
    return active.sort((a, b) => a.localeCompare(b));
  }, [selectedSkill, badgesBySkill]);

  // For each visible skill, generate the 5 tier rows
  const skillSections = useMemo(() => {
    return visibleSkills
      .map((skillName) => {
        const skillBadges = badgesBySkill.get(skillName) || new Map();

        const tierRows: TierRow[] = TIER_ORDER.map((tier) => {
          const tierBadge = skillBadges.get(tier.level) ?? null;
          return {
            level: tier.level,
            rank: tier.rank,
            subtitle: tier.subtitle,
            unlocked: !!tierBadge,
            badge: tierBadge?.badge ?? null,
            skillName: tierBadge?.skillName ?? skillName,
            IconComponent: tier.IconComponent,
          };
        });

        const filteredRows = tierRows.filter((row) => {
          if (selectedSkill === ALL_SKILLS && !row.unlocked) return false;
          return true;
        });

        return {
          skillName,
          rows: filteredRows,
        };
      })
      .filter((section) => section.rows.length > 0);
  }, [visibleSkills, badgesBySkill, selectedSkill]);

  return (
    <div className="mx-auto w-full max-w-[1200px] pb-14 px-4 sm:px-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="m-0 text-[28px] font-bold">
            <span className="text-admin-orange">Badge</span> Showcase
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            View and track your earned achievements across all skills.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <select
              id="badges-skill-filter"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="w-full min-w-[200px] appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-[14px] font-medium outline-none transition-colors hover:border-slate-400 focus:border-admin-orange focus:ring-2 focus:ring-admin-orange/20"
            >
              {skillOptions.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>
      </div>

      {isBadgesLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-400">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-admin-orange/30 border-t-admin-orange"></div>
          <p className="mt-4 font-medium">Loading your badges...</p>
        </div>
      )}

      {isBadgesError && (
        <div className="rounded-2xl border border-red-200 bg-rose-50 py-10 text-center text-red-700">
          <p className="font-semibold">Failed to load badges right now.</p>
          <p className="mt-1 text-sm opacity-80">
            Please refresh the page to try again.
          </p>
        </div>
      )}

      {!isBadgesLoading && !isBadgesError && skillSections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          <Award className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700">
            No Badges Found
          </h3>
          <p className="mt-1 text-sm">
            {selectedSkill === ALL_SKILLS
              ? "No badges match the selected filters."
              : `You haven't earned any badges for ${selectedSkill} yet.`}
          </p>
        </div>
      )}

      {!isBadgesLoading && !isBadgesError && skillSections.length > 0 && (
        <div className="flex flex-col gap-10">
          {skillSections.map((section) => (
            <div key={section.skillName} className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">
                  {section.skillName} Badges
                </h3>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {section.rows.map((row) => (
                  <BadgeCard key={row.level} row={row} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
