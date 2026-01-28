"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Error Boundary component to catch and handle React errors gracefully.
 * Prevents the entire app from crashing when a component throws an error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console (in production, you'd send to error reporting service)
    console.error("Error caught by boundary:", error);
    console.error("Component stack:", errorInfo.componentStack);
    
    this.setState({
      errorInfo: errorInfo.componentStack || null,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            
            <h1 className="mb-2 text-xl font-bold text-slate-900">Something went wrong</h1>
            <p className="mb-4 text-sm text-slate-600">
              An unexpected error occurred. Please try again or contact support if the problem persists.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mb-4 rounded-lg bg-slate-100 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  Error Details
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-600">
                  {this.state.error.message}
                  {this.state.errorInfo && (
                    <>
                      {"\n\nComponent Stack:"}
                      {this.state.errorInfo}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-lg border-2 border-slate-300 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-100"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white active:bg-slate-800"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
