import { logger } from '@/lib/logger';
// errorHandling.ts

// Centralized error handling utility
export function handleError(error: any): void {
    logger.error('An error occurred:', error);
    // Additional logging or actions can be added here
}

// Safe JSON parsing utility
export function safeJsonParse(jsonString: string): any {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        handleError(error);
        return null; // Or some default value
    }
}

// Timeout utility for executing functions with a timeout
export function withTimeout<T>(fn: () => T, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Operation timed out.')), timeout);
        try {
            const result = fn();
            clearTimeout(timer);
            resolve(result);
        } catch (error) {
            clearTimeout(timer);
            reject(error);
        }
    });
}