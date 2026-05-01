import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Users } from 'lucide-react';
import type { SidebarProps } from '../../types/layout';
import { logout } from '../../features/auth/authService';
import useUserStore from '../../stores/userStore';

export default function Sidebar({ items }: SidebarProps) {
  const user = useUserStore();
  const location = useLocation();
  const navigate = useNavigate();

  const displayName = user?.name?.trim() ?? '';
  const subtitle = user?.department?.trim() ?? '';
  const initials = (user?.name?.trim()?.[0] || user?.role?.[0] || '').toUpperCase();

  return (
    <aside className='flex w-[220px] shrink-0 flex-col border-r border-admin-border bg-admin-white'>
      <div className='border-b border-admin-border px-5 pb-4 pt-5'>
        <div className='text-[14px] font-extrabold uppercase tracking-[1.5px] text-admin-text'>SkillPulse</div>
        <div className='mt-0.5 text-[10px] font-medium uppercase tracking-[1.5px] text-admin-text-light'>Assessment Platform</div>
      </div>

      <nav className='flex-1 px-2 py-3'>
        <div className='px-3 pb-2 pt-1.5 text-[9px] font-bold uppercase tracking-[1.8px] text-admin-text-light'>Overview</div>
        {items.map(item => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              type='button'
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg border-0 px-3 py-[9px] text-left text-[13px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-orange/40 ${
                isActive
                  ? 'bg-admin-orange-light font-bold text-admin-orange'
                  : 'bg-transparent font-medium text-admin-text-muted'
              }`}
            >
              <span className={`shrink-0 ${isActive ? 'text-admin-orange' : 'text-admin-text-light'}`}>
                {item.icon ?? <Users size={15} strokeWidth={2} />}
              </span>
              {item.label}
              {isActive && <span className='ml-auto text-[16px] text-admin-orange'></span>}
            </button>
          );
        })}
      </nav>

      <div className='border-t border-admin-border px-4 py-3.5'>
        <div className='flex items-center gap-2.5'>
          <div className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-admin-orange text-[12px] font-bold text-admin-white'>{initials}</div>
          <div className='min-w-0 flex-1'>
            <div className='truncate text-[12px] font-bold text-admin-text'>{displayName}</div>
            <div className='truncate text-[11px] text-admin-text-light'>{subtitle}</div>
          </div>
          <button
            type='button'
            onClick={() => void logout()}
            title='Sign out'
            className='ml-auto shrink-0 rounded-md p-1.5 text-admin-text-light transition-colors hover:bg-red-50 hover:text-red-500'
          >
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
