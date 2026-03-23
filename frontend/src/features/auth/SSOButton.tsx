type SSOButtonProps = {
  onClick: () => void;
  loading: boolean;
};

const SSOButton = ({ onClick, loading }: SSOButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        fontSize: 14,
        color: "#374151",
        fontWeight: 500,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
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
