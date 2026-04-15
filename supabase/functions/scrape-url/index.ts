/**
 * scrape-url — Supabase Edge Function (Deno)
 *
 * Replaces Firecrawl with free direct-fetch + Cheerio extraction.
 * Preserves Lovable's cleanJobMarkdown / extractJobBlock post-processing pipeline.
 *
 * Fetch strategy:
 *  Attempt 1 — full Chrome 124 browser headers
 *  Attempt 2 — minimal headers (bypasses some WAF/Cloudflare rules on 403/429)
 *
 * Extraction pipeline:
 *  raw HTML → Cheerio DOM extraction → extractJobBlock → cleanJobMarkdown → quality gate
 *
 * Security:
 *  SSRF protection, rate limit 20 req/min/user, 15s timeout per attempt
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { validatePublicUrl } from "../_shared/validate-url.ts";
import { extractWithCheerio } from "../_shared/cheerio-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------------------------------------------------------------------------
// Browser header presets
// ---------------------------------------------------------------------------

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

const HEADERS_MINIMAL: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// Sites that need a login — give a helpful specific message
const LOGIN_WALL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /linkedin\.com/i,     name: "LinkedIn" },
  { pattern: /indeed\.com/i,       name: "Indeed" },
  { pattern: /glassdoor\.com/i,    name: "Glassdoor" },
  { pattern: /ziprecruiter\.com/i, name: "ZipRecruiter" },
  { pattern: /monster\.com/i,      name: "Monster" },
];

function loginWallMessage(url: string): string | null {
  for (const { pattern, name } of LOGIN_WALL_PATTERNS) {
    if (pattern.test(url)) {
      return `${name} blocks automated access to job postings. Open the job in your browser, copy the description, and paste it below.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Post-processing — Lovable's proven cleaning pipeline (preserved exactly)
// ---------------------------------------------------------------------------

const NOISE_PATTERNS = [
  /^(apply\s*(now|here|today|online)?|save\s*job|share\s*(this\s*)?job|print|report\s*(this\s*)?job|sign\s*in|log\s*in|create\s*account|sign\s*up|register|back\s*to\s*(search|results|jobs)|view\s*all\s*jobs|similar\s*jobs|more\s*jobs)/i,
  /^(home|about\s*us|careers|contact|blog|press|privacy|terms|cookie|sitemap|faq|help|support|accessibility)/i,
  /^(follow\s*us|connect\s*with\s*us|stay\s*connected|join\s*our\s*(team|talent)|newsletter)/i,
  /^(©|copyright|all\s*rights\s*reserved)/i,
  /^\[.*?\]\(.*?\)$/,
  /^!\[.*?\]\(.*?\)$/,
  /^(skip\s*to\s*content|main\s*navigation|breadcrumb)/i,
  /^(posted|updated|published|closes?|deadline|date\s*posted)\s*:?\s*\d/i,
  /^(job\s*(id|number|code|ref|reference))\s*:?\s*/i,
  /^[\w\s]{1,15}\s*\|\s*[\w\s]{1,15}\s*\|\s*[\w\s]{1,15}/,
  /^#{1,6}\s*(menu|navigation|footer|header|sidebar)/i,
];

const TRAILING_SECTION_HEADERS = [
  /^#{1,4}\s*(similar\s*jobs|related\s*jobs|you\s*may\s*also|recommended|other\s*openings|explore\s*more)/i,
  /^#{1,4}\s*(share\s*this|social\s*media|follow\s*us)/i,
];

function cleanJobMarkdown(raw: string): string {
  const lines = raw.split("\n");
  const cleaned: string[] = [];
  let consecutiveEmpty = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (TRAILING_SECTION_HEADERS.some((p) => p.test(trimmed))) break;
    if (trimmed && NOISE_PATTERNS.some((p) => p.test(trimmed))) continue;
    if (/^https?:\/\/\S+$/.test(trimmed)) continue;
    if (/^!\[.*?\]\(.*?(tracking|pixel|beacon|1x1).*?\)$/i.test(trimmed)) continue;

    if (!trimmed) {
      consecutiveEmpty++;
      if (consecutiveEmpty <= 2) cleaned.push("");
      continue;
    }
    consecutiveEmpty = 0;

    const stripped = trimmed
      .replace(/\[apply\s*(now|here|today)?\]\(.*?\)/gi, "")
      .replace(/\[save\s*job\]\(.*?\)/gi, "")
      .replace(/\[share\]\(.*?\)/gi, "")
      .trim();

    if (stripped) cleaned.push(stripped);
  }

  return cleaned.join("\n").trim();
}

