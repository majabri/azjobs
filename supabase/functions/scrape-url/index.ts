/**
 * scrape-url — Edge Function
 *
 * Fetches a job posting URL and returns its content as Markdown.
 * Strategy:
 *   1. Try Firecrawl (best quality, structured Markdown).
 *   2. If Firecrawl fails (no key, quota exceeded, rate-limited, etc.)
 *      fall back to a direct HTTP fetch + lightweight HTML → plain-text
 *      extraction so users always get something useful.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { validatePublicUrl } from "../_shared/validate-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags and collapse whitespace into readable plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Assess whether extracted text looks like a real job description. */
function looksLikeJobDescription(text: string): boolean {
  const lower = text.toLowerCase();
  const jobKeywords = [
    "responsibilities",
    "requirements",
    "qualifications",
    "experience",
    "skills",
    "position",
    "role",
    "job",
    "team",
    "apply",
  ];
  const hits = jobKeywords.filter((kw) => lower.includes(kw)).length;
  return text.length > 200 && hits >= 2;
}

// ---------------------------------------------------------------------------
// Scraping strategies
// ---------------------------------------------------------------------------

interface ScrapeResult {
  success: boolean;
  markdown?: string;
  title?: string;
  error?: string;
  extractionFailed?: boolean;
  partialText?: string;
}

/** Primary: Firecrawl — returns structured Markdown. */
async function scrapeWithFirecrawl(
  url: string,
  apiKey: string
): Promise<ScrapeResult> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Surface quota/credits error distinctly so the fallback can proceed
    const isQuotaError =
      res.status === 402 ||
      body.toLowerCase().includes("insufficient credits") ||
      body.toLowerCase().includes("upgrade your plan");
    return {
      success: false,
      error: isQuotaError
        ? "firecrawl_quota"
        : `Firecrawl HTTP ${res.status}`,
    };
  }

  const data = await res.json();
  const markdown: string =
    data?.data?.markdown ?? data?.markdown ?? "";

  if (!markdown || markdown.length < 100) {
    return { success: false, error: "firecrawl_empty" };
  }

  return { success: true, markdown, title: data?.data?.metadata?.title };
}

/** Fallback: direct HTTP fetch + HTML → plain text. */
async function scrapeDirectly(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; iCareerOS/1.0; +https://icareeros.com)",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    return {
      success: false,
      error: `Could not fetch the page (HTTP ${res.status}). Please paste the job description manually.`,
      extractionFailed: true,
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    return {
      success: false,
      error: "The page returned a non-HTML response. Please paste the job description manually.",
      extractionFailed: true,
    };
  }

  const html = await res.text();

  // Try to grab <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim();

  // Try to extract <main> or <article> first for cleaner output
  const mainMatch =
    html.match(/<main[\s\S]*?<\/main>/i) ||
    html.match(/<article[\s\S]*?<\/article>/i);
  const rawText = htmlToText(mainMatch?.[0] ?? html);

  if (!rawText || rawText.length < 100) {
    return {
      success: false,
      error:
        "Could not extract meaningful text from this page. Please paste the job description manually.",
      extractionFailed: true,
    };
  }

  const isGoodContent = looksLikeJobDescription(rawText);

  // Trim to a reasonable size for the AI
  const markdown = rawText.slice(0, 8_000);

  if (!isGoodContent) {
    return {
      success: false,
      extractionFailed: true,
      error:
        "The page content doesn't look like a job description. Please paste it manually.",
      partialText: markdown,
    };
  }

  return { success: true, markdown, title };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error: authError } = await supabase.auth.getClaims(token);
  if (authError || !data?.claims) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userId: string = data.claims.sub as string;

  // Rate limit: 10 requests per minute per user
  if (!checkRateLimit(`scrape-url:${userId}`, 10, 60_000)) {
    return new Response(
      JSON.stringify({ success: false, error: "Too many requests – please slow down" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse body
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate URL
  const urlValidation = validatePublicUrl(body.url);
  if (!urlValidation.ok) {
    return new Response(
      JSON.stringify({ success: false, error: urlValidation.error }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const url = urlValidation.url;

  // --- Strategy 1: Firecrawl ---
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (firecrawlKey) {
    try {
      const result = await scrapeWithFirecrawl(url, firecrawlKey);
      if (result.success) {
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Only fall through on quota / empty errors; hard errors propagate too
      if (
        result.error !== "firecrawl_quota" &&
        result.error !== "firecrawl_empty"
      ) {
        // Non-quota failure — still try direct fetch
      }
    } catch (_e) {
      // Network error hitting Firecrawl — fall through to direct fetch
    }
  }

  // --- Strategy 2: Direct HTTP fetch ---
  try {
    const result = await scrapeDirectly(url);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to fetch the URL: ${msg}. Please paste the job description manually.`,
        extractionFailed: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
