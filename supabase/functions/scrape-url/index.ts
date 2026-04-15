/**
 * scrape-url — Supabase Edge Function (Deno)
 *
 * Extraction pipeline (in priority order):
 *
 *  1. ATS API routes  — for JS-rendered boards that have free public APIs:
 *       Greenhouse → boards-api.greenhouse.io  (JSON, no auth)
 *       Lever      → api.lever.co              (JSON, no auth)
 *       Ashby      → jobs.ashbyhq.com          (JSON via __NEXT_DATA__)
 *
 *  2. Direct HTML fetch → Cheerio DOM extraction
 *       Attempt A: Chrome 124 headers
 *       Attempt B: Minimal headers (WAF bypass on 403/429)
 *
 *  3. Post-processing (Lovable pipeline, preserved exactly):
 *       extractJobBlock → cleanJobMarkdown → quality gate
 *
 * Security: SSRF protection, 20 req/min/user, 15s timeout
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
// Browser headers
// ---------------------------------------------------------------------------

const HEADERS_CHROME: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "no-cache",
};

const HEADERS_MINIMAL: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// Sites that require a login — helpful specific message
const LOGIN_WALL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /linkedin\.com/i,         name: "LinkedIn" },
  { pattern: /indeed\.com/i,           name: "Indeed" },
  { pattern: /glassdoor\.com/i,        name: "Glassdoor" },
  { pattern: /ziprecruiter\.com/i,     name: "ZipRecruiter" },
  { pattern: /monster\.com/i,          name: "Monster" },
  { pattern: /myworkdayjobs\.com/i,    name: "Workday" },
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
// ATS API routes — bypass JS rendering entirely
// ---------------------------------------------------------------------------

interface AtsResult {
  ok: boolean;
  text?: string;
  title?: string;
  error?: string;
}

/**
 * Greenhouse public API
 * URL patterns:
 *   https://boards.greenhouse.io/{board}/jobs/{id}
 *   https://{company}.greenhouse.io/jobs/{id}
 * API: https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}
 */
async function fetchGreenhouse(url: string): Promise<AtsResult | null> {
  // Pattern 1: boards.greenhouse.io/{board}/jobs/{id}
  let m = url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i);
  if (!m) {
    // Pattern 2: {board}.greenhouse.io/jobs/{id}  (custom domain subdomain style)
    m = url.match(/([^./]+)\.greenhouse\.io\/jobs\/(\d+)/i);
  }
  if (!m) return null;

  const [, board, jobId] = m;
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`;
  console.log(`[scrape-url] Greenhouse API: ${apiUrl}`);

  try {
    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Greenhouse API returned ${res.status}` };

    const data = await res.json();
    const rawHtml: string = data.content ?? "";
    const title: string = data.title ?? "";

    // Strip HTML from the content field
    const text = rawHtml
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

    // Append location + metadata if present
    const location = data.location?.name ?? "";
    const dept = data.departments?.[0]?.name ?? "";
    const extra = [
      dept ? `Department: ${dept}` : "",
      location ? `Location: ${location}` : "",
    ].filter(Boolean).join("\n");

    return { ok: true, text: extra ? `${text}\n\n${extra}` : text, title };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Lever public API
 * URL patterns:
 *   https://jobs.lever.co/{company}/{job_id}
 * API: https://api.lever.co/v0/postings/{company}/{job_id}
 */
async function fetchLever(url: string): Promise<AtsResult | null> {
  const m = url.match(/jobs\.lever\.co\/([^/]+)\/([a-f0-9-]{36})/i);
  if (!m) return null;

  const [, company, jobId] = m;
  const apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}`;
  console.log(`[scrape-url] Lever API: ${apiUrl}`);

  try {
    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Lever API returned ${res.status}` };

    const data = await res.json();
    const title: string = data.text ?? "";
    const description: string = data.descriptionPlain ?? data.description ?? "";
    const additional: string = (data.additionalPlain ?? data.additional ?? "")
      .replace(/<[^>]+>/g, " ").trim();

    const lists = (data.lists ?? [])
      .map((l: any) => `${l.text}:\n${(l.content ?? "").replace(/<li>/gi, "\n- ").replace(/<[^>]+>/g, "").trim()}`)
      .join("\n\n");

    const location = data.categories?.location ?? "";
    const team = data.categories?.team ?? "";
    const commitment = data.categories?.commitment ?? "";

    const meta = [
      location ? `Location: ${location}` : "",
      team ? `Team: ${team}` : "",
      commitment ? `Type: ${commitment}` : "",
    ].filter(Boolean).join("\n");

    const full = [description, lists, additional, meta].filter(Boolean).join("\n\n");
    return { ok: true, text: full.trim(), title };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Ashby — extracts from __NEXT_DATA__ JSON embedded in the page.
 * URL pattern: https://jobs.ashbyhq.com/{company}/{job_id}
 */
