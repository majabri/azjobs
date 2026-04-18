import axios from 'axios';
import type { FetchOptions, FetchResult } from '../../shared/types/scraper';

// Firecrawl SDK import — requires @firecrawl/sdk to be installed
// Using dynamic import to avoid hard failure if SDK isn't installed yet
let FirecrawlApp: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FirecrawlApp = require('@mendable/firecrawl-js').default;
} catch {
  FirecrawlApp = null;
}

export class ContentFetcher {
  private firecrawl: any;
  private cache: Map<string, FetchResult> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(firecrawlApiKey: string) {
    if (FirecrawlApp && firecrawlApiKey) {
      this.firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey });
    } else {
      console.warn('[Fetcher] Firecrawl SDK not available — falling back to axios only');
      this.firecrawl = null;
    }
  }

  async fetch(options: FetchOptions): Promise<FetchResult> {
    const cached = this.getFromCache(options.url);
    if (cached && this.isFresh(cached)) {
      console.log(`[Fetcher] Cache hit: ${options.url}`);
      return { ...cached, fetchMethod: 'cached' };
    }

    // Strategy 1: Firecrawl
    if (this.firecrawl) {
      try {
        console.log(`[Fetcher] Firecrawl: ${options.url}`);
        const response = await this.firecrawl.scrapeUrl(options.url, {
          formats: ['html'],
          timeout: options.timeout || 30000,
        });

        const result: FetchResult = {
          url: options.url,
          html: response.html || '',
          statusCode: 200,
          fetchMethod: 'firecrawl',
          timestamp: new Date(),
        };

        this.cache.set(options.url, result);
        return result;
      } catch (err) {
        console.warn(`[Fetcher] Firecrawl failed: ${(err as Error).message}`);
      }
    }

    // Strategy 2: Axios
    try {
      console.log(`[Fetcher] Axios: ${options.url}`);
      const response = await axios.get(options.url, {
        timeout: options.timeout || 15000,
        headers: {
          'User-Agent':
            options.userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...options.headers,
        },
        maxRedirects: options.followRedirects !== false ? 5 : 0,
      });

      const result: FetchResult = {
        url: options.url,
        html: response.data,
        statusCode: response.status,
        fetchMethod: 'axios',
        timestamp: new Date(),
      };

      this.cache.set(options.url, result);
      return result;
    } catch (err) {
      console.warn(`[Fetcher] Axios failed: ${(err as Error).message}`);
    }

    // Strategy 3: Return stale cache
    if (cached) {
      console.warn(`[Fetcher] Returning stale cache: ${options.url}`);
      return { ...cached, fetchMethod: 'cached' };
    }

    throw new Error(`[Fetcher] All strategies failed for ${options.url}`);
  }

  private getFromCache(url: string): FetchResult | null {
    return this.cache.get(url) || null;
  }

  private isFresh(result: FetchResult): boolean {
    return Date.now() - result.timestamp.getTime() < this.CACHE_TTL_MS;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
