import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SearchRequest = {
  skills?: string[];
  jobTypes?: string[];
  location?: string;
  query?: string;
  careerLevel?: string;
  targetTitles?: string[];
  limit?: number;
};

type NormalizedJob = {
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  url: string;
  source: "db" | "firecrawl";
  qualityScore: number;
  urlVerified: boolean;
};

const GENERIC_COMPANY_NAMES = new Set([
  "jobs", "job", "careers", "career", "linkedin", "workday", "lever",
  "company", "unknown",
]);

const BLOCKED_URL_PATTERNS = [
  /linkedin\.com\/company\//i,
  /linkedin\.com\/jobs\/search/i,
  /linkedin\.com\/jobs\/collections/i,
  /linkedin\.com\/feed/i,
  /linkedin\.com\/in\//i,
  /facebook\.com/i, /twitter\.com/i, /instagram\.com/i, /youtube\.com/i,
  /wikipedia\.org/i, /reddit\.com/i,
  /indeed\.com\/q-/i, /indeed\.com\/jobs\?/i,
  /ziprecruiter\.com\/Jobs\/[^/]+\/-*in-/i,
  /glassdoor\.com\/Job\/.*-jobs-/i,
  /monster\.com\/jobs\/search/i, /salary\.com/i, /payscale\.com/i,
  /comparably\.com/i, /jobleads\.com/i, /jooble\./i,
  /simplyhired\.com\/search/i, /careerbuilder\.com\/job\/search/i,
  /jobrapido\.com/i, /neuvoo\./i, /adzuna\./i,
  /snagajob\.com\/jobs\/search/i,
];

const DIRECT_JOB_PATTERNS = [
  /linkedin\.com\/jobs\/view\//i,
  /boards\.greenhouse\.io\/.+\/jobs\//i,
  /job-boards\.greenhouse\.io\/.+\/jobs\//i,
  /jobs\.lever\.co\/[^/?#]+\/[^/?#]+/i,
  /myworkdayjobs\.com\/.+\/job\//i,
  /icims\.com\/jobs\//i,
  /jobvite\.com\/(?:job|jobs|careers)\//i,
  /smartrecruiters\.com\/.+\/jobs\//i,
  /ashbyhq\.com\/.+\/job\//i,
  /applytojob\.com\/apply\//i,
  /indeed\.com\/viewjob/i,
  /glassdoor\.com\/job-listing/i,
  /ziprecruiter\.com\/jobs\//i,
  /wellfound\.com\/jobs\/[a-z0-9-]+/i,
];

const HIGH_SIGNAL_HOST_PATTERNS = [
  /myworkdayjobs\.com/i, /icims\.com/i, /jobvite\.com/i,
  /boards\.greenhouse\.io/i, /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i, /smartrecruiters\.com/i, /ashbyhq\.com/i,
  /wellfound\.com/i, /applytojob\.com/i,
];

const GENERIC_LISTING_PATH_SEGMENTS = new Set([
  "jobs", "job", "careers", "career", "open-positions", "positions",
  "search", "results", "openings", "all", "index", "list",
]);

const REDIRECT_QUERY_KEYS = [
  "url", "u", "target", "dest", "destination", "redirect",
  "redirect_url", "redirect_uri", "job_url", "jobUrl",
  "apply", "apply_url", "applyUrl", "to",
];

const NON_JOB_PAGE_SEGMENTS = new Set([
  "about", "company", "team", "culture", "people", "mission",
  "values", "home", "contact", "index", "search", "results", "openings", "all",
]);

// ── Utility functions ──────────────────────────────────────────────────

function normalizeText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeJobUrl(rawValue: unknown): string {
  if (typeof rawValue !== "string") return "";
  let value = normalizeText(rawValue);
  if (!value) return "";

  const markdownUrl = value.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdownUrl?.[1]) value = markdownUrl[1];
  const plainHttpUrl = value.match(/https?:\/\/[^\s<>'"\])]+/i);
  if (plainHttpUrl?.[0]) value = plainHttpUrl[0];
  value = value.replace(/[),.;]+$/g, "").trim();
  if (!value) return "";

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    let parsed = new URL(withProtocol);
    for (let i = 0; i < 3; i++) {
      const wrapped = REDIRECT_QUERY_KEYS
        .map((key) => parsed.searchParams.get(key))
        .find((c) => typeof c === "string" && c.trim().length > 0);
      if (!wrapped) break;
      const decoded = decodeURIComponent(wrapped).trim();
      const nextValue = /^https?:\/\//i.test(decoded) ? decoded : `https://${decoded}`;
      try { parsed = new URL(nextValue); } catch { break; }
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || host.includes("example.com") || host.includes("placeholder")) return "";
    return parsed.toString();
  } catch { return ""; }
}

