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
    <div className='flex min-h-screen flex-col bg-slate-100'>
      <nav className='flex h-14 items-center justify-between bg-[#0d1117] px-7'>
        <div className='flex items-center gap-6'>
          <img src='/indium-logo2.png' alt='Indium' className='h-7' />
          <span className='rounded-md bg-[rgba(249,115,22,0.15)] px-3 py-1 text-[12px] font-semibold text-admin-orange'>
            Dashboard
          </span>
        </div>

        <div className='flex items-center gap-3.5'>
          <div className='text-right'>
            <div className='text-[14px] font-semibold text-white'>{displayName}</div>
            <div className='text-[12px] text-slate-400'>
              {role ?? "candidate"} · {department ?? "Indium Software"}
            </div>
          </div>

          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-admin-orange text-[12px] font-bold text-white'>
            {initials(displayName)}
          </div>

          <button
            type='button'
            onClick={handleSignOut}
            className='cursor-pointer rounded-md border border-slate-700 bg-transparent px-3 py-1 text-[12px] text-slate-400'
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className='flex flex-1 flex-col gap-5 px-7 py-6'>
        <div className='flex items-baseline'>
          <span className='text-[20px] font-bold text-[#0d1117]'>Admin Dashboard</span>
          <span className='ml-2 text-[12px] text-slate-400'>{today}</span>
        </div>

        <div className='grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]'>
          {STAT_CARDS.map(({ key, label }) => (
            <div key={key} className='rounded-xl border border-slate-200 bg-white p-5'>
              <div className='mb-2 text-[12px] font-medium text-slate-400'>
                {label}
              </div>
              <div className='text-[30px] font-bold text-[#0d1117]'>
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
