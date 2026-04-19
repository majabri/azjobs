import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./shell/App.tsx";
import "./index.css";
import "./theme.css";
import "./lib/i18n";

// Initialize Sentry before mounting the app so all errors are captured from startup.
// VITE_SENTRY_DSN must be set in Vercel env vars for production.
// If the DSN is absent (local dev without the var), Sentry is a no-op.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV ?? "development",
    // Capture 20% of transactions for performance tracing
    tracesSampleRate: 0.2,
    // Record session replays for 5% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
}

// ThemeProvider is mounted inside App.tsx (within AuthProvider).
// Do NOT wrap here — ThemeContext calls useAuth() and must live below AuthProvider.
createRoot(document.getElementById("root")!).render(<App />);
