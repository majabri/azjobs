/**
 * scrape-url — Supabase Edge Function (Deno)
 *
 * Fetches a job posting URL and returns its content as plain text / Markdown.
 *
 * Extraction strategy (cascading — stops at first success):
 *  1. Primary: direct HTTP fetch + lightweight regex HTML stripper (fast, zero deps)
 *  2. Fallback: Cheerio-based structured DOM extraction (handles ATS boards,
 *     JS-heavy pages, and complex layouts that defeat regex stripping)
 *
 * Fetch strategy:
 *  - Attempt 1: full browser headers (Chrome 124 UA)
 *  - Attempt 2 on 403/429: stripped headers (no Sec-* / Cookie pressure)
 *  Both attempts share the same extraction pipeline.
 *
 * Security:
 *  - SSRF protection via validatePublicUrl (blocks private IPs, loopback, etc.)
 *  - Rate limited: 10 requests / minute / user (in-memory, best-effort)
 *  - 15-second per-attempt timeout
 *
 * Response shape:
 *  { success: true,  markdown: string, title?: string, usedFallback?: boolean }
 *  { success: false, error: string, extractionFailed?: boolean, partialText?: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { validatePublicUrl } from "../_shared/validate-url.ts";
import {
  extractWithCheerio,
  looksLikeJobDescription,
} from "../_shared/cheerio-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Browser header presets
// ---------------------------------------------------------------------------

/** Full Chrome 124 headers — works for most public ATS boards. */
const HEADERS_CHROME: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

/**
 * Stripped fallback headers — no Sec-* headers, minimal footprint.
 * Some CDNs (Cloudflare) let this through when the full set triggers a WAF rule.
 */
const HEADERS_MINIMAL: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// Sites that require login — we can't scrape them server-side.
// Return a helpful, specific message instead of a generic 403.
const LOGIN_WALL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /linkedin\.com/i,  name: "LinkedIn" },
  { pattern: /indeed\.com/i,    name: "Indeed" },
  { pattern: /glassdoor\.com/i, name: "Glassdoor" },
  { pattern: /ziprecruiter\.com/i, name: "ZipRecruiter" },
  { pattern: /monster\.com/i,   name: "Monster" },
];

function loginWallMessage(url: string): string | null {
  for (const { pattern, name } of LOGIN_WALL_PATTERNS) {
    if (pattern.test(url)) {
      return `${name} blocks server-side access to job postings. Please open the job page in your browser, copy the description, and paste it below.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTML extractor helpers
// ---------------------------------------------------------------------------

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

function extractPrimary(html: string): { text: string; title?: string } | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim();
  const mainMatch =
    html.match(/<main[\s\S]*?<\/main>/i) ||
    html.match(/<article[\s\S]*?<\/article>/i);
  const rawText = htmlToText(mainMatch?.[0] ?? html);
  if (!rawText || rawText.length < 150) return null;
  return { text: rawText.slice(0, 8_000), title };
}

// ---------------------------------------------------------------------------
// Fetch with automatic retry on 403 / 429
// ---------------------------------------------------------------------------

interface FetchAttempt {
  ok: boolean;
  status?: number;
  html?: string;
  contentType?: string;
  error?: string;
}

async function fetchWithFallback(url: string): Promise<FetchAttempt> {
  // Attempt 1 — full Chrome headers
  try {
    const res = await fetch(url, {
      headers: HEADERS_CHROME,
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        html: await res.text(),
        contentType: res.headers.get("content-type") ?? "",
      };
    }

    // On 403/429 try a second attempt with minimal headers
    if (res.status === 403 || res.status === 429) {
      await res.body?.cancel();
      console.log(`[scrape-url] ${res.status} on attempt 1, retrying with minimal headers: ${url}`);

      const res2 = await fetch(url, {
        headers: HEADERS_MINIMAL,
        signal: AbortSignal.timeout(15_000),
        redirect: "follow",
      });

      if (res2.ok) {
        return {
          ok: true,
          status: res2.status,
          html: await res2.text(),
          contentType: res2.headers.get("content-type") ?? "",
        };
      }

      // Both attempts failed — return the second status
      await res2.body?.cancel();
      return { ok: false, status: res2.status };
    }

    // Other non-OK status (404, 500, etc.) — no retry
    await res.body?.cancel();
    return { ok: false, status: res.status };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ success: false, error: "Missing authorization header" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error: authError } = await supabase.auth.getClaims(token);
  if (authError || !data?.claims) {
    return json({ success: false, error: "Invalid or expired token" }, 401);
  }

  const userId: string = data.claims.sub as string;

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (!checkRateLimit(`scrape-url:${userId}`, 10, 60_000)) {
    return json(
      { success: false, error: "Too many requests – please wait a moment and try again." },
      429
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  // ── Validate URL (SSRF protection) ────────────────────────────────────────
  const urlValidation = validatePublicUrl(body.url);
  if (!urlValidation.ok) {
    return json({ success: false, error: urlValidation.error }, 400);
  }
  const url = urlValidation.url;

  // ── Fetch (with 403 retry) ────────────────────────────────────────────────
  const attempt = await fetchWithFallback(url);

  if (!attempt.ok) {
    // Check if it's a known login-wall site before giving a generic error
    const loginMsg = loginWallMessage(url);

    if (attempt.error) {
      const isTimeout =
        attempt.error.toLowerCase().includes("timeout") ||
        attempt.error.toLowerCase().includes("abort");
      return json({
        success: false,
        extractionFailed: true,
        error: isTimeout
          ? "The page took too long to load. Please paste the job description manually."
          : `Unable to reach the page. Please paste the job description manually.`,
      });
    }

    return json({
      success: false,
      extractionFailed: true,
      error: loginMsg ??
        `Could not load the page (HTTP ${attempt.status}). Please paste the job description manually.`,
    });
  }

  const { html, contentType = "" } = attempt;

  if (!html) {
    return json({
      success: false,
      extractionFailed: true,
      error: "The page returned no content. Please paste the job description manually.",
    });
  }

  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    return json({
      success: false,
      extractionFailed: true,
      error: "The page returned a non-HTML response. Please paste the job description manually.",
    });
  }

  // ── Extraction pass 1: primary regex extractor ────────────────────────────
  const primary = extractPrimary(html);

  if (primary && looksLikeJobDescription(primary.text)) {
    console.log(`[scrape-url] Primary OK (${primary.text.length} chars): ${url}`);
    return json({ success: true, markdown: primary.text, title: primary.title, usedFallback: false });
  }

  // ── Extraction pass 2: Cheerio fallback ───────────────────────────────────
  console.log(`[scrape-url] Primary insufficient — Cheerio fallback: ${url}`);
  const fallback = await extractWithCheerio(html, url);

  if (fallback.ok && looksLikeJobDescription(fallback.text)) {
    console.log(`[scrape-url] Cheerio OK via "${fallback.strategy}" (${fallback.text.length} chars): ${url}`);
    return json({
      success: true,
      markdown: fallback.text,
      title: fallback.title ?? primary?.title,
      usedFallback: true,
    });
  }

  // ── Both extractors produced no usable content ────────────────────────────
  const bestText = (fallback.text || primary?.text) ?? "";

  if (bestText.length > 0) {
    return json({
      success: false,
      extractionFailed: true,
      error:
        "The page content doesn't look like a job description. " +
        "Please paste the job details manually or try a different URL.",
      partialText: bestText.slice(0, 8_000),
    });
  }

  return json({
    success: false,
    extractionFailed: true,
    error: "Could not extract meaningful text from this page. Please paste the job description manually.",
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
