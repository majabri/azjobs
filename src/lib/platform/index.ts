/**
 * Platform Layer — Shared utilities used across all feature domains.
 * These are generic utilities with NO feature-specific logic.
 */

export { default as CacheManager } from "./cacheManager";
export { handleError, safeJsonParse, withTimeout } from "./errorHandling";
export { default as safeAsync } from "./safeAsync";
export { sanitizeURL } from "./urlUtils";
export { validateEmail, validatePhone, validateUrl } from "./validation";
export { cn } from "./utils";
