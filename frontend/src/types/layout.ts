export interface SidebarItem {
  id: string;
  label: string;
}

export interface SidebarProps {
  items: SidebarItem[];
  active: string;
  onChange: (id: string) => void;
}
