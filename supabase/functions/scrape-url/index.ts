/**
 * scrape-url — Supabase Edge Function (Deno)
 *
 * Extraction pipeline (in priority order):
 *
 *  1. ATS JSON APIs — for JS-rendered boards with free public APIs:
 *       Greenhouse     → boards-api.greenhouse.io     (no auth)
 *       Lever          → api.lever.co                 (no auth)
 *       SmartRecruiters→ api.smartrecruiters.com      (no auth)
 *       Breezy HR      → {company}.breezy.hr/json/    (no auth)
 *       Ashby          → __NEXT_DATA__ SSR extraction
 *
 *  2. Login-wall detection — sites that require auth (server-side scraping
 *     is technically impossible for these):
 *       LinkedIn, Indeed, Glassdoor, ZipRecruiter, Monster, Facebook,
 *       Upwork, Fiverr, FlexJobs, Handshake, WayUp,
 *       Workday, iCIMS, Taleo (IP-block cloud servers)
 *       → Returns a specific, helpful message per site
 *
 *  3. Direct HTML fetch → Cheerio DOM extraction
 *       Attempt A: Chrome 124 headers (full Sec-Fetch-* set)
 *       Attempt B: Minimal headers (WAF bypass on 403/429)
 *
 *  4. Post-processing (Lovable pipeline, preserved):
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

// ---------------------------------------------------------------------------
// Login-wall / IP-block detection
// Sites where server-side scraping is technically impossible.
// Returns a site-specific helpful message.
// ---------------------------------------------------------------------------

interface LoginWallEntry {
  pattern: RegExp;
  name: string;
  reason: "login" | "ip-block";
  tip?: string;
}

const LOGIN_WALL_SITES: LoginWallEntry[] = [
  // Login-required job boards
  { pattern: /linkedin\.com/i,         name: "LinkedIn",       reason: "login",    tip: "Open the job, click 'See more' to expand, then copy the full description." },
  { pattern: /indeed\.com/i,           name: "Indeed",         reason: "login",    tip: "Open the job in your browser and copy the description from the page." },
  { pattern: /glassdoor\.com/i,        name: "Glassdoor",      reason: "login",    tip: "Sign in to Glassdoor, open the job, and copy the description." },
  { pattern: /ziprecruiter\.com/i,     name: "ZipRecruiter",   reason: "login",    tip: "Open the job in your browser and copy the description." },
  { pattern: /monster\.com/i,          name: "Monster",        reason: "login",    tip: "Open the job in your browser and copy the description." },
  { pattern: /facebook\.com\/jobs/i,   name: "Facebook Jobs",  reason: "login",    tip: "Open Facebook, find the job posting, and copy the description." },
  { pattern: /upwork\.com/i,           name: "Upwork",         reason: "login",    tip: "Sign in to Upwork, open the job, and copy the description." },
  { pattern: /fiverr\.com/i,           name: "Fiverr",         reason: "login",    tip: "Open the listing in your browser and copy the description." },
  { pattern: /flexjobs\.com/i,         name: "FlexJobs",       reason: "login",    tip: "Sign in to FlexJobs, open the job, and copy the description." },
  { pattern: /joinhandshake\.com/i,    name: "Handshake",      reason: "login",    tip: "Sign in to Handshake, open the job, and copy the description." },
  { pattern: /wayup\.com/i,            name: "WayUp",          reason: "login",    tip: "Open the job in your browser and copy the description." },
  { pattern: /careerbuilder\.com/i,    name: "CareerBuilder",  reason: "login" },
  // IP-blocked ATS platforms
  { pattern: /myworkdayjobs\.com/i,    name: "Workday",        reason: "ip-block", tip: "Copy the job description text from the page and paste it below." },
  { pattern: /icims\.com/i,            name: "iCIMS",          reason: "ip-block", tip: "Copy the job description text from the page and paste it below." },
  { pattern: /taleo\.net/i,            name: "Taleo",          reason: "ip-block", tip: "Copy the job description text from the page and paste it below." },
];

function getLoginWallMessage(url: string): string | null {
  for (const site of LOGIN_WALL_SITES) {
    if (site.pattern.test(url)) {
      const base = site.reason === "login"
        ? `${site.name} requires sign-in to view job descriptions — automated access isn't possible.`
        : `${site.name} blocks automated server access.`;
      const tip = site.tip ?? "Open the job in your browser, copy the description, and paste it below.";
      return `${base} ${tip}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// ATS JSON APIs — free, no auth required
// ---------------------------------------------------------------------------

interface AtsResult {
  ok: boolean;
  text?: string;
  title?: string;
  error?: string;
}

/** Greenhouse: boards-api.greenhouse.io/v1/boards/{board}/jobs/{id} */
async function fetchGreenhouse(url: string): Promise<AtsResult | null> {
  let board: string, jobId: string;
  let m = url.match(/boards\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i);
  if (m) { [, board, jobId] = m; }
  else {
    m = url.match(/([^./]+)\.greenhouse\.io\/jobs\/(\d+)/i);
    if (m) { [, board, jobId] = m; } else return null;
  }
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`;
  console.log(`[scrape-url] Greenhouse API: ${apiUrl}`);
  try {
    const res = await fetch(apiUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, error: `Greenhouse API ${res.status}` };
    const data = await res.json();
    const title: string = data.title ?? "";
    const text = stripHtml(data.content ?? "");
    const location = data.location?.name ?? "";
    const dept = data.departments?.[0]?.name ?? "";
    const meta = [dept && `Department: ${dept}`, location && `Location: ${location}`].filter(Boolean).join("\n");
    return { ok: true, text: meta ? `${text}\n\n${meta}` : text, title };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/** Lever: api.lever.co/v0/postings/{company}/{job_id} */
async function fetchLever(url: string): Promise<AtsResult | null> {
  const m = url.match(/jobs\.lever\.co\/([^/?#]+)\/([a-f0-9-]{36})/i);
  if (!m) return null;
  const [, company, jobId] = m;
  const apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}`;
  console.log(`[scrape-url] Lever API: ${apiUrl}`);
  try {
    const res = await fetch(apiUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, error: `Lever API ${res.status}` };
    const data = await res.json();
    const title: string = data.text ?? "";
    const desc = data.descriptionPlain ?? stripHtml(data.description ?? "");
    const additional = stripHtml(data.additional ?? data.additionalPlain ?? "");
    const lists = (data.lists ?? [])
      .map((l: any) => `${l.text}:\n${stripHtml(l.content ?? "").replace(/\n/g, "\n- ")}`)
      .join("\n\n");
    const meta = [
      data.categories?.location && `Location: ${data.categories.location}`,
      data.categories?.team && `Team: ${data.categories.team}`,
      data.categories?.commitment && `Type: ${data.categories.commitment}`,
    ].filter(Boolean).join("\n");
    return { ok: true, text: [desc, lists, additional, meta].filter(Boolean).join("\n\n").trim(), title };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/** SmartRecruiters: api.smartrecruiters.com/v1/companies/{company}/postings/{id} */
async function fetchSmartRecruiters(url: string): Promise<AtsResult | null> {
  // URL patterns: jobs.smartrecruiters.com/{company}/{id} or smartrecruiters.com/job/{company}/{id}
  let m = url.match(/(?:jobs\.)?smartrecruiters\.com\/([^/?#]+)\/([^/?#]+)/i);
  if (!m) return null;
  const [, company, jobId] = m;
  if (!jobId || jobId.length < 5) return null;
  const apiUrl = `https://api.smartrecruiters.com/v1/companies/${company}/postings/${jobId}`;
  console.log(`[scrape-url] SmartRecruiters API: ${apiUrl}`);
  try {
    const res = await fetch(apiUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, error: `SmartRecruiters API ${res.status}` };
    const data = await res.json();
    const title: string = data.name ?? "";
    const sections = (data.jobAd?.sections ?? {});
    const parts = [
      sections.companyDescription?.text && stripHtml(sections.companyDescription.text),
      sections.jobDescription?.text && stripHtml(sections.jobDescription.text),
      sections.qualifications?.text && stripHtml(sections.qualifications.text),
      sections.additionalInformation?.text && stripHtml(sections.additionalInformation.text),
    ].filter(Boolean);
    const location = data.location?.city ?? data.location?.country ?? "";
    const dept = data.department?.label ?? "";
    const meta = [dept && `Department: ${dept}`, location && `Location: ${location}`].filter(Boolean).join("\n");
    return { ok: true, text: [...parts, meta].filter(Boolean).join("\n\n").trim(), title };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/** Breezy HR: {company}.breezy.hr — uses /json/ API endpoint */
async function fetchBreezyHR(url: string): Promise<AtsResult | null> {
  const m = url.match(/([^.]+)\.breezy\.hr(?:\/p\/([^/?#]+))?/i);
  if (!m) return null;
  const [, company, slug] = m;
  if (!slug) return null;
  const apiUrl = `https://${company}.breezy.hr/json/${slug}`;
  console.log(`[scrape-url] Breezy HR API: ${apiUrl}`);
  try {
    const res = await fetch(apiUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, error: `Breezy API ${res.status}` };
    const data = await res.json();
    const title: string = data.name ?? "";
    const text = stripHtml(data.description ?? "");
    const location = data.location?.name ?? "";
    const dept = data.department?.name ?? "";
    const meta = [dept && `Department: ${dept}`, location && `Location: ${location}`].filter(Boolean).join("\n");
    return { ok: true, text: meta ? `${text}\n\n${meta}` : text, title };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/** Ashby — extracts job data from __NEXT_DATA__ embedded JSON */
async function fetchAshby(url: string): Promise<AtsResult | null> {
  if (!/jobs\.ashbyhq\.com/i.test(url)) return null;
  console.log(`[scrape-url] Ashby __NEXT_DATA__: ${url}`);
  try {
    const res = await fetch(url, { headers: HEADERS_CHROME, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return { ok: false, error: `Ashby ${res.status}` };
    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (!m) return null;
    const json = JSON.parse(m[1]);
    const job = json?.props?.pageProps?.jobPosting ?? json?.props?.pageProps?.posting ?? null;
    if (!job) return null;
    const title: string = job.title ?? "";
    const text = stripHtml(job.descriptionHtml ?? job.content ?? "");
    return { ok: true, text, title };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/** Route to the correct ATS API. Returns null → fall through to HTML fetch. */
async function tryAtsApi(url: string): Promise<AtsResult | null> {
  return (
    await fetchGreenhouse(url) ??
    await fetchLever(url) ??
    await fetchSmartRecruiters(url) ??
    await fetchBreezyHR(url) ??
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
  const go = (h: Record<string, string>) =>
    fetch(url, { headers: h, signal: AbortSignal.timeout(15_000), redirect: "follow" });
  try {
    const r = await go(HEADERS_CHROME);
    if (r.ok) return { ok: true, html: await r.text(), contentType: r.headers.get("content-type") ?? "", status: r.status };
    if (r.status === 403 || r.status === 429) {
      await r.body?.cancel();
      console.log(`[scrape-url] ${r.status}, retrying minimal headers: ${url}`);
      const r2 = await go(HEADERS_MINIMAL);
      if (r2.ok) return { ok: true, html: await r2.text(), contentType: r2.headers.get("content-type") ?? "", status: r2.status };
      await r2.body?.cancel();
      return { ok: false, status: r2.status };
    }
    await r.body?.cancel();
    return { ok: false, status: r.status };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

// ---------------------------------------------------------------------------
// Post-processing — Lovable's pipeline (preserved exactly)
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
    if (!trimmed) { consecutiveEmpty++; if (consecutiveEmpty <= 2) cleaned.push(""); continue; }
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
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (jobStartPatterns.some((p) => p.test(lines[i].trim()))) { start = i; break; }
  }
  const hasJob = /\b(requirements?|qualifications?|responsibilities|experience|what\s*you.?ll\s*(do|need|bring)|about\s*(the\s*)?(role|position))\b/i.test(markdown);
  if (start > 10 && hasJob) {
    let s = start;
    for (let i = start - 1; i >= Math.max(0, start - 5); i--) {
      const t = lines[i].trim();
      if (t && (t.startsWith("#") || t.startsWith("**"))) { s = i; break; }
    }
    return lines.slice(s).join("\n");
  }
  return markdown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return res({ success: false, error: "Missing authorization header" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data, error: authError } = await (supabase.auth as any).getClaims(authHeader.replace("Bearer ", ""));
    if (authError || !data?.claims) return res({ success: false, error: "Invalid or expired token" }, 401);
    const userId: string = data.claims.sub;

    // ── Rate limit (20/min) ───────────────────────────────────────────────────
    if (!checkRateLimit(`scrape-url:${userId}`, 20, 60_000)) return res({ success: false, error: "Too many requests – please slow down" }, 429);

    // ── Validate URL ──────────────────────────────────────────────────────────
    const body = await req.json();
    const { url } = body;
    if (!url) return res({ success: false, error: "URL is required" }, 400);
    const validated = validatePublicUrl(url);
    if (!validated.ok) return res({ success: false, error: validated.error }, 400);
    const validUrl = validated.url;

    // ── Step 1: Login-wall check ──────────────────────────────────────────────
    const loginMsg = getLoginWallMessage(validUrl);
    if (loginMsg) {
      return res({ success: false, extractionFailed: true, error: loginMsg });
    }

    // ── Step 2: ATS JSON API ──────────────────────────────────────────────────
    const atsResult = await tryAtsApi(validUrl);
    if (atsResult?.ok && (atsResult.text?.length ?? 0) >= 100) {
      const cleaned = cleanJobMarkdown(extractJobBlock(atsResult.text!));
      if (cleaned.length >= 200) {
        console.log(`[scrape-url] ATS API success (${cleaned.length} chars): ${validUrl}`);
        return res({ success: true, markdown: cleaned.slice(0, 8_000), title: atsResult.title });
      }
    }

    // ── Step 3: HTML fetch + Cheerio ──────────────────────────────────────────
    const fetched = await fetchWithFallback(validUrl);
    if (!fetched.ok) {
      if (fetched.error) {
        const isTimeout = /timeout|abort/i.test(fetched.error);
        return res({ success: false, extractionFailed: true, error: isTimeout ? "The page took too long to load. Please paste the job description manually." : "Unable to reach the page. Please paste the job description manually." });
      }
      // One last login-wall check on the actual HTTP status
      return res({ success: false, extractionFailed: true, error: `Could not load the page (HTTP ${fetched.status}). Please paste the job description manually.` });
    }

    const { html = "", contentType = "" } = fetched;
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return res({ success: false, extractionFailed: true, error: "The page returned a non-HTML response. Please paste the job description manually." });
    }

    const extraction = await extractWithCheerio(html, validUrl);
    const jobBlock = extractJobBlock(extraction.text ?? "");
    const cleaned = cleanJobMarkdown(jobBlock);
    const pageTitle = extraction.title ?? "";

    if (cleaned.length < 300) {
      return res({ success: false, extractionFailed: true, error: "We couldn't extract enough content from this URL. Please paste the job description manually.", partialText: cleaned || undefined });
    }

    const hasJobSignals = /\b(experience|requirements?|qualifications?|responsibilities|skills?|salary|compensation|benefits?|about\s*(the\s*)?(role|position|company)|what\s*you)\b/i.test(cleaned);
    if (!hasJobSignals) {
      return res({ success: false, extractionFailed: true, error: "The extracted content doesn't appear to be a job description. Please paste it manually.", partialText: cleaned.slice(0, 500) || undefined });
    }

    return res({ success: true, markdown: cleaned.slice(0, 8_000), title: pageTitle });

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
