/**
 * Production-safe logger.
 *
 * In development (Vite dev server) all levels are forwarded to the browser
 * console so that debugging stays frictionless.
 *
 * In production the console calls are suppressed.  When Sentry is wired up
 * (Phase 4) logger.error() will forward to Sentry.captureException/Message.
 */

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

  /** Error messages — add Sentry.captureException here in Phase 4 */
  error: (message: string, ...args: unknown[]): void => {
    if (isDev) console.error(message, ...args);
    // TODO Phase 4: Sentry.captureException / Sentry.captureMessage
  },

  /** Verbose debug output */
  debug: (message: string, ...args: unknown[]): void => {
    if (isDev) console.debug(message, ...args);
  },
};

export default logger;
