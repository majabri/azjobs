/**
 * scrape-url — Adaptive Scraping Agent (Supabase Edge Function, Deno)
 *
 * An agent that gets smarter on every run by:
 *
 *  1. Reading the domain_extraction_hints table to see what worked before
 *  2. Trying strategies in priority order (winners first)
 *  3. Writing outcomes back so future runs skip failed strategies
 *
 * Extraction strategies (tried in adaptive order):
 *   A) ATS JSON APIs        — Greenhouse, Lever, SmartRecruiters, Breezy HR, Ashby
 *   B) HTML fetch + Cheerio — Chrome 124 UA with 403-retry fallback
 *
 * Post-processing:
 *   • extractJobBlock()     — Lovable's proven section isolation
 *   • cleanJobMarkdown()    — Lovable's noise-pattern filtering
 *   • parseJobDescription() — Section-aware parser strips benefits, EEO,
 *                             apply instructions, company marketing so the
 *                             AI analysis engine only receives skills-relevant content
 *
 * Login-wall / IP-block detection:
 *   Recognized per-site with helpful copy-paste tips (LinkedIn, Indeed, etc.)
 *   Stored in the learning DB so repeat visits skip the attempt immediately.
 *
 * Security: SSRF protection, 20 req/min/user, 15s per-attempt timeout
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { validatePublicUrl } from "../_shared/validate-url.ts";
import { extractWithCheerio } from "../_shared/cheerio-fallback.ts";
import { cleanJobText } from "../_shared/job-parser.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  domainKey,
  getDomainHint,
  recordOutcome,
  rankedStrategies,
} from "../_shared/extraction-cache.ts";

// ---------------------------------------------------------------------------
// Browser headers
// ---------------------------------------------------------------------------

const HEADERS_CHROME: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
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
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// ---------------------------------------------------------------------------
// Login-wall / IP-block registry
// ---------------------------------------------------------------------------

interface LoginWallEntry {
  pattern: RegExp;
  name: string;
  reason: "login" | "ip-block";
  tip: string;
}

const LOGIN_WALL_SITES: LoginWallEntry[] = [
  {
    pattern: /linkedin\.com/i,
    name: "LinkedIn",
    reason: "login",
    tip: "Open the job, click 'See more' to expand the description, then copy and paste it below.",
  },
  {
    pattern: /indeed\.com/i,
    name: "Indeed",
    reason: "login",
    tip: "Open the job in your browser and copy the full description from the page.",
  },
  {
    pattern: /glassdoor\.com/i,
    name: "Glassdoor",
    reason: "login",
    tip: "Sign in to Glassdoor, open the job, and copy the description.",
  },
  {
    pattern: /ziprecruiter\.com/i,
    name: "ZipRecruiter",
    reason: "login",
    tip: "Open the job in your browser and copy the description.",
  },
  {
    pattern: /monster\.com/i,
    name: "Monster",
    reason: "login",
    tip: "Open the job in your browser and copy the description.",
  },
  {
    pattern: /facebook\.com\/jobs/i,
    name: "Facebook Jobs",
    reason: "login",
    tip: "Open the job on Facebook and copy the description.",
  },
  {
    pattern: /upwork\.com/i,
    name: "Upwork",
    reason: "login",
    tip: "Sign in to Upwork, open the job, and copy the description.",
  },
  {
    pattern: /fiverr\.com/i,
    name: "Fiverr",
    reason: "login",
    tip: "Open the listing in your browser and copy the description.",
  },
  {
    pattern: /flexjobs\.com/i,
    name: "FlexJobs",
    reason: "login",
    tip: "Sign in to FlexJobs, open the job, and copy the description.",
  },
  {
    pattern: /joinhandshake\.com/i,
    name: "Handshake",
    reason: "login",
    tip: "Sign in to Handshake, open the job, and copy the description.",
  },
  {
    pattern: /wayup\.com/i,
    name: "WayUp",
    reason: "login",
    tip: "Open the job in your browser and copy the description.",
  },
  {
    pattern: /myworkdayjobs\.com/i,
    name: "Workday",
    reason: "ip-block",
    tip: "Open the job in your browser, copy the job description section, and paste it below.",
  },
  {
    pattern: /icims\.com/i,
    name: "iCIMS",
    reason: "ip-block",
    tip: "Open the job in your browser and copy the description.",
  },
  {
    pattern: /taleo\.net/i,
    name: "Taleo",
    reason: "ip-block",
    tip: "Open the job in your browser and copy the description.",
  },
];

function getLoginWallMessage(url: string): string | null {
  for (const site of LOGIN_WALL_SITES) {
    if (site.pattern.test(url)) {
      const why =
        site.reason === "login"
          ? `${site.name} requires sign-in — automated access is not possible.`
          : `${site.name} blocks server-side access.`;
      return `${why} ${site.tip}`;
    }
  }
  return null;
}

function isKnownLoginWall(url: string): boolean {
  return LOGIN_WALL_SITES.some((s) => s.pattern.test(url));
}

// ---------------------------------------------------------------------------
// ATS JSON APIs
// ---------------------------------------------------------------------------

interface AtsResult {
  ok: boolean;
  text?: string;
  title?: string;
  strategy?: string;
  error?: string;
}

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

async function fetchGreenhouse(url: string): Promise<AtsResult | null> {
  let m = url.match(/boards\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i);
  if (!m) m = url.match(/([^./]+)\.greenhouse\.io\/jobs\/(\d+)/i);
  if (!m) return null;
  const [, board, jobId] = m;
  try {
    const r = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!r.ok)
      return {
        ok: false,
        strategy: "greenhouse-api",
        error: `API ${r.status}`,
      };
    const d = await r.json();
    const text = stripHtml(d.content ?? "");
    const location = d.location?.name ?? "";
    const dept = d.departments?.[0]?.name ?? "";
    const meta = [
      dept && `Department: ${dept}`,
      location && `Location: ${location}`,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      ok: true,
      text: meta ? `${text}\n\n${meta}` : text,
      title: d.title ?? "",
      strategy: "greenhouse-api",
    };
  } catch (e) {
    return { ok: false, strategy: "greenhouse-api", error: String(e) };
  }
}

async function fetchLever(url: string): Promise<AtsResult | null> {
  const m = url.match(/jobs\.lever\.co\/([^/?#]+)\/([a-f0-9-]{36})/i);
  if (!m) return null;
  const [, company, jobId] = m;
  try {
    const r = await fetch(
      `https://api.lever.co/v0/postings/${company}/${jobId}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!r.ok)
      return { ok: false, strategy: "lever-api", error: `API ${r.status}` };
    const d = await r.json();
    const desc = d.descriptionPlain ?? stripHtml(d.description ?? "");
    const lists = (d.lists ?? [])
      .map((l: any) => `${l.text}:\n${stripHtml(l.content ?? "")}`)
      .join("\n\n");
    const additional = stripHtml(d.additional ?? "");
    const meta = [
      d.categories?.location && `Location: ${d.categories.location}`,
      d.categories?.team && `Team: ${d.categories.team}`,
      d.categories?.commitment && `Type: ${d.categories.commitment}`,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      ok: true,
      text: [desc, lists, additional, meta].filter(Boolean).join("\n\n").trim(),
      title: d.text ?? "",
      strategy: "lever-api",
    };
  } catch (e) {
    return { ok: false, strategy: "lever-api", error: String(e) };
  }
}

async function fetchSmartRecruiters(url: string): Promise<AtsResult | null> {
  const m = url.match(/(?:jobs\.)?smartrecruiters\.com\/([^/?#]+)\/([^/?#]+)/i);
  if (!m) return null;
  const [, company, jobId] = m;
  if (!jobId || jobId.length < 5) return null;
  try {
    const r = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${company}/postings/${jobId}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!r.ok)
      return {
        ok: false,
        strategy: "smartrecruiters-api",
        error: `API ${r.status}`,
      };
    const d = await r.json();
    const sections = d.jobAd?.sections ?? {};
    const parts = [
      sections.companyDescription?.text &&
        stripHtml(sections.companyDescription.text),
      sections.jobDescription?.text && stripHtml(sections.jobDescription.text),
      sections.qualifications?.text && stripHtml(sections.qualifications.text),
      sections.additionalInformation?.text &&
        stripHtml(sections.additionalInformation.text),
    ].filter(Boolean);
    const loc = d.location?.city ?? d.location?.country ?? "";
    const dept = d.department?.label ?? "";
    const meta = [dept && `Department: ${dept}`, loc && `Location: ${loc}`]
      .filter(Boolean)
      .join("\n");
    return {
      ok: true,
      text: [...parts, meta].filter(Boolean).join("\n\n").trim(),
      title: d.name ?? "",
      strategy: "smartrecruiters-api",
    };
  } catch (e) {
    return { ok: false, strategy: "smartrecruiters-api", error: String(e) };
  }
}

async function fetchBreezyHR(url: string): Promise<AtsResult | null> {
  const m = url.match(/([^.]+)\.breezy\.hr(?:\/p\/([^/?#]+))?/i);
  if (!m || !m[2]) return null;
  const [, company, slug] = m;
  try {
    const r = await fetch(`https://${company}.breezy.hr/json/${slug}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok)
      return { ok: false, strategy: "breezy-api", error: `API ${r.status}` };
    const d = await r.json();
    const text = stripHtml(d.description ?? "");
    const loc = d.location?.name ?? "";
    const dept = d.department?.name ?? "";
    const meta = [dept && `Department: ${dept}`, loc && `Location: ${loc}`]
      .filter(Boolean)
      .join("\n");
    return {
      ok: true,
      text: meta ? `${text}\n\n${meta}` : text,
      title: d.name ?? "",
      strategy: "breezy-api",
    };
  } catch (e) {
    return { ok: false, strategy: "breezy-api", error: String(e) };
  }
}

async function fetchAshby(url: string): Promise<AtsResult | null> {
  if (!/jobs\.ashbyhq\.com/i.test(url)) return null;
  try {
    const r = await fetch(url, {
      headers: HEADERS_CHROME,
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok)
      return { ok: false, strategy: "ashby-ssr", error: `HTTP ${r.status}` };
    const html = await r.text();
    const m = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!m)
      return { ok: false, strategy: "ashby-ssr", error: "no __NEXT_DATA__" };
    const json = JSON.parse(m[1]);
    const job =
      json?.props?.pageProps?.jobPosting ??
      json?.props?.pageProps?.posting ??
      null;
    if (!job)
      return {
        ok: false,
        strategy: "ashby-ssr",
        error: "no job in __NEXT_DATA__",
      };
    return {
      ok: true,
      text: stripHtml(job.descriptionHtml ?? job.content ?? ""),
      title: job.title ?? "",
      strategy: "ashby-ssr",
    };
  } catch (e) {
    return { ok: false, strategy: "ashby-ssr", error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// HTML fetch with 403 retry
// ---------------------------------------------------------------------------

async function fetchHtml(
  url: string,
): Promise<{
  ok: boolean;
  html?: string;
  contentType?: string;
  status?: number;
  error?: string;
}> {
  const go = (h: Record<string, string>) =>
    fetch(url, {
      headers: h,
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
  try {
    const r = await go(HEADERS_CHROME);
    if (r.ok)
      return {
        ok: true,
        html: await r.text(),
        contentType: r.headers.get("content-type") ?? "",
        status: r.status,
      };
    if (r.status === 403 || r.status === 429) {
      await r.body?.cancel();
      const r2 = await go(HEADERS_MINIMAL);
      if (r2.ok)
        return {
          ok: true,
          html: await r2.text(),
          contentType: r2.headers.get("content-type") ?? "",
          status: r2.status,
        };
      await r2.body?.cancel();
      return { ok: false, status: r2.status };
    }
    await r.body?.cancel();
    return { ok: false, status: r.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Lovable's post-processing pipeline (preserved)
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
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (jobStartPatterns.some((p) => p.test(lines[i].trim()))) {
      start = i;
      break;
    }
  }
  const hasJob =
    /\b(requirements?|qualifications?|responsibilities|experience|what\s*you.?ll\s*(do|need|bring)|about\s*(the\s*)?(role|position))\b/i.test(
      markdown,
    );
  if (start > 10 && hasJob) {
    let s = start;
    for (let i = start - 1; i >= Math.max(0, start - 5); i--) {
      const t = lines[i].trim();
      if (t && (t.startsWith("#") || t.startsWith("**"))) {
        s = i;
        break;
      }
    }
    return lines.slice(s).join("\n");
  }
  return markdown;
}

// ---------------------------------------------------------------------------
// Full processing pipeline
// ---------------------------------------------------------------------------

/**
 * Given raw extracted text, apply the full post-processing stack:
 * Lovable's extractJobBlock + cleanJobMarkdown + smart job-parser.
 */
