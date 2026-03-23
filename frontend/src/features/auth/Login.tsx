import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import SSOButton from "./SSOButton";
import { loginWithCredentials, loginWithSSO } from "./authService";
import type { User } from "../../types/user";

const getRedirectPathByRole = (user: User): string => {
  if (user.role === "admin") return "/admin/dashboard";
  return "/dashboard";
};

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleCredentialLogin = async (e: FormEvent) => {
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

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    border: `1px solid ${focusedField === field ? "#f97316" : "#e5e7eb"}`,
    borderRadius: 6,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundImage: "url('/assets/login-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Card */}
      <section
        style={{
          background: "#ffffff",
          borderRadius: 8,
          padding: "40px 36px",
          width: 400,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/indium-logo.png" alt="Indium" style={{ height: 40 }} />
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
            style={{ ...inputStyle("username"), marginBottom: 14 }}
            onFocus={() => setFocusedField("username")}
            onBlur={() => setFocusedField(null)}
          />

          {/* Password */}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="Password"
            required
            style={{ ...inputStyle("password"), marginBottom: 8 }}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
          />

          {/* Forgot password */}
          <div style={{ textAlign: "right", marginBottom: 20 }}>
            <span
              style={{
                fontSize: 12,
                color: "#f97316",
                cursor: "pointer",
              }}
            >
              Forgot password?
            </span>
          </div>

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: 13,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: 16,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#9ca3af",
            letterSpacing: 1,
            marginBottom: 14,
          }}
        >
          OR CONTINUE WITH
        </div>

        {/* SSO */}
        <SSOButton onClick={handleSSOLogin} loading={loading} />

        {/* Error */}
        {error && (
          <div
            style={{
              color: "#dc2626",
              fontSize: 13,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            textAlign: "center",
            marginTop: 16,
          }}
        >
          By signing in, you agree to our Terms & Privacy Policy
        </p>
      </section>
    </main>
  );
};

export default Login;