function getUrlHost(rawUrl: string): string {
  try { return new URL(rawUrl).hostname.toLowerCase(); } catch { return ""; }
}

function isBlockedUrl(rawUrl: string): boolean {
  if (!rawUrl) return true;
  try {
    const href = new URL(rawUrl.trim()).toString();
    return BLOCKED_URL_PATTERNS.some((p) => p.test(href));
  } catch { return true; }
}

function isGenericListingUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return true;
    if (host.includes("jobs.lever.co") && parts.length <= 1) return true;
    if ((host.includes("greenhouse.io") || host.includes("greenhouse.com")) && parts.length <= 1) return true;
    if (parts.every((s) => GENERIC_LISTING_PATH_SEGMENTS.has(s))) return true;
    if (parts.length <= 2) {
      if (["q", "query", "keywords", "search", "location", "department", "team"].some((k) => parsed.searchParams.has(k))) return true;
    }
    return false;
  } catch { return true; }
}

function hasDirectPathSignals(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return false;
    const last = parts[parts.length - 1] || "";
    if (NON_JOB_PAGE_SEGMENTS.has(last)) return false;
    const hasJobWordInPath = parts.some((p) => /job|jobs|position|opening|opportunit|career/.test(p));
    const hasNumericId = parts.some((p) => /\d{4,}/.test(p));
    const hasLongSlug = parts.some((p) => p.includes("-") && p.length >= 16);
    const hasKnownJobQuery = ["gh_jid", "job", "jobid", "jk", "lever-source", "oid", "gh_src"].some((k) => url.searchParams.has(k));
    const explicitJobPath = /(\/jobs?\/|\/careers?\/).+/.test(url.pathname.toLowerCase());
    if (parts.length <= 2 && !hasNumericId && !hasLongSlug && !hasKnownJobQuery && !explicitJobPath) return false;
    return hasJobWordInPath || hasNumericId || hasLongSlug || hasKnownJobQuery || explicitJobPath;
  } catch { return false; }
}

function isDirectJobPostingUrl(rawUrl: string): boolean {
  const normalized = normalizeJobUrl(rawUrl);
  if (!normalized) return false;
  if (isBlockedUrl(normalized)) return false;
  if (isGenericListingUrl(normalized)) return false;
  if (DIRECT_JOB_PATTERNS.some((p) => p.test(normalized))) return true;
  return hasDirectPathSignals(normalized);
}

function isHighSignalHost(rawUrl: string): boolean {
  const host = getUrlHost(rawUrl);
  if (!host || host.includes("linkedin.com")) return false;
  return HIGH_SIGNAL_HOST_PATTERNS.some((p) => p.test(host));
}

function inferJobType(text: string): string {
  const t = text.toLowerCase();
  if (/\bcontract\b/.test(t)) return "contract";
  if (/\bpart[- ]time\b/.test(t)) return "part-time";
  if (/\bintern\b/.test(t)) return "internship";
  return "full-time";
}

function inferLocation(input: string, fallback: string): string {
  const text = normalizeText(input);
  if (!text) return fallback || "Remote";
  if (/\bremote\b/i.test(text)) return "Remote";
  return text;
}

