// src/lib/urlUtils.ts

/**
 * Validates and sanitizes URLs to prevent security issues and XSS attacks.
 */

// Validate if the input is a valid http/https URL using the URL constructor (no regex ReDoS risk)
export function isValidURL(url: string): boolean {
    if (!url) return false;
    try {
        const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        const parsed = new URL(normalized);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

// Sanitize URL to remove unwanted characters
export function sanitizeURL(url: string): string {
    // Create a URL object which will throw an error if invalid
    try {
        const sanitized = new URL(url);
        return sanitized.href; // Return the sanitized URL
    } catch (error) {
        console.error('Invalid URL:', error);
        return '';
    }
}