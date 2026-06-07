import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback. If omitted, the default friendly UI is used. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary. Catches render errors in any child component and
 * shows a friendly fallback UI instead of a white screen.
 *
 * Note: does NOT catch errors in async callbacks, event handlers, or
 * server-function calls — those should be handled via try/catch + toast.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught:", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  goHome = () => {
    if (typeof window !== "undefined") window.location.assign("/");
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        dir="rtl"
        className="min-h-[60vh] flex items-center justify-center px-4 py-10 bg-background"
      >
        <div className="max-w-md w-full text-center rounded-2xl border border-border bg-card/60 p-6 shadow-lg">
          <div className="mx-auto h-14 w-14 grid place-content-center rounded-full bg-amber-500/10 text-amber-400 mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            אופס, משהו השתבש
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            רכיב באפליקציה נתקל בשגיאה. אפשר לנסות לטעון מחדש את האזור או לחזור למסך הראשי.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-3 text-[11px] text-left text-red-300 bg-zinc-950 border border-zinc-800 rounded-md p-2 overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" />
              נסה שוב
            </button>
            <button
              onClick={this.reload}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-neon hover:text-neon"
            >
              טען מחדש
            </button>
            <button
              onClick={this.goHome}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-neon hover:text-neon"
            >
              <Home className="h-4 w-4" />
              מסך ראשי
            </button>
          </div>
        </div>
      </div>
    );
  }
}