function cleanMarkdownText(input: string): string {
  return normalizeText(
    input
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`~\-|]+/g, " ")
      .replace(/\s{2,}/g, " "),
  );
}

function looksLikeLocationText(value: string): boolean {
  const v = normalizeText(value).toLowerCase();
  if (!v) return false;
  if (/\bremote\b/.test(v)) return true;
  if (/^[a-z\s]+,\s*[a-z]{2}$/.test(v)) return true;
  if (/\b(united states|usa|us|canada|uk|united kingdom)\b/.test(v)) return true;
  return false;
}

function isSuspiciousCompanyName(company: string): boolean {
  const cleaned = normalizeText(company);
  if (!cleaned) return true;
  if (GENERIC_COMPANY_NAMES.has(cleaned.toLowerCase())) return true;
  if (looksLikeLocationText(cleaned)) return true;
  return cleaned.length < 2;
}

function isLowSignalDescription(description: string, rawUrl: string): boolean {
  const text = normalizeText(description).toLowerCase();
  const host = getUrlHost(rawUrl);
  if (!text) return true;
  if (text.length < 120 || text.split(/\s+/).length < 20) return true;
  const lowPatterns = [
    /jobs powered by/i, /view all jobs/i, /join our talent network/i,
    /showing \d+ results/i, /search results for/i, /browse \d+ jobs/i,
    /sign up for job alerts/i, /filter by location/i, /page \d+ of \d+/i,
  ];
  if (lowPatterns.some((p) => p.test(text))) return true;
  if (host.includes("linkedin.com")) {
    if ([/get notified about new/i, /similar searches/i, /see who .* has hired/i].some((p) => p.test(text))) return true;
  }
  return false;
}

function normalizeJobTitle(rawTitle: string): string {
  const title = normalizeText(rawTitle);
  if (!title) return "Job Opportunity";
  const linkedInHiringMatch = title.match(/^.+?\s+hiring\s+(.+?)\s+in\s+.+\|\s*linkedin$/i);
  if (linkedInHiringMatch?.[1]) return normalizeText(linkedInHiringMatch[1]);
  return normalizeText(
    title
      .replace(/\s*[|\-–—]\s*(lever|linkedin|workday|icims|jobvite|jobleads|jooble|indeed|glassdoor|ziprecruiter|monster|simplyhired|talent|adzuna|jobrapido|getwork|snagajob)\.?\w*$/i, "")
      .replace(/\s*\|\s*[A-Z][a-z]+(?:\s*,\s*[A-Z]{2})?\s*\|\s*\w+\.com$/i, "")
      .replace(/\s*\|\s*\S+\.com$/i, ""),
  );
}

function isAggregatorListingTitle(title: string): boolean {
  const t = normalizeText(title).toLowerCase();
  if (!t) return true;
  if (/\bjobs?\s+(in|near|around|for)\s+/i.test(t)) return true;
  if (/\bjobs?\s*$/i.test(t) && t.split(/\s+/).length <= 5) return true;
  if (/^(search|browse|find|explore|view|all)\s+(results|jobs|positions|openings)/i.test(t)) return true;
  if (/^\d+\+?\s+(jobs|positions|openings)/i.test(t)) return true;
  if (t === "job opportunity") return true;
  return false;
}

function extractCompanyFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (host.includes("jobs.lever.co") && parts[0]) {
      return parts[0].split(/[-_]/g).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    }
    if ((host.includes("greenhouse.io") || host.includes("greenhouse.com")) && parts[0]) {
      return parts[0].split(/[-_]/g).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    }
    return "";
  } catch { return ""; }
}

function extractCompany(rawCompany: string, title: string, url: string): string {
  const cleanedRaw = normalizeText(rawCompany);
  if (cleanedRaw && !GENERIC_COMPANY_NAMES.has(cleanedRaw.toLowerCase())) return cleanedRaw;
  const fromUrl = extractCompanyFromUrl(url);
  if (fromUrl) return fromUrl;
  const hiringMatch = title.match(/^(.{2,80}?)\s+hiring\b/i);
  if (hiringMatch?.[1]) {
    const c = normalizeText(hiringMatch[1]);
    if (c && !GENERIC_COMPANY_NAMES.has(c.toLowerCase())) return c;
  }
  const atMatch = title.match(/\s+at\s+([^|\-]{2,80})/i);
  if (atMatch?.[1]) return normalizeText(atMatch[1]);
  return cleanedRaw;
}

function extractCompanyFromHost(rawUrl: string): string {
  try {
    const { hostname } = new URL(rawUrl);
    const host = hostname.replace(/^www\./, "");
    const base = host.split(".")[0] || "company";
    const inferred = base.split(/[-_]/g).filter(Boolean).map((p) => p[0]?.toUpperCase() + p.slice(1)).join(" ");
    return isSuspiciousCompanyName(inferred) ? "" : inferred;
  } catch { return ""; }
}

function extractLocation(rawLocation: string, title: string, description: string, fallback: string): string {
  const candidate = normalizeText(rawLocation);
  if (candidate && candidate.length <= 80) return inferLocation(candidate, fallback);
  const text = `${title} ${description}`;
  if (/\bremote\b/i.test(text)) return "Remote";
  const usCityState = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})\b/);
  if (usCityState?.[1]) return usCityState[1];
  return fallback || "Remote";
}

function extractUrlCandidatesFromText(input: string): string[] {
  if (!input) return [];
  // Only extract from first 500 chars to save memory
  const trimmed = input.slice(0, 500);
  const markdownMatches = [...trimmed.matchAll(/\((https?:\/\/[^)\s]+)\)/gi)].map((m) => m[1]);
  const plainMatches = trimmed.match(/https?:\/\/[^\s<>'"\])]+/gi) || [];
  return [...markdownMatches, ...plainMatches];
}

function scoreCandidateUrl(rawCandidate: string): number {
  const normalized = normalizeJobUrl(rawCandidate);
  if (!normalized) return -999;
  if (isBlockedUrl(normalized)) return -500;
  let score = 0;
  if (DIRECT_JOB_PATTERNS.some((p) => p.test(normalized))) score += 120;
  if (isHighSignalHost(normalized)) score += 30;
  if (hasDirectPathSignals(normalized)) score += 40;
  if (isGenericListingUrl(normalized)) score -= 120;
  return score;
}

function pickBestJobUrl(candidates: string[]): string {
  if (!candidates.length) return "";
  const scored = [...new Set(candidates.map((c) => normalizeJobUrl(c)).filter(Boolean))]
    .map((url) => ({ url, score: scoreCandidateUrl(url) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 20) return "";
  return best.url;
}

function hasMinimalDescription(description: string): boolean {
  const text = normalizeText(description);
  return text.length >= 100 && text.split(/\s+/).length >= 15;
}

// ── Search query building ──────────────────────────────────────────────

function cleanSearchFragment(input: string, maxWords = 10): string {
  const ignoredTokens = new Set(["and", "or", "with", "for", "the", "of", "to", "in", "at"]);
  return normalizeText(input)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9+\-\/\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !ignoredTokens.has(t.toLowerCase()))
    .slice(0, maxWords)
    .join(" ");
}

function tokenize(text: string): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "job", "jobs", "role", "work", "full", "time", "part",
    "remote", "hybrid", "onsite", "in", "at", "on", "to", "of", "a", "an",
  ]);
  return normalizeText(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t));
}

function buildSearchQueries(params: {
  query: string; targetTitles: string[]; skills: string[];
  careerLevel: string; jobTypes: string[];
}): string[] {
  const titles = params.targetTitles.map((t) => cleanSearchFragment(t, 8)).filter(Boolean).slice(0, 3);
  const skills = params.skills.map((s) => cleanSearchFragment(s, 4)).filter(Boolean).slice(0, 4);
  const explicitQuery = cleanSearchFragment(params.query, 10);
  const level = cleanSearchFragment(params.careerLevel, 4);
  const remoteHint = params.jobTypes.some((t) => /remote/i.test(t)) ? "remote" : "";
  const primaryRole = explicitQuery || titles[0] || skills[0] || "software engineer";
  const secondaryRole = titles[1] || cleanSearchFragment(`${primaryRole} ${skills[0] || ""}`, 10);
  const roleWithLevel = cleanSearchFragment(`${level} ${primaryRole}`, 10);

  const candidates = [
    cleanSearchFragment(`${primaryRole} ${remoteHint}`, 10),
    cleanSearchFragment(`${secondaryRole} ${remoteHint}`, 10),
    cleanSearchFragment(`${roleWithLevel} ${remoteHint}`, 10),
  ];
  const deduped = [...new Set(candidates.filter((c) => c.length >= 4))].slice(0, 2);
  return deduped.length ? deduped : ["software engineer remote"];
}

// ── Data fetching ──────────────────────────────────────────────────────

async function fetchDatabaseJobs(supabaseAdmin: any): Promise<NormalizedJob[]> {
  const { data, error } = await supabaseAdmin
    .from("scraped_jobs")
    .select("title, company, location, job_type, description, job_url, quality_score")
    .gte("quality_score", 30)
    .not("job_url", "is", null)
    .order("quality_score", { ascending: false })
    .limit(200);

  if (error) { console.error("DB error:", error.message); return []; }
  if (!data?.length) { console.warn("fetchDatabaseJobs: 0 rows"); return []; }

  return (data || [])
    .map((row: any) => {
      const url = normalizeJobUrl(row.job_url);
      return {
        title: normalizeText(row.title),
        company: normalizeText(row.company),
        location: inferLocation(row.location, "Remote"),
        type: normalizeText(row.job_type) || "full-time",
        description: normalizeText(row.description).slice(0, 500),
        url,
        source: "db" as const,
        qualityScore: Number(row.quality_score || 0),
        urlVerified: isDirectJobPostingUrl(url),
      };
    })
    .filter((j) => j.url && j.title && !isSuspiciousCompanyName(j.company))
    .filter((j) => !isAggregatorListingTitle(j.title))
    .filter((j) => !isBlockedUrl(j.url) && !isGenericListingUrl(j.url));
}

async function searchFirecrawlJobs(
  firecrawlApiKey: string,
  queries: string[],
  location: string,
  limit: number,
): Promise<NormalizedJob[]> {
  const locationHint = cleanSearchFragment(location, 5);
  const mergedJobs = new Map<string, NormalizedJob>();

  // Only run up to 2 queries to stay within memory
  for (const [index, query] of queries.slice(0, 2).entries()) {
    const q = normalizeText(`${query} ${locationHint} hiring`).slice(0, 200);
    console.log(`Firecrawl query #${index + 1}:`, q);

    let response: Response;
    try {
      response = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: q,
          limit: 15, // Reduced from 30 to save memory
          tbs: "qdr:m",
          scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
        }),
      });
    } catch (fetchErr) {
      console.error(`Firecrawl fetch error query #${index + 1}:`, fetchErr);
      continue;
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Firecrawl failed query #${index + 1}:`, response.status, errText.slice(0, 200));
      continue;
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      console.error(`Firecrawl JSON parse failed query #${index + 1}`);
      continue;
    }

    const rows = Array.isArray(payload?.data) ? payload.data
      : Array.isArray(payload?.results) ? payload.results : [];
    console.log(`Firecrawl returned ${rows.length} results for query #${index + 1}`);

    for (const row of rows) {
      const urlCandidates = [
        row.url, row.link, row.sourceURL,
        row?.metadata?.sourceURL, row?.metadata?.url,
        ...extractUrlCandidatesFromText(row.title || ""),
      ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

      const url = pickBestJobUrl(urlCandidates);
      if (!url || !isDirectJobPostingUrl(url)) continue;
      if (isAggregatorListingTitle(row.title || "")) continue;

      // Truncate description early to save memory
      const description = cleanMarkdownText(row.markdown || row.description || "").slice(0, 500);
      if (!hasMinimalDescription(description)) continue;

      const title = normalizeJobTitle(row.title || "Job Opportunity");
      const company = extractCompany(row.company || "", title, url) || extractCompanyFromHost(url);
      if (!company || isSuspiciousCompanyName(company)) continue;

      const job: NormalizedJob = {
        title,
        company,
        location: extractLocation(row.location || "", title, description, location || "Remote"),
        type: inferJobType(`${title} ${description}`),
        description,
        url,
        source: "firecrawl",
        qualityScore: Math.min(90, Math.max(50, Math.floor(description.split(/\s+/).length / 3) + 40)),
        urlVerified: DIRECT_JOB_PATTERNS.some((p) => p.test(url)),
      };

      const existing = mergedJobs.get(url);
      if (!existing || job.qualityScore > existing.qualityScore) {
        mergedJobs.set(url, job);
      }

      // Drop the row reference to allow GC
      row.markdown = undefined;
      row.description = undefined;
    }

    // Free the payload
    payload = null;

    console.log(`After query #${index + 1}: ${mergedJobs.size} total jobs`);
    if (mergedJobs.size >= limit) break;
  }

  return [...mergedJobs.values()];
}