function processText(rawText: string, titleHint?: string): string {
  const jobBlock = extractJobBlock(rawText);
  const cleaned = cleanJobMarkdown(jobBlock);
  // Final pass: section-aware parser strips benefits, EEO, apply instructions
  return cleanJobText(cleaned, titleHint);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return res(
        { success: false, error: "Missing authorization header" },
        401,
      );

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error: authError } = await (
      supabaseAnon.auth as any
    ).getClaims(authHeader.replace("Bearer ", ""));
    if (authError || !data?.claims)
      return res({ success: false, error: "Invalid or expired token" }, 401);
    const userId: string = data.claims.sub;

    // Admin client for cache reads/writes (service role bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── Rate limit ────────────────────────────────────────────────────────────
    if (!checkRateLimit(`scrape-url:${userId}`, 20, 60_000)) {
      return res(
        { success: false, error: "Too many requests – please slow down" },
        429,
      );
    }

    // ── Validate URL ──────────────────────────────────────────────────────────
    const body = await req.json();
    const { url } = body;
    if (!url) return res({ success: false, error: "URL is required" }, 400);

    const validated = validatePublicUrl(url);
    if (!validated.ok)
      return res({ success: false, error: validated.error }, 400);
    const validUrl = validated.url;
    const domain = domainKey(validUrl);

    // ── Step 1: Login-wall fast-path ──────────────────────────────────────────
    const loginMsg = getLoginWallMessage(validUrl);
    if (loginMsg) {
      // Record to DB so repeat visits are instant
      await recordOutcome(supabaseAdmin, domain, {
        success: false,
        strategy: "login-wall",
        notes: "login-wall detected at validation",
      });
      return res({ success: false, extractionFailed: true, error: loginMsg });
    }

    // ── Step 2: Read domain hint (adaptive learning) ───────────────────────────
    const hint = await getDomainHint(supabaseAdmin, domain);
    if (hint) {
      console.log(
        `[scrape-url] Domain hint for ${domain}: strategy=${hint.bestStrategy}, success=${hint.successCount}, fail=${hint.failureCount}`,
      );
    }

    // If the domain was previously found to be login-wall or ip-blocked, short-circuit
    if (
      hint?.bestStrategy === "login-wall" ||
      hint?.bestStrategy === "ip-blocked"
    ) {
      return res({
        success: false,
        extractionFailed: true,
        error: `This site has previously blocked automated access. Please copy the job description and paste it below.`,
      });
    }

    // ── Step 3: ATS JSON APIs ─────────────────────────────────────────────────
    const atsApis: Array<() => Promise<AtsResult | null>> = [
      () => fetchGreenhouse(validUrl),
      () => fetchLever(validUrl),
      () => fetchSmartRecruiters(validUrl),
      () => fetchBreezyHR(validUrl),
      () => fetchAshby(validUrl),
    ];

    // If we know this domain works with a specific ATS API, try it first
    const preferredStrategy = hint?.bestStrategy;
    const strategyOrder = rankedStrategies(hint, [
      "greenhouse-api",
      "lever-api",
      "smartrecruiters-api",
      "breezy-api",
      "ashby-ssr",
      "html-fetch",
    ]);

    let atsText: string | null = null;
    let atsTitle: string | null = null;
    let atsStrategy: string | null = null;

    // Try ATS APIs in ranked order
    for (const strategyName of strategyOrder) {
      if (strategyName === "html-fetch") break; // handled separately below

      const apiFn = atsApis.find((fn) => {
        const testResult = fn.toString();
        return testResult.includes(strategyName.split("-")[0]);
      });

      // Run the matching API
      let result: AtsResult | null = null;
      if (strategyName === "greenhouse-api")
        result = await fetchGreenhouse(validUrl);
      else if (strategyName === "lever-api")
        result = await fetchLever(validUrl);
      else if (strategyName === "smartrecruiters-api")
        result = await fetchSmartRecruiters(validUrl);
      else if (strategyName === "breezy-api")
        result = await fetchBreezyHR(validUrl);
      else if (strategyName === "ashby-ssr")
        result = await fetchAshby(validUrl);

      if (result === null) continue; // this ATS API doesn't match the URL pattern

      if (result.ok && (result.text?.length ?? 0) >= 100) {
        atsText = result.text!;
        atsTitle = result.title ?? null;
        atsStrategy = result.strategy ?? strategyName;
        break;
      }
    }

    if (atsText && atsText.length >= 100) {
      const processed = processText(atsText, atsTitle ?? undefined);
      if (processed.length >= 150) {
        await recordOutcome(supabaseAdmin, domain, {
          success: true,
          strategy: atsStrategy!,
        });
        console.log(
          `[scrape-url] ATS API success via ${atsStrategy} (${processed.length} chars): ${validUrl}`,
        );
        return res({
          success: true,
          markdown: processed.slice(0, 8_000),
          title: atsTitle ?? "",
        });
      }
    }

    // ── Step 4: HTML fetch + Cheerio ──────────────────────────────────────────
    const fetched = await fetchHtml(validUrl);

    if (!fetched.ok) {
      const isTimeout = /timeout|abort/i.test(fetched.error ?? "");
      const isIpBlock = fetched.status === 403;

      // Learn from failure
      await recordOutcome(supabaseAdmin, domain, {
        success: false,
        strategy: isIpBlock ? "ip-blocked" : "html-fetch",
        notes: isIpBlock
          ? `HTTP 403 — likely IP-blocked`
          : `HTTP ${fetched.status ?? "error"}: ${fetched.error ?? ""}`,
      });

      return res({
        success: false,
        extractionFailed: true,
        error: isTimeout
          ? "The page took too long to load. Please paste the job description manually."
          : isIpBlock
            ? "This site is blocking automated access. Please copy the job description from your browser and paste it below."
            : "Unable to reach the page. Please paste the job description manually.",
      });
    }

    const { html = "", contentType = "" } = fetched;
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      return res({
        success: false,
        extractionFailed: true,
        error:
          "The page returned a non-HTML response. Please paste the job description manually.",
      });
    }

    const extraction = await extractWithCheerio(html, validUrl);
    const rawText = extraction.text ?? "";
    const pageTitle = extraction.title ?? "";

    const processed = processText(rawText, pageTitle || undefined);

    if (processed.length < 300) {
      await recordOutcome(supabaseAdmin, domain, {
        success: false,
        strategy: "html-fetch",
        notes: `too short: ${processed.length} chars after processing`,
      });
      return res({
        success: false,
        extractionFailed: true,
        error:
          "We couldn't extract enough content from this URL. Please paste the job description manually.",
        partialText: processed || undefined,
      });
    }

    const hasJobSignals =
      /\b(experience|requirements?|qualifications?|responsibilities|skills?|salary|compensation|benefits?|about\s*(the\s*)?(role|position|company)|what\s*you)\b/i.test(
        processed,
      );
    if (!hasJobSignals) {
      await recordOutcome(supabaseAdmin, domain, {
        success: false,
        strategy: "html-fetch",
        notes: "no job signals in extracted text",
      });
      return res({
        success: false,
        extractionFailed: true,
        error:
          "The extracted content doesn't appear to be a job description. Please paste it manually.",
        partialText: processed.slice(0, 500) || undefined,
      });
    }

    // Learn the successful selector from Cheerio extraction
    const successfulSelector = extraction.strategy ?? "html-fetch";
    await recordOutcome(supabaseAdmin, domain, {
      success: true,
      strategy:
        successfulSelector.startsWith("ats:") ||
        successfulSelector.startsWith("generic:")
          ? `cheerio:${successfulSelector}`
          : "html-fetch",
      selector: successfulSelector,
    });

    console.log(
      `[scrape-url] HTML success via ${successfulSelector} (${processed.length} chars): ${validUrl}`,
    );
    return res({
      success: true,
      markdown: processed.slice(0, 8_000),
      title: pageTitle,
    });
  } catch (error) {
    console.error("[scrape-url] Unhandled error:", error);
    return res(
      {
        success: false,
        extractionFailed: true,
        error: error instanceof Error ? error.message : "Failed to scrape",
      },
      500,
    );
  }
});

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
