import { useQuery } from "@tanstack/react-query";

import { logout } from "../auth/authService";
import useUserStore from "../../stores/userStore";
import SkillsList from "./SkillsList";
import { STAT_CARDS, getDashboardStats } from "./dashboardService";

const initials = (name: string): string =>
  name
    .split(" ")
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const Dashboard = () => {
  const name = useUserStore((state) => state.name);
  const role = useUserStore((state) => state.role);
  const department = useUserStore((state) => state.department);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
  });

  const handleSignOut = async (): Promise<void> => {
    await logout();
  };

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const displayName = name ?? "User";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f0f2f5" }}>
      <nav
        style={{
          background: "#0d1117",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src="/indium-logo2.png" alt="Indium" style={{ height: 28 }} />
          <span
            style={{
              background: "rgba(249,115,22,0.15)",
              color: "#f97316",
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Dashboard
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{displayName}</div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>
              {role ?? "candidate"} · {department ?? "Indium Software"}
            </div>
          </div>

          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#f97316",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {initials(displayName)}
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            style={{
              border: "1px solid #334155",
              color: "#94a3b8",
              background: "transparent",
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div
        style={{
          flex: 1,
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#0d1117" }}>Admin Dashboard</span>
          <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>{today}</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
          }}
        >
          {STAT_CARDS.map(({ key, label }) => (
            <div
              key={key}
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, marginBottom: 8 }}>
                {label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#0d1117" }}>
                {isLoading ? 0 : (data?.[key] ?? 0)}
              </div>
            </div>
          ))}
        </div>

        <SkillsList />
      </div>
    </div>
  );
};

export default Dashboard;
