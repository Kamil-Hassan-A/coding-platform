import { useState } from "react";
import { LayoutGrid, Users } from "lucide-react";

import Sidebar from "../../components/layout/Sidebar";
import AdminDashboardOverview from "./components/AdminDashboardOverview";
import AdminCandidatesView from "./components/AdminCandidatesView";

const NAV = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutGrid size={15} strokeWidth={2} />,
  },
  {
    id: "candidates",
    label: "Candidates",
    icon: <Users size={15} strokeWidth={2} />,
  },
];

export default function AdminDashboard() {
  const [page, setPage] = useState<"dashboard" | "candidates">("dashboard");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-admin-bg text-admin-text text-[14px]">
      <Sidebar
        items={NAV}
        active={page}
        onChange={(id) => setPage(id as "dashboard" | "candidates")}
      />

      <main className="flex-1 overflow-y-auto px-8 py-7">
        {page === "dashboard" && <AdminDashboardOverview />}
        {page === "candidates" && <AdminCandidatesView />}
      </main>
    </div>
  );
}
