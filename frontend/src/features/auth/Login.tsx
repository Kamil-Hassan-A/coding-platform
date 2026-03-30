import { useState } from "react";
import { useNavigate } from "react-router-dom";

import SSOButton from "./SSOButton";
import { loginWithCredentials, loginWithSSO } from "./authService";
import type { User } from "../../types/user";

const getRedirectPathByRole = (user: User): string => {
  if (user.role === "admin") return "/admin/dashboard";
  return "/candidate/dashboard";
};

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialLogin = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await loginWithCredentials(email, password);
      navigate(getRedirectPathByRole(user), { replace: true });
    } catch {
      setError("Login failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSSOLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const user = await loginWithSSO();
      navigate(getRedirectPathByRole(user), { replace: true });
    } catch {
      setError("SSO login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[url('/assets/login-bg.png')] bg-cover bg-center bg-no-repeat p-6"
    >
      {/* Dark overlay to make background crisp and card readable */}
      <div className="absolute inset-0 z-0 bg-black/40 backdrop-blur-sm" />

      {/* Card sits above overlay */}
      <section className="animate-slide-in relative z-10 flex w-full max-w-[400px] flex-col gap-5 rounded-2xl border border-white/40 bg-white/95 px-9 py-10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* Brand */}
        <div className="mb-8 text-center">
          <img src="/indium-logo.png" alt="Indium" className="mx-auto h-10" />
        </div>

        {/* Form */}
        <form onSubmit={handleCredentialLogin}>
          {/* Username */}
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="Username"
            required
            className="mb-3.5 w-full rounded-xl border border-gray-200 bg-white/80 px-3.5 py-3 text-[14px] outline-none transition-all placeholder:text-gray-400 hover:border-admin-orange/50 focus:border-admin-orange focus:bg-white focus:ring-4 focus:ring-admin-orange/10"
          />

          {/* Password */}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="Password"
            required
            className="mb-2 w-full rounded-xl border border-gray-200 bg-white/80 px-3.5 py-3 text-[14px] outline-none transition-all placeholder:text-gray-400 hover:border-admin-orange/50 focus:border-admin-orange focus:bg-white focus:ring-4 focus:ring-admin-orange/10"
          />

          {/* Forgot password */}
          <div className="mb-5 text-right">
            <span className="cursor-pointer text-[12px] text-admin-orange">
              Forgot password?
            </span>
          </div>

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading}
            className="mb-4 w-full rounded-xl border-none bg-gradient-to-br from-admin-orange to-orange-600 p-[13px] text-[15px] font-semibold text-white shadow-admin-orange/20 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-admin-orange/40 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-admin-orange/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-[3px] border-white/30 border-t-white"></span>
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="mb-3.5 text-center text-[11px] tracking-[1px] text-gray-400">
          OR CONTINUE WITH
        </div>

        {/* SSO */}
        <SSOButton onClick={handleSSOLogin} loading={loading} />

        {/* Error */}
        {error && (
          <div className="mt-3 text-center text-[13px] text-red-600">
            {error}
          </div>
        )}

        {/* Footer */}
        <p className="mt-4 text-center text-[11px] text-gray-400">
          By signing in, you agree to our Terms & Privacy Policy
        </p>
      </section>
    </div>
  );
};

export default Login;
