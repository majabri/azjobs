/**
 * Centralized route path constants.
 *
 * Use these instead of hard-coding path strings in components so that a
 * single edit here is enough to update every navigation call across the app.
 */

/** Canonical login page. Always navigate here for sign-in. */
export const AUTH_LOGIN = "/auth/login";
export const AUTH_SIGNUP = "/auth/signup";

/**
 * Legacy auth root — kept only for the backward-compatibility redirect in
 * src/pages/Auth.tsx.  Do NOT navigate to this directly; use AUTH_LOGIN.
 */
export const AUTH_ROOT = "/auth";
