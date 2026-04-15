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
 * Security:
 *  - SSRF protection via validatePublicUrl (blocks private IPs, loopback, etc.)
 *  - Rate limited: 10 requests / minute / user (in-memory, best-effort)
 *  - 15-second fetch timeout
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
// Primary extractor — lightweight regex, no deps
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

/**
 * Run the primary (regex-based) extraction pass.
 * Returns null when the result is too short to be useful.
 */
function extractPrimary(html: string): { text: string; title?: string } | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim();

  // Prefer semantic containers for a cleaner signal.
  const mainMatch =
    html.match(/<main[\s\S]*?<\/main>/i) ||
    html.match(/<article[\s\S]*?<\/article>/i);
  const rawText = htmlToText(mainMatch?.[0] ?? html);

  if (!rawText || rawText.length < 150) return null;
  return { text: rawText.slice(0, 8_000), title };
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

  // ── Fetch ─────────────────────────────────────────────────────────────────
  let html: string;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; iCareerOS/1.0; +https://icareeros.com)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return json(
        {
          success: false,
          error: `Could not fetch the page (HTTP ${res.status}). Please paste the job description manually.`,
          extractionFailed: true,
        }
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      return json({
        success: false,
        error: "The page returned a non-HTML response. Please paste the job description manually.",
        extractionFailed: true,
      });
    }

    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const isTimeout = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("abort");
    return json({
      success: false,
      error: isTimeout
        ? "The page took too long to load. Please paste the job description manually."
        : `Failed to fetch the URL: ${msg}. Please paste the job description manually.`,
      extractionFailed: true,
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
