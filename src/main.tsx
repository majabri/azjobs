import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./shell/App.tsx";
import "./index.css";

// Initialize Sentry error tracking (Phase 6 — Observability)
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV || "development",
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    release: import.meta.env.VITE_APP_VERSION || "unknown",
    attachStacktrace: true,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
