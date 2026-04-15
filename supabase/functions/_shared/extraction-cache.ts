/**
 * extraction-cache.ts — Adaptive domain learning for scrape-url
 *
 * Reads and writes to the `domain_extraction_hints` table so the agent
 * gets smarter with every run:
 *
 *  • On load  — fetches the best-known strategy for this domain
 *  • On win   — increments success_count, updates best_strategy + best_selector
 *  • On fail  — increments failure_count, notes the blocking reason
 *
 * Strategies stored (in priority order if a winner is known):
 *   'greenhouse-api' | 'lever-api' | 'smartrecruiters-api' | 'breezy-api'
 *   'ashby-ssr' | 'cheerio:{selector}' | 'html-fetch'
 *   'login-wall' | 'ip-blocked'
 *
 * Runtime: Deno (Supabase Edge Functions)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DomainHint {
  domain: string;
  bestStrategy: string | null;
  bestSelector: string | null;
  successCount: number;
  failureCount: number;
  notes: string | null;
}

export interface ExtractionOutcome {
  success: boolean;
  strategy: string;
  selector?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Supabase admin client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

function getAdminClient() {
  // Import inline to avoid top-level await issues in Deno edge env
  // deno-lint-ignore no-explicit-any
  const { createClient } = (globalThis as any).__supabaseModule ??
    { createClient: null };

  // Fallback: direct import
  return null; // resolved at call site
}

// ---------------------------------------------------------------------------
// Domain normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a URL to a domain key.
 * e.g. https://boards.greenhouse.io/anthropic/jobs/123 → "boards.greenhouse.io"
 */
export function domainKey(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url.slice(0, 100);
  }
}

// ---------------------------------------------------------------------------
// Cache read
// ---------------------------------------------------------------------------

/**
 * Fetch the known hint for a domain.
 * Returns null if no data exists (first time seeing this domain).
 *
 * @param supabaseAdmin  Supabase client with service role key
 * @param domain         Normalized domain key (from domainKey())
 */
export async function getDomainHint(
  supabaseAdmin: any,
  domain: string
): Promise<DomainHint | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("domain_extraction_hints")
      .select("domain, best_strategy, best_selector, success_count, failure_count, notes")
      .eq("domain", domain)
      .maybeSingle();

    if (error || !data) return null;

    return {
      domain: data.domain,
      bestStrategy: data.best_strategy,
      bestSelector: data.best_selector,
      successCount: data.success_count ?? 0,
      failureCount: data.failure_count ?? 0,
      notes: data.notes,
    };
  } catch (e) {
    console.warn("[extraction-cache] getDomainHint error:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache write
// ---------------------------------------------------------------------------

/**
 * Record an extraction outcome for a domain.
 * Uses upsert so first-time domains are inserted automatically.
 *
 * @param supabaseAdmin  Supabase client with service role key
 * @param domain         Normalized domain key
 * @param outcome        What happened (success/failure + which strategy)
 */
export async function recordOutcome(
  supabaseAdmin: any,
  domain: string,
  outcome: ExtractionOutcome
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const baseUpsert: Record<string, unknown> = {
      domain,
      last_seen_at: now,
    };

    if (outcome.success) {
      // On success, update best_strategy + selector + increment counter
      await supabaseAdmin.from("domain_extraction_hints").upsert(
        {
          ...baseUpsert,
          best_strategy: outcome.strategy,
          best_selector: outcome.selector ?? null,
          last_success_at: now,
          notes: outcome.notes ?? null,
          // Increment success_count using SQL expression via RPC
        },
        { onConflict: "domain", ignoreDuplicates: false }
      );

      // Separately increment the counter (upsert can't do this atomically easily)
      await supabaseAdmin.rpc("increment_extraction_success", { p_domain: domain });
    } else {
      await supabaseAdmin.from("domain_extraction_hints").upsert(
        {
          ...baseUpsert,
          last_failure_at: now,
          notes: outcome.notes ?? null,
        },
        { onConflict: "domain", ignoreDuplicates: false }
      );

      await supabaseAdmin.rpc("increment_extraction_failure", { p_domain: domain });
    }
  } catch (e) {
    // Non-fatal — cache write failures never block the main flow
    console.warn("[extraction-cache] recordOutcome error:", e);
  }
}

// ---------------------------------------------------------------------------
// Strategy ranker
// ---------------------------------------------------------------------------

/**
 * Given the known hint for a domain, return the ordered list of strategies
 * the agent should try. Known winners go first.
 *
 * @param hint         Hint from DB (or null if first time)
 * @param defaultOrder Default order to use when no hint exists
 */
export function rankedStrategies(
  hint: DomainHint | null,
  defaultOrder: string[]
): string[] {
  if (!hint?.bestStrategy) return defaultOrder;

  // If a strategy is known to work, put it first
  const winner = hint.bestStrategy;
  const rest = defaultOrder.filter((s) => s !== winner);

  // If the domain is known login-wall or ip-blocked, short-circuit
  if (winner === "login-wall" || winner === "ip-blocked") {
    return [winner]; // only this strategy — will return helpful message immediately
  }

  return [winner, ...rest];
}
