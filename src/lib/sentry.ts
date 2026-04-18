/**
 * Sentry error tracking initialisation for iCareerOS.
 *
 * Import this module once at the top of src/main.tsx (before React renders).
 * It is a no-op when VITE_SENTRY_DSN is not set (local dev without Sentry).
 *
 * Environment variables required in production:
 *   VITE_SENTRY_DSN      — Sentry project DSN (from sentry.io project settings)
 *
 * Optional:
 *   VITE_APP_VERSION     — release version tag (e.g. "1.2.3") for source maps
 */
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry(): void {
  if (!dsn) {
    // No DSN → skip (safe for local dev and preview deployments)
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // "development" | "production"
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "unknown",

    // Capture 100% of performance transactions in production.
    // Lower this (e.g. 0.1) once traffic grows.
    tracesSampleRate: 1.0,

    // Session replays: 10% of sessions, 100% of sessions with an error.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
}

/**
 * Capture an exception with optional extra context.
 * Use this instead of logger.error for errors that should always reach Sentry
 * (even in production where logger is silenced).
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Identify the current user for Sentry session tracking.
 * Call this after successful login.
 */
export function identifyUser(userId: string, email?: string): void {
  Sentry.setUser({ id: userId, email });
}

/**
 * Clear the Sentry user identity on logout.
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

export default Sentry;
