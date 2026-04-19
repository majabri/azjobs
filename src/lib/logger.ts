/**
 * Production-safe logger.
 *
 * In development (Vite dev server) all levels are forwarded to the browser
 * console so that debugging stays frictionless.
 *
 * In production, console calls are suppressed and errors are forwarded to
 * Sentry (when VITE_SENTRY_DSN is set).
 */

import { captureError } from "@/lib/sentry";

const isDev = import.meta.env.DEV;

export const logger = {
  /** Informational messages (replaces console.log) */
  info: (message: string, ...args: unknown[]): void => {
    if (isDev) console.log(message, ...args);
  },

  /** Warnings about non-fatal issues (replaces console.warn) */
  warn: (message: string, ...args: unknown[]): void => {
    if (isDev) console.warn(message, ...args);
  },

  /** Error messages — forwarded to Sentry in production */
  error: (message: string, ...args: unknown[]): void => {
    if (isDev) console.error(message, ...args);
    // Forward to Sentry — no-op if VITE_SENTRY_DSN is not set
    const errorArg = args.find((a) => a instanceof Error);
    captureError(errorArg ?? new Error(message), { extra: args });
  },

  /** Verbose debug output */
  debug: (message: string, ...args: unknown[]): void => {
    if (isDev) console.debug(message, ...args);
  },
};

export default logger;
