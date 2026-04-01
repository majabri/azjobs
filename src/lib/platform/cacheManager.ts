// cacheManager.ts

/**
 * A simple cache manager to handle caching utilities.
 */
class CacheManager {
    private cache: Map<string, any>;
    private cacheValidity: number; // in milliseconds

    constructor(validity: number = 60000) { // default validity is 60 seconds
        this.cache = new Map();
        this.cacheValidity = validity;
    }

    /**
     * Get an item from the cache.
     */
    get(key: string): any | null {
        const cachedItem = this.cache.get(key);
        if (!cachedItem) return null;
        if (Date.now() - cachedItem.timestamp > this.cacheValidity) {
            this.cache.delete(key); // remove expired item
            return null;
        }
        return cachedItem.value;
    }

    /**
     * Set an item in the cache.
     */
    set(key: string, value: any): void {
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    /**
     * Clear the entire cache.
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Validate an item in the cache.
     */
    validate(key: string): boolean {
        return this.get(key) !== null;
    }
}

export default CacheManager;
