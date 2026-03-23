import React from 'react';

const C = {
  orange:      '#f97316',
  orangeLight: '#fff7ed',
  white:       '#ffffff',
  bg:          '#f8fafc',
  border:      '#e5e7eb',
  text:        '#111827',
  textMuted:   '#6b7280',
  textLight:   '#9ca3af',
};

function SidebarIcon({ id }: { id: string }) {
  if (id === 'dashboard') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

interface SidebarItem {
  id: string;
  label: string;
}

interface SidebarProps {
  items: SidebarItem[];
  active: string;
  onChange: (id: string) => void;
}

export default function Sidebar({ items, active, onChange }: SidebarProps) {
  return (
    <aside style={{ width: 220, flexShrink: 0, background: C.white, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 1.5, color: C.text, textTransform: 'uppercase' }}>SkillPulse</div>
        <div style={{ fontSize: 10, color: C.textLight, letterSpacing: 1.5, marginTop: 2, fontWeight: 500, textTransform: 'uppercase' }}>Assessment Platform</div>
      </div>

      <nav style={{ flex: 1, padding: '12px 8px' }}>
        <div style={{ fontSize: 9, color: C.textLight, letterSpacing: 1.8, fontWeight: 700, padding: '6px 12px 8px', textTransform: 'uppercase' }}>Overview</div>
        {items.map(item => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', background: isActive ? C.orangeLight : 'transparent', color: isActive ? C.orange : C.textMuted, fontWeight: isActive ? 700 : 500, fontSize: 13, marginBottom: 2, transition: 'all 0.15s' }}
            >
              <span style={{ color: isActive ? C.orange : C.textLight, flexShrink: 0 }}><SidebarIcon id={item.id} /></span>
              {item.label}
              {isActive && <span style={{ marginLeft: 'auto', fontSize: 16, color: C.orange }}>›</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.orange, color: C.white, fontWeight: 700, fontSize: 12, display: 'grid', placeItems: 'center', flexShrink: 0 }}>TU</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Platform Admin</div>
            <div style={{ fontSize: 11, color: C.textLight }}>Test User</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
