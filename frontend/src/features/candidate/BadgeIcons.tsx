import { Lock, Star } from "lucide-react";

type BadgeProps = {
  size?: number;
  unlocked?: boolean;
  label?: string;
};

type ShieldBadgeProps = BadgeProps & {
  baseColor: string;
  darkColor: string;
  lightColor: string;
  accentColor: string;
  stars?: number;
};

function ShieldBadge({
  size = 96,
  unlocked = true,
  label,
  baseColor,
  darkColor,
  lightColor,
  accentColor,
  stars = 0,
}: ShieldBadgeProps) {
  const displayLabel = (label ?? "Badge").toUpperCase();
  const fontSize = displayLabel.length > 16 ? 8 : displayLabel.length > 12 ? 9 : 10;

  return (
    <div
      style={{
        width: size,
        height: size,
        filter: unlocked
          ? "drop-shadow(0 10px 16px rgba(0,0,0,0.2))"
          : "grayscale(0.9) opacity(0.5)",
      }}
      className="relative flex items-center justify-center"
    >
      <svg viewBox="0 0 120 132" className="h-full w-full" aria-hidden="true">
        <path
          d="M15 14 h90 c0 12 4 18 12 18 v45 c0 22-15 37-57 53C18 114 3 99 3 77V32c8 0 12-6 12-18z"
          fill={baseColor}
          stroke={darkColor}
          strokeWidth="3"
        />

        <path
          d="M22 23 h76 c0 8 3 12 8 12 v38 c0 16-11 28-46 41-35-13-46-25-46-41V35c5 0 8-4 8-12z"
          fill={darkColor}
          opacity="0.28"
        />

        <path d="M22 23 h76" stroke={lightColor} strokeWidth="3" opacity="0.8" />

        <text
          x="60"
          y="20"
          textAnchor="middle"
          fill="#ffffff"
          style={{ fontSize: `${fontSize}px`, fontWeight: 800, letterSpacing: "0.4px" }}
        >
          {displayLabel}
        </text>

        <polygon points="60,44 44,52 60,60 76,52" fill={lightColor} opacity="0.9" />
        <polygon points="60,58 44,66 60,74 76,66" fill={lightColor} opacity="0.85" />
        <polygon points="60,72 44,80 60,88 76,80" fill={lightColor} opacity="0.8" />

        {stars > 0 && (
          <g>
            {Array.from({ length: stars }).map((_, index) => {
              const spacing = 14;
              const startX = 60 - ((stars - 1) * spacing) / 2;
              const x = startX + index * spacing;
              return (
                <g key={`${x}-${index}`} transform={`translate(${x},34)`}>
                  <path
                    d="M0,-6 L1.8,-1.8 L6,-1.8 L2.6,0.7 L4,5 L0,2.4 L-4,5 L-2.6,0.7 L-6,-1.8 L-1.8,-1.8 Z"
                    fill={accentColor}
                    stroke="#a16207"
                    strokeWidth="0.8"
                  />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white/80 p-1.5 shadow-sm">
            <Lock size={16} className="text-slate-600" />
          </div>
        </div>
      )}
    </div>
  );
}

export const IronBadge = (props: BadgeProps) => (
  <ShieldBadge
    {...props}
    baseColor="#f59e0b"
    darkColor="#d97706"
    lightColor="#facc15"
    accentColor="#fef3c7"
  />
);

export const BronzeBadge = (props: BadgeProps) => (
  <ShieldBadge
    {...props}
    baseColor="#f97316"
    darkColor="#c2410c"
    lightColor="#fb7185"
    accentColor="#fecdd3"
  />
);

export const SilverBadge = (props: BadgeProps) => (
  <ShieldBadge
    {...props}
    baseColor="#16a34a"
    darkColor="#166534"
    lightColor="#4ade80"
    accentColor="#bbf7d0"
    stars={1}
  />
);

export const GoldBadge = (props: BadgeProps) => (
  <ShieldBadge
    {...props}
    baseColor="#2563eb"
    darkColor="#1e40af"
    lightColor="#60a5fa"
    accentColor="#fde047"
    stars={2}
  />
);

export const PlatinumBadge = (props: BadgeProps) => (
  <ShieldBadge
    {...props}
    baseColor="#be123c"
    darkColor="#9f1239"
    lightColor="#f43f5e"
    accentColor="#facc15"
    stars={3}
  />
);
