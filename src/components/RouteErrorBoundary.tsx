import React, { Component } from "react";
import type { ReactNode } from "react";
import { logger } from "@/lib/logger";
import { captureError } from "@/lib/sentry";

interface Props {
  children: ReactNode;
  routeName: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Per-route error boundary.
 *
 * Wraps individual route subtrees so a crash in one route does not
 * take down the entire app.  Errors are forwarded to the logger
 * (and in Phase 4, to Sentry).
 */
class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message ?? String(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(
      `[RouteErrorBoundary] Error in "${this.props.routeName}":`,
      error,
      errorInfo,
    );
    // Send to Sentry with the React component stack for easier triage.
    captureError(error, {
      routeName: this.props.routeName,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-xl font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground">
              An error occurred in <strong>{this.props.routeName}</strong>.
            </p>
            {this.state.errorMessage && (
              <pre className="text-left text-xs bg-muted rounded-md p-3 overflow-auto max-h-32 text-foreground border border-border">
                {this.state.errorMessage}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() =>
                  this.setState({ hasError: false, errorMessage: "" })
                }
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm hover:opacity-90 transition-opacity"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 transition-opacity"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
