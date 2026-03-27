import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-admin-bg p-6 text-center font-['Segoe_UI',sans-serif]">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">
            ⚠️
          </div>
          <h1 className="mb-2 text-2xl font-bold text-admin-text">Oops! Something went wrong.</h1>
          <p className="mb-6 max-w-[400px] text-admin-text-muted">
            {this.state.error?.message || "An unexpected error occurred. Please try refreshing the page."}
          </p>
          <button
            className="rounded-xl border-none bg-admin-orange px-6 py-3 font-semibold text-white shadow-lg shadow-admin-orange/20 transition-all hover:-translate-y-0.5 cursor-pointer"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
