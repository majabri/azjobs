import { logger } from '@/lib/logger';
// src/lib/urlUtils.ts

/**
 * Validates and sanitizes URLs to prevent security issues and XSS attacks.
 */

// Validate if the input is a valid URL
export function isValidURL(url: string): boolean {
    const pattern = new RegExp('^(https?://)?'+ // protocol
        '((([a-z0-9-]+[.])+[a-z]{2,})|'+ // domain name
        'localhost|'+ // localhost
        '[\\d]{1,3}[.][\\d]{1,3}[.][\\d]{1,3}[.][\\d]{1,3}|'+ // IP address
        '[[]?[a-f0-9:.]+[]]?)+'+ // IPv6
        '(:[\\d]+)?(/[-a-z0-9%_.~+&:?=]*)*'+ // port and path
        '([?][;&a-z0-9%_.~+=-]*)?'+ // query string
        '([#][-a-z0-9_]*)?$','i'); // fragment locator
    return !!pattern.test(url);
}

// Sanitize URL to remove unwanted characters
export function sanitizeURL(url: string): string {
    // Create a URL object which will throw an error if invalid
    try {
        const sanitized = new URL(url);
        return sanitized.href; // Return the sanitized URL
    } catch (error) {
        logger.error('Invalid URL:', error);
        return '';
    }
}