function extractJobBlock(markdown: string): string {
  const lines = markdown.split("\n");
  const jobStartPatterns = [
    /^#{1,4}\s*(job\s*description|about\s*(the\s*)?(role|position|opportunity)|role\s*summary|position\s*overview|the\s*role|overview)/i,
    /^#{1,4}\s*(what\s*you.?ll\s*do|responsibilities|key\s*responsibilities)/i,
    /^\*\*(job\s*description|about\s*(the\s*)?(role|position))\*\*/i,
  ];

  let jobStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (jobStartPatterns.some((p) => p.test(lines[i].trim()))) {
      jobStartIdx = i;
      break;
    }
  }

  const hasJobContent =
    /\b(requirements?|qualifications?|responsibilities|experience|what\s*you.?ll\s*(do|need|bring)|about\s*(the\s*)?(role|position))\b/i.test(
      markdown
    );

  if (jobStartIdx > 10 && hasJobContent) {
    let actualStart = jobStartIdx;
    for (let i = jobStartIdx - 1; i >= Math.max(0, jobStartIdx - 5); i--) {
      const t = lines[i].trim();
      if (t && (t.startsWith("#") || t.startsWith("**"))) {
        actualStart = i;
        break;
      }
    }
    return lines.slice(actualStart).join("\n");
  }

  return markdown;
}

// ---------------------------------------------------------------------------
// Fetch with 403 retry
// ---------------------------------------------------------------------------

interface FetchResult {
  ok: boolean;
  html?: string;
  contentType?: string;
  status?: number;
  error?: string;
}

async function fetchWithFallback(url: string): Promise<FetchResult> {
  const attempt = async (headers: Record<string, string>): Promise<Response> =>
    fetch(url, { headers, signal: AbortSignal.timeout(15_000), redirect: "follow" });

  try {
    const res = await attempt(HEADERS_CHROME);
    if (res.ok) {
      return { ok: true, html: await res.text(), contentType: res.headers.get("content-type") ?? "", status: res.status };
    }

    if (res.status === 403 || res.status === 429) {
      await res.body?.cancel();
      console.log(`[scrape-url] ${res.status} with Chrome headers, retrying minimal: ${url}`);
      const res2 = await attempt(HEADERS_MINIMAL);
      if (res2.ok) {
        return { ok: true, html: await res2.text(), contentType: res2.headers.get("content-type") ?? "", status: res2.status };
      }
      await res2.body?.cancel();
      return { ok: false, status: res2.status };
    }

    await res.body?.cancel();
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return res({ success: false, error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await (supabase.auth as any).getClaims(token);
    if (authError || !data?.claims) {
      return res({ success: false, error: "Invalid or expired token" }, 401);
    }

    const userId: string = data.claims.sub as string;

    // ── Rate limit (20/min — matches Lovable) ────────────────────────────────
    if (!checkRateLimit(`scrape-url:${userId}`, 20, 60_000)) {
      return res({ success: false, error: "Too many requests – please slow down" }, 429);
    }

    // ── Parse & validate URL ─────────────────────────────────────────────────
    const body = await req.json();
    const { url } = body;
    if (!url) return res({ success: false, error: "URL is required" }, 400);

    const urlValidation = validatePublicUrl(url);
    if (!urlValidation.ok) return res({ success: false, error: urlValidation.error }, 400);
    const validatedUrl = urlValidation.url;

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetched = await fetchWithFallback(validatedUrl);

    if (!fetched.ok) {
      const loginMsg = loginWallMessage(validatedUrl);
      if (fetched.error) {
        const isTimeout = fetched.error.toLowerCase().includes("timeout") || fetched.error.toLowerCase().includes("abort");
        return res({
          success: false,
          extractionFailed: true,
          error: isTimeout
            ? "The page took too long to load. Please paste the job description manually."
            : "Unable to reach the page. Please paste the job description manually.",
        });
      }
      return res({
        success: false,
        extractionFailed: true,
        error: loginMsg ?? `Could not load the page (HTTP ${fetched.status}). Please paste the job description manually.`,
      });
    }

    const { html = "", contentType = "" } = fetched;

    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return res({
        success: false,
        extractionFailed: true,
        error: "The page returned a non-HTML response. Please paste the job description manually.",
      });
    }

    // ── Extract via Cheerio ──────────────────────────────────────────────────
    const extraction = await extractWithCheerio(html, validatedUrl);
    const rawText = extraction.text ?? "";
    const title = extraction.title ?? "";

    // ── Post-process (Lovable's pipeline) ────────────────────────────────────
    const jobBlock = extractJobBlock(rawText);
    const cleaned = cleanJobMarkdown(jobBlock);

    // ── Quality gate (matches Lovable's thresholds) ──────────────────────────
    if (cleaned.length < 300) {
      return res({
        success: false,
        extractionFailed: true,
        error: "We couldn't extract enough content from this URL. Please paste the job description manually.",
        partialText: cleaned || undefined,
      });
    }

    const hasJobSignals =
      /\b(experience|requirements?|qualifications?|responsibilities|skills?|salary|compensation|benefits?|about\s*(the\s*)?(role|position|company)|what\s*you)\b/i.test(
        cleaned
      );

    if (!hasJobSignals) {
      return res({
        success: false,
        extractionFailed: true,
        error: "The extracted content doesn't appear to be a job description. Please paste it manually.",
        partialText: cleaned.slice(0, 500) || undefined,
      });
    }

    return res({ success: true, markdown: cleaned.slice(0, 8_000), title });

  } catch (error) {
    console.error("[scrape-url] Unhandled error:", error);
    return res({
      success: false,
      extractionFailed: true,
      error: error instanceof Error ? error.message : "Failed to scrape",
    }, 500);
  }
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
