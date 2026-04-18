import { logger } from '@/lib/logger';
// safeAsync.ts

/**
 * Execute a function that returns a Promise with retry logic and timeout support.
 *
 * @param fn - The asynchronous function to execute.
 * @param retries - Number of retries for the function execution on failure.
 * @param timeout - Timeout in milliseconds for each function call.
 * @returns The resolved value of the function or throws an error after all retries.
 */
const safeAsync = async (fn: () => Promise<any>, retries: number = 3, timeout: number = 5000): Promise<any> => {
    let attempts = 0;

    while (attempts < retries) {
        try {
            return await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))]);
        } catch (error) {
            attempts++;
            if (attempts === retries) {
                throw error;
            }
            logger.warn(`Attempt ${attempts} failed. Retrying...`);
        }
    }
};

export default safeAsync;
