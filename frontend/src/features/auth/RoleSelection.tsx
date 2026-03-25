import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ─── Indium brand tokens ────────────────────────────────────────────────────
const ORANGE = "#F97316";
const ORANGE_DARK = "#EA6C0A";
const BG = "#0A0A0A";
const SURFACE = "#141414";
const BORDER = "#2A2A2A";

export default function RoleSelection() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<"candidate" | "admin" | null>(null);

  const handleEnter = (role: "candidate" | "admin") => {
    localStorage.setItem("test_role", role);
    navigate("/auth/login");
  };

  return (
    <div style={styles.root}>
      {/* Ambient glow blobs */}
      <div style={styles.blobLeft} />
      <div style={styles.blobRight} />

      {/* Grid texture overlay */}
      <div style={styles.grid} />

      <div style={styles.container}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <img
            src="/indium-logo2.png"
            alt="Indium Logo"
            style={styles.logo}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        <p style={styles.tagline}>Who are you signing in as?</p>

        {/* Cards */}
        <div style={styles.cardsRow}>
          {/* Candidate Card */}
          <button
            style={{
              ...styles.card,
              ...(hovered === "candidate" ? styles.cardHovered : {}),
              borderColor: hovered === "candidate" ? ORANGE : BORDER,
            }}
            onMouseEnter={() => setHovered("candidate")}
            onMouseLeave={() => setHovered(null)}
            onClick={() => void handleEnter("candidate")}
          >
            <div
              style={{
                ...styles.cardIcon,
                background:
                  hovered === "candidate"
                    ? `linear-gradient(135deg, ${ORANGE}22, ${ORANGE}44)`
                    : "#1E1E1E",
                border: `1px solid ${hovered === "candidate" ? ORANGE + "55" : "#333"}`,
              }}
            >
              <CandidateIcon active={hovered === "candidate"} />
            </div>

            <h2 style={styles.cardTitle}>Candidate</h2>
            <p style={styles.cardDesc}>
              Take assessments, view your scores, and track your progress across
              campaigns.
            </p>

            <div
              style={{
                ...styles.cardCta,
                background: hovered === "candidate" ? ORANGE : "transparent",
                color: hovered === "candidate" ? "#fff" : ORANGE,
                border: `1.5px solid ${ORANGE}`,
              }}
            >
              Enter as Candidate
              <ArrowRight />
            </div>

            <ul style={styles.featureList}>
              {["Live assessments", "Past score history", "Skill feedback"].map(
                (f) => (
                  <li key={f} style={styles.featureItem}>
                    <CheckDot active={hovered === "candidate"} />
                    {f}
                  </li>
                )
              )}
            </ul>
          </button>

          {/* Divider */}
          <div style={styles.dividerCol}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerOr}>OR</span>
            <div style={styles.dividerLine} />
          </div>

          {/* Admin Card */}
          <button
            style={{
              ...styles.card,
              ...(hovered === "admin" ? styles.cardHovered : {}),
              borderColor: hovered === "admin" ? ORANGE : BORDER,
            }}
            onMouseEnter={() => setHovered("admin")}
            onMouseLeave={() => setHovered(null)}
            onClick={() => void handleEnter("admin")}
          >
            <div
              style={{
                ...styles.cardIcon,
                background:
                  hovered === "admin"
                    ? `linear-gradient(135deg, ${ORANGE}22, ${ORANGE}44)`
                    : "#1E1E1E",
                border: `1px solid ${hovered === "admin" ? ORANGE + "55" : "#333"}`,
              }}
            >
              <AdminIcon active={hovered === "admin"} />
            </div>

            <h2 style={styles.cardTitle}>Admin / Recruiter</h2>
            <p style={styles.cardDesc}>
              Manage campaigns, review candidates, configure credentials and
              proctoring settings.
            </p>

            <div
              style={{
                ...styles.cardCta,
                background: hovered === "admin" ? ORANGE : "transparent",
                color: hovered === "admin" ? "#fff" : ORANGE,
                border: `1.5px solid ${ORANGE}`,
              }}
            >
              Enter as Admin
              <ArrowRight />
            </div>

            <ul style={styles.featureList}>
              {[
                "Campaign management",
                "Candidate credentials",
                "Analytics & reports",
              ].map((f) => (
                <li key={f} style={styles.featureItem}>
                  <CheckDot active={hovered === "admin"} />
                  {f}
                </li>
              ))}
            </ul>
          </button>
        </div>

        <p style={styles.footer}>
          © {new Date().getFullYear()} Indium Software · Secure Platform
        </p>
      </div>
    </div>
  );
}

