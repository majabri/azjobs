/**
 * Shared Utils — Re-export of platform utilities.
 * Only generic, feature-agnostic utilities belong here.
 */
export { cn } from "@/lib/platform/utils";
export { handleError, safeJsonParse, withTimeout } from "@/lib/platform/errorHandling";
export { default as CacheManager } from "@/lib/platform/cacheManager";
export { sanitizeURL } from "@/lib/platform/urlUtils";
export { isValidEmail, isValidPhone, isValidURL } from "@/lib/platform/validation";
export { default as safeAsync } from "@/lib/platform/safeAsync";
