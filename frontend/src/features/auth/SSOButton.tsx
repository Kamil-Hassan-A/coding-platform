import type { SSOButtonProps } from './types/auth';

const SSOButton = ({ onClick, loading }: SSOButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className='flex w-full items-center justify-center gap-2.5 rounded-md border border-gray-200 bg-white p-3 text-[14px] font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60'
    >
      <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
      <span>{loading ? "Connecting…" : "Sign in with Microsoft"}</span>
    </button>
  );
};

export default SSOButton;