// ─── Inline SVG icons ────────────────────────────────────────────────────────
function CandidateIcon({ active }: { active: boolean }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="8"
        r="4"
        stroke={active ? ORANGE : "#888"}
        strokeWidth="1.8"
      />
      <path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke={active ? ORANGE : "#888"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AdminIcon({ active }: { active: boolean }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke={active ? ORANGE : "#888"}
        strokeWidth="1.8"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke={active ? ORANGE : "#888"}
        strokeWidth="1.8"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1.5"
        stroke={active ? ORANGE : "#888"}
        strokeWidth="1.8"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1.5"
        stroke={active ? ORANGE : "#888"}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginLeft: 8 }}
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckDot({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ marginRight: 8, flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="6" fill={active ? ORANGE + "22" : "#222"} />
      <path
        d="M4 7l2 2 4-4"
        stroke={active ? ORANGE : "#555"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: BG,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },
  blobLeft: {
    position: "absolute",
    left: "-200px",
    top: "10%",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${ORANGE}18 0%, transparent 70%)`,
    pointerEvents: "none",
  },
  blobRight: {
    position: "absolute",
    right: "-200px",
    bottom: "5%",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${ORANGE}10 0%, transparent 70%)`,
    pointerEvents: "none",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `linear-gradient(${BORDER} 1px, transparent 1px), linear-gradient(90deg, ${BORDER} 1px, transparent 1px)`,
    backgroundSize: "60px 60px",
    opacity: 0.18,
    pointerEvents: "none",
  },
  container: {
    position: "relative",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 24px",
    maxWidth: "960px",
    width: "100%",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "32px",
    width: "100%",
  },
  logo: { height: "36px" },
  logoText: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "2px",
    fontFamily: "'DM Sans', sans-serif",
  },
  logoDivider: {
    width: "1px",
    height: "28px",
    background: "#444",
  },
  logoSub: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#666",
    letterSpacing: "3px",
    textTransform: "uppercase",
  },
  tagline: {
    fontSize: "15px",
    color: "#777",
    marginBottom: "48px",
    letterSpacing: "0.5px",
  },
  cardsRow: {
    display: "flex",
    alignItems: "stretch",
    gap: "0",
    width: "100%",
    justifyContent: "center",
  },
  card: {
    flex: "1",
    maxWidth: "380px",
    background: SURFACE,
    border: `1.5px solid ${BORDER}`,
    borderRadius: "20px",
    padding: "36px 32px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
    textAlign: "left",
    transition: "all 0.25s ease",
    outline: "none",
  },
  cardHovered: {
    transform: "translateY(-4px)",
    boxShadow: `0 24px 64px ${ORANGE}18`,
    background: "#181818",
  },
  cardIcon: {
    width: "68px",
    height: "68px",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.25s ease",
  },
  cardTitle: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
  },
  cardDesc: {
    fontSize: "14px",
    color: "#888",
    lineHeight: "1.6",
    margin: 0,
  },
  cardCta: {
    display: "flex",
    alignItems: "center",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    transition: "all 0.2s ease",
    marginTop: "4px",
    cursor: "pointer",
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "8px 0 0",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    fontSize: "13px",
    color: "#999",
  },
  dividerCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 28px",
    gap: "12px",
    minWidth: "60px",
  },
  dividerLine: {
    flex: 1,
    width: "1px",
    background: BORDER,
  },
  dividerOr: {
    fontSize: "12px",
    color: "#555",
    fontWeight: 600,
    letterSpacing: "1px",
  },
  footer: {
    marginTop: "48px",
    fontSize: "12px",
    color: "#444",
    letterSpacing: "0.5px",
  },
};
