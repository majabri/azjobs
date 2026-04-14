/**
 * scrape-url — Edge Function
 *
 * Fetches a job posting URL and returns its content as plain text / Markdown.
 * Uses a direct HTTP fetch + lightweight HTML → text extraction.
 * No third-party scraping services are used.
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
// HTML → plain text
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

  // Fetch the page
  try {
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
      return new Response(
        JSON.stringify({
          success: false,
          error: `Could not fetch the page (HTTP ${res.status}). Please paste the job description manually.`,
          extractionFailed: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "The page returned a non-HTML response. Please paste the job description manually.",
          extractionFailed: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await res.text();

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim();

    // Prefer <main> or <article> for cleaner output
    const mainMatch =
      html.match(/<main[\s\S]*?<\/main>/i) ||
      html.match(/<article[\s\S]*?<\/article>/i);
    const rawText = htmlToText(mainMatch?.[0] ?? html);

    if (!rawText || rawText.length < 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Could not extract meaningful text from this page. Please paste the job description manually.",
          extractionFailed: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trim to a reasonable size for downstream AI use
    const markdown = rawText.slice(0, 8_000);

    if (!looksLikeJobDescription(rawText)) {
      return new Response(
        JSON.stringify({
          success: false,
          extractionFailed: true,
          error:
            "The page content doesn't look like a job description. Please paste it manually.",
          partialText: markdown,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, markdown, title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
