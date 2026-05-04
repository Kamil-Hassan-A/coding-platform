import type { ReactNode } from "react";

export interface SidebarItem {
  path: string;
  label: string;
  icon?: ReactNode;
}

export interface SidebarProps {
  items: SidebarItem[];
}