async function fetchAshby(url: string): Promise<AtsResult | null> {
  if (!/jobs\.ashbyhq\.com/i.test(url)) return null;
  console.log(`[scrape-url] Ashby __NEXT_DATA__ extraction: ${url}`);

  try {
    const res = await fetch(url, {
      headers: HEADERS_CHROME,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, error: `Ashby returned ${res.status}` };

    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (!m) return null;

    const json = JSON.parse(m[1]);
    const job = json?.props?.pageProps?.jobPosting
      ?? json?.props?.pageProps?.posting
      ?? null;
    if (!job) return null;

    const title: string = job.title ?? "";
    const bodyHtml: string = job.descriptionHtml ?? job.content ?? "";
    const text = bodyHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { ok: true, text, title };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Workday CXS API
 * URL pattern: https://{tenant}.wd{n}.myworkdayjobs.com/en-US/{board}/details/{path}
 * API:         https://{tenant}.wd{n}.myworkdayjobs.com/wday/cxs/{tenant}/{board}/jobPostings/{path}
 */
async function fetchWorkday(url: string): Promise<AtsResult | null> {
  // Match: https://{tenant}.wd{n}.myworkdayjobs.com/en-US/{board}/details/{path}
  const m = url.match(/^https?:\/\/([^.]+)\.(wd\d+)\.myworkdayjobs\.com(?:\/[a-z-]{2,10})?\/([^/]+)\/(?:details|job|jobs)\/([^/?#]+)/i);
  if (!m) return null;

  const [, tenant, instance, board, jobPath] = m;
  const apiUrl = `https://${tenant}.${instance}.myworkdayjobs.com/wday/cxs/${tenant}/${board}/jobPostings/${jobPath}`;
  console.log(`[scrape-url] Workday API: ${apiUrl}`);

  try {
    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, error: `Workday API returned ${res.status}` };

    const data = await res.json();
    const job = data.jobPostingInfo ?? data;
    const title: string = job.title ?? job.externalName ?? "";

    // Workday returns HTML in the job description field
    const bodyHtml: string = job.jobDescription ?? job.externalDescription ?? "";
    const text = bodyHtml
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

    const location = job.primaryLocation ?? job.location ?? "";
    const meta = location ? `Location: ${location}` : "";

    return { ok: true, text: meta ? `${text}\n\n${meta}` : text, title };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Route to the appropriate ATS API, or return null for generic HTML fetch. */
async function tryAtsApi(url: string): Promise<AtsResult | null> {
  return (
    await fetchGreenhouse(url) ??
    await fetchLever(url) ??
    await fetchWorkday(url) ??
    await fetchAshby(url)
  );
}

// ---------------------------------------------------------------------------
// Generic HTML fetch (with 403 retry)
// ---------------------------------------------------------------------------

interface FetchResult {
  ok: boolean;
  html?: string;
  contentType?: string;
  status?: number;
  error?: string;
}

async function fetchWithFallback(url: string): Promise<FetchResult> {
  const attempt = (headers: Record<string, string>) =>
    fetch(url, { headers, signal: AbortSignal.timeout(15_000), redirect: "follow" });

  try {
    const res = await attempt(HEADERS_CHROME);
    if (res.ok) {
      return { ok: true, html: await res.text(), contentType: res.headers.get("content-type") ?? "", status: res.status };
    }
    if (res.status === 403 || res.status === 429) {
      await res.body?.cancel();
      console.log(`[scrape-url] ${res.status} on Chrome headers, retrying minimal: ${url}`);
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
// Post-processing — Lovable's proven pipeline (preserved exactly)
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
    if (jobStartPatterns.some((p) => p.test(lines[i].trim()))) { jobStartIdx = i; break; }
  }
  const hasJobContent = /\b(requirements?|qualifications?|responsibilities|experience|what\s*you.?ll\s*(do|need|bring)|about\s*(the\s*)?(role|position))\b/i.test(markdown);
  if (jobStartIdx > 10 && hasJobContent) {
    let actualStart = jobStartIdx;
    for (let i = jobStartIdx - 1; i >= Math.max(0, jobStartIdx - 5); i--) {
      const t = lines[i].trim();
      if (t && (t.startsWith("#") || t.startsWith("**"))) { actualStart = i; break; }
    }
    return lines.slice(actualStart).join("\n");
  }
  return markdown;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
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
    if (authError || !data?.claims) return res({ success: false, error: "Invalid or expired token" }, 401);
    const userId: string = data.claims.sub as string;

    // ── Rate limit (20/min) ───────────────────────────────────────────────────
    if (!checkRateLimit(`scrape-url:${userId}`, 20, 60_000)) {
      return res({ success: false, error: "Too many requests – please slow down" }, 429);
    }

    // ── Validate URL ──────────────────────────────────────────────────────────
    const body = await req.json();
    const { url } = body;
    if (!url) return res({ success: false, error: "URL is required" }, 400);
    const urlValidation = validatePublicUrl(url);
    if (!urlValidation.ok) return res({ success: false, error: urlValidation.error }, 400);
    const validatedUrl = urlValidation.url;

    // ── Step 1: Try ATS JSON API ──────────────────────────────────────────────
    const atsResult = await tryAtsApi(validatedUrl);
    if (atsResult?.ok && atsResult.text && atsResult.text.length >= 100) {
      const jobBlock = extractJobBlock(atsResult.text);
      const cleaned = cleanJobMarkdown(jobBlock);
      if (cleaned.length >= 200) {
        console.log(`[scrape-url] ATS API success (${cleaned.length} chars): ${validatedUrl}`);
        return res({ success: true, markdown: cleaned.slice(0, 8_000), title: atsResult.title });
      }
    }

    // ── Step 2: HTML fetch + Cheerio ──────────────────────────────────────────
    const fetched = await fetchWithFallback(validatedUrl);

    if (!fetched.ok) {
      const loginMsg = loginWallMessage(validatedUrl);
      if (fetched.error) {
        const isTimeout = fetched.error.toLowerCase().includes("timeout") || fetched.error.toLowerCase().includes("abort");
        return res({ success: false, extractionFailed: true, error: isTimeout ? "The page took too long to load. Please paste the job description manually." : "Unable to reach the page. Please paste the job description manually." });
      }
      return res({ success: false, extractionFailed: true, error: loginMsg ?? `Could not load the page (HTTP ${fetched.status}). Please paste the job description manually.` });
    }

    const { html = "", contentType = "" } = fetched;
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return res({ success: false, extractionFailed: true, error: "The page returned a non-HTML response. Please paste the job description manually." });
    }

    const extraction = await extractWithCheerio(html, validatedUrl);
    const rawText = extraction.text ?? "";
    const title = extraction.title ?? "";

    // ── Post-process ──────────────────────────────────────────────────────────
    const jobBlock = extractJobBlock(rawText);
    const cleaned = cleanJobMarkdown(jobBlock);

    if (cleaned.length < 300) {
      return res({ success: false, extractionFailed: true, error: "We couldn't extract enough content from this URL. Please paste the job description manually.", partialText: cleaned || undefined });
    }

    const hasJobSignals = /\b(experience|requirements?|qualifications?|responsibilities|skills?|salary|compensation|benefits?|about\s*(the\s*)?(role|position|company)|what\s*you)\b/i.test(cleaned);
    if (!hasJobSignals) {
      return res({ success: false, extractionFailed: true, error: "The extracted content doesn't appear to be a job description. Please paste it manually.", partialText: cleaned.slice(0, 500) || undefined });
    }

    return res({ success: true, markdown: cleaned.slice(0, 8_000), title });

  } catch (error) {
    console.error("[scrape-url] Unhandled error:", error);
    return res({ success: false, extractionFailed: true, error: error instanceof Error ? error.message : "Failed to scrape" }, 500);
  }
});

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
