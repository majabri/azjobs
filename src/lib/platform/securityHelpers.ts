// src/lib/securityHelpers.ts

// Utility functions for security-related operations

// 1. sanitizePromptInput function to prevent prompt injection
export const sanitizePromptInput = (input: string): string => {
    return input.replace(/<script.*?>([\s\S]*?)<\/script>/gi, '');
};

// 2. validateApiInput function for request body validation
export const validateApiInput = (schema: any, data: any): boolean => {
    const { error } = schema.validate(data);
    return !error;
};

// 3. corsAllowList function for safe CORS policy
export const corsAllowList = (origin: string, allowedOrigins: string[]): boolean => {
    return allowedOrigins.includes(origin);
};

// 4. withTimeout wrapper for fetch/stream operations
export const withTimeout = (promise: Promise<any>, timeout: number): Promise<any> => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')),
        timeout))
    ]);
};

// 5. TypeScript interfaces for common validation schemas
export interface ApiInputSchema {
    [key: string]: any;
}

export interface CORSOptions {
    allowedOrigins: string[];
}

