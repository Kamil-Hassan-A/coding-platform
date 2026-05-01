import { Outlet } from "react-router-dom";
import { LayoutGrid, Award, Clock, Users } from "lucide-react";
import Sidebar from "./Sidebar";
import type { SidebarItem } from "../../types/layout";

export type DashboardLayoutProps = {
  role: "admin" | "candidate";
};

const ADMIN_MENU: SidebarItem[] = [
  { path: "/admin/dashboard", label: "Dashboard", icon: <LayoutGrid size={15} strokeWidth={2} /> },
  { path: "/admin/candidates", label: "Candidates", icon: <Users size={15} strokeWidth={2} /> },
];

const CANDIDATE_MENU: SidebarItem[] = [
  { path: "/candidate/dashboard", label: "Dashboard", icon: <LayoutGrid size={15} strokeWidth={2} /> },
  { path: "/candidate/badges", label: "Badges", icon: <Award size={15} strokeWidth={2} /> },
  { path: "/candidate/scores", label: "Past Assessments", icon: <Clock size={15} strokeWidth={2} /> },
];

export default function DashboardLayout({ role }: DashboardLayoutProps) {
  const menuItems = role === "admin" ? ADMIN_MENU : CANDIDATE_MENU;
  
  return (
    <div className="flex h-screen w-full overflow-hidden bg-admin-bg text-admin-text text-[14px] font-['Segoe_UI',sans-serif]">
      <Sidebar items={menuItems} />
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
