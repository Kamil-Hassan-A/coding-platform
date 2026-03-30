import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Segoe UI, sans-serif", background: "#f5f6fa" }}>
          <h2 style={{ color: "#111", marginBottom: 12 }}>Something went wrong.</h2>
          <button onClick={() => window.location.href = "/login"} style={{ background: "#E8620A", color: "#fff", border: "none", borderRadius: 8, padding: "12px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            Return to Login
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