// ── Scoring ────────────────────────────────────────────────────────────

function scoreJobMatch(
  job: NormalizedJob,
  skillTokens: string[],
  titleTokens: string[],
  titlePhrases: string[],
  locationPref: string,
): { finalScore: number; skillHits: number; titleHits: number; phraseHit: boolean } {
  const haystack = `${job.title} ${job.description} ${job.company} ${job.type} ${job.location}`.toLowerCase();
  const host = getUrlHost(job.url);

  let score = job.qualityScore;
  const skillHits = skillTokens.filter((t) => haystack.includes(t)).length;
  const titleHits = titleTokens.filter((t) => haystack.includes(t)).length;
  const phraseHit = titlePhrases.some((p) => p && job.title.toLowerCase().includes(p));

  score += skillHits * 12 + titleHits * 7 + (phraseHit ? 20 : 0);

  const loc = normalizeText(locationPref).toLowerCase();
  if (loc) {
    if (job.location.toLowerCase().includes(loc)) score += 15;
    if (loc.includes("remote") && /remote/i.test(job.location)) score += 20;
  }
  if (/remote/i.test(job.location)) score += 4;
  if (job.urlVerified) score += 10;
  if (isHighSignalHost(job.url)) score += 8;
  if (host.includes("linkedin.com")) score -= 6;
  if (isSuspiciousCompanyName(job.company)) score -= 14;

  return { finalScore: score, skillHits, titleHits, phraseHit };
}

