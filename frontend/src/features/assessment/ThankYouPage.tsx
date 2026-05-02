import { useNavigate } from "react-router-dom";

export default function ThankYouPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-orange p-6 font-['Segoe_UI',sans-serif]">
      <div className="w-full max-w-xl rounded-2xl bg-white p-10 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-5xl text-green-600">
          ✓
        </div>

        <h1 className="mb-3 text-3xl font-extrabold text-admin-text">
          Thank you for attempting the assessment!
        </h1>

        <p className="mb-8 text-[15px] text-admin-text-muted">
          Your responses have been submitted. Results will be reviewed by your administrator.
        </p>

        <button
          onClick={() => navigate("/candidate/dashboard")}
          className="rounded-xl border-none bg-admin-orange px-7 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-admin-orange/30"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
