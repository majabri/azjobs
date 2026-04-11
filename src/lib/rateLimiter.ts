/**
 * Client-side rate limiter utility
 * Uses token bucket algorithm to prevent request spamming
 */

export interface RateLimiter {
  canMakeRequest: () => boolean;
  getRemainingRequests: () => number;
  reset: () => void;
}

/**
 * Create a rate limiter instance with token bucket implementation
 *
 * @param maxRequests - Maximum number of requests allowed in the time window
 * @param windowMs - Time window in milliseconds
 * @returns Rate limiter instance with canMakeRequest, getRemainingRequests, and reset methods
 *
 * @example
 * const limiter = createRateLimiter(5, 60000); // 5 requests per minute
 * if (limiter.canMakeRequest()) {
 *   // Make API call
 * } else {
 *   // Show rate limit warning
 * }
 */
export const createRateLimiter = (
  maxRequests: number,
  windowMs: number
): RateLimiter => {
  let tokens = maxRequests;
  let lastRefillTime = Date.now();

  /**
   * Refill tokens based on elapsed time
   */
  const refillTokens = (): void => {
    const now = Date.now();
    const timePassed = now - lastRefillTime;

    // Calculate how many tokens to add based on time passed
    const tokensToAdd = (timePassed / windowMs) * maxRequests;

    // Update tokens (cap at maxRequests)
    tokens = Math.min(maxRequests, tokens + tokensToAdd);
    lastRefillTime = now;
  };

  /**
   * Check if a request can be made and consume a token if allowed
   */
  const canMakeRequest = (): boolean => {
    refillTokens();

    if (tokens >= 1) {
      tokens -= 1;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[RateLimiter] Request allowed. Remaining: ${Math.floor(tokens)}`);
      }
      return true;
    }

    if (process.env.NODE_ENV === 'development') {
      console.warn('[RateLimiter] Rate limit exceeded');
    }
    return false;
  };

  /**
   * Get the number of remaining requests available
   */
  const getRemainingRequests = (): number => {
    refillTokens();
    return Math.floor(tokens);
  };

  /**
   * Reset the rate limiter to initial state
   */
  const reset = (): void => {
    tokens = maxRequests;
    lastRefillTime = Date.now();
    if (process.env.NODE_ENV === 'development') {
      console.log('[RateLimiter] Reset to max requests:', maxRequests);
    }
  };

  return {
    canMakeRequest,
    getRemainingRequests,
    reset,
  };
};

/**
 * Pre-configured rate limiters for common use cases
 */
export const RateLimiters = {
  /** Standard API rate limiter: 10 requests per second */
  api: () => createRateLimiter(10, 1000),

  /** Search rate limiter: 5 searches per second */
  search: () => createRateLimiter(5, 1000),

  /** Job application rate limiter: 3 applications per minute */
  jobApplication: () => createRateLimiter(3, 60000),

  /** Resume update rate limiter: 1 update per 5 seconds */
  resumeUpdate: () => createRateLimiter(1, 5000),

  /** Cover letter generation rate limiter: 2 generations per minute */
  coverLetterGeneration: () => createRateLimiter(2, 60000),

  /** Generic message rate limiter: prevents message spam (1 per second) */
  message: () => createRateLimiter(1, 1000),
};

export default createRateLimiter;