function buildSearchUrl(title: string, company: string): string {
  const q = encodeURIComponent(`${title} ${company}`);
  return `https://www.linkedin.com/jobs/search/?keywords=${q}`;
}

// ── Main handler ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    if (!checkRateLimit(`search-jobs:${userId}`, 30, 60_000)) {
      return new Response(JSON.stringify({ error: "Too many requests" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    const requestBody: SearchRequest = await req.json();
    const skills = Array.isArray(requestBody.skills) ? requestBody.skills : [];
    const targetTitles = Array.isArray(requestBody.targetTitles) ? requestBody.targetTitles : [];
    const jobTypes = Array.isArray(requestBody.jobTypes) ? requestBody.jobTypes : [];
    const location = normalizeText(requestBody.location);
    const query = normalizeText(requestBody.query);
    const careerLevel = normalizeText(requestBody.careerLevel);
    const limit = Math.max(5, Math.min(Number(requestBody.limit || 50), 100));

    const searchQueries = buildSearchQueries({ query, targetTitles, skills, careerLevel, jobTypes });
    const skillTokens = tokenize(skills.join(" ")).slice(0, 16);
    const titleTokens = tokenize(`${targetTitles.join(" ")} ${query} ${careerLevel}`).slice(0, 16);
    const titlePhrases = targetTitles
      .map((t) => cleanSearchFragment(t, 8).toLowerCase())
      .filter((t) => t.length >= 5)
      .slice(0, 4);

    console.log("Queries:", searchQueries, "location:", location);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Run DB and Firecrawl in parallel
    const [databaseJobs, crawledJobs] = await Promise.all([
      fetchDatabaseJobs(supabaseAdmin),
      firecrawlApiKey
        ? searchFirecrawlJobs(firecrawlApiKey, searchQueries, location, limit)
        : Promise.resolve([] as NormalizedJob[]),
    ]);

    console.log(`DB: ${databaseJobs.length}, Crawled: ${crawledJobs.length}`);

    // Deduplicate by URL
    const dedupedByUrl = new Map<string, NormalizedJob>();
    for (const job of [...databaseJobs, ...crawledJobs]) {
      if (!job.url) continue;
      const existing = dedupedByUrl.get(job.url);
      if (!existing || job.qualityScore > existing.qualityScore) {
        dedupedByUrl.set(job.url, job);
      }
    }

    // Score and rank (NO live URL verification — just pattern matching)
    const ranked = [...dedupedByUrl.values()]
      .map((job) => {
        const match = scoreJobMatch(job, skillTokens, titleTokens, titlePhrases, location);
        return { ...job, ...match };
      })
      .filter((j) => j.phraseHit || j.skillHits >= 1 || j.titleHits >= 1 || j.finalScore >= 50)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit)
      .map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        description: job.description,
        matchReason: job.urlVerified
          ? `Direct posting • ${job.skillHits} skill matches`
          : `Web search • ${job.skillHits} skill matches`,
        url: job.url,
        googleUrl: buildSearchUrl(job.title, job.company),
        urlVerified: job.urlVerified,
        urlType: job.urlVerified ? "direct" : "search",
      }));

    console.log(`Returning ${ranked.length} jobs`);

    return new Response(JSON.stringify({ jobs: ranked, citations: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-jobs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
