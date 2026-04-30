import type { ReactNode } from "react";

export interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface SidebarProps {
  items: SidebarItem[];
  active: string;
  onChange: (id: string) => void;
}
