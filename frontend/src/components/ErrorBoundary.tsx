import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#f5f6fa]">
          <h2 className="text-[#111] mb-3">Something went wrong.</h2>
          <button onClick={() => window.location.href = "/login"} className="bg-admin-orange text-white border-0 rounded-lg py-3 px-7 font-bold cursor-pointer text-sm">
            Return to Login
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
