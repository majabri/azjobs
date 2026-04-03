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
  // Polling mode: client sends job_id to check status
  job_id?: string;
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

// ── Constants ──────────────────────────────────────────────────────────

const GENERIC_COMPANY_NAMES = new Set([
  "jobs", "job", "careers", "career", "linkedin", "workday", "lever", "company", "unknown",
]);

const BLOCKED_URL_PATTERNS = [
  /linkedin\.com\/company\//i, /linkedin\.com\/jobs\/search/i,
  /linkedin\.com\/jobs\/collections/i, /linkedin\.com\/feed/i, /linkedin\.com\/in\//i,
  /facebook\.com/i, /twitter\.com/i, /instagram\.com/i, /youtube\.com/i,
  /wikipedia\.org/i, /reddit\.com/i,
  /indeed\.com\/q-/i, /indeed\.com\/jobs\?/i,
  /ziprecruiter\.com\/Jobs\/[^/]+\/-*in-/i,
  /glassdoor\.com\/Job\/.*-jobs-/i,
  /monster\.com\/jobs\/search/i, /salary\.com/i, /payscale\.com/i,
  /comparably\.com/i, /jobleads\.com/i, /jooble\./i,
  /simplyhired\.com\/search/i, /careerbuilder\.com\/job\/search/i,
  /jobrapido\.com/i, /neuvoo\./i, /adzuna\./i, /snagajob\.com\/jobs\/search/i,
];

const DIRECT_JOB_PATTERNS = [
  /linkedin\.com\/jobs\/view\//i,
  /boards\.greenhouse\.io\/.+\/jobs\//i, /job-boards\.greenhouse\.io\/.+\/jobs\//i,
  /jobs\.lever\.co\/[^/?#]+\/[^/?#]+/i, /myworkdayjobs\.com\/.+\/job\//i,
  /icims\.com\/jobs\//i, /jobvite\.com\/(?:job|jobs|careers)\//i,
  /smartrecruiters\.com\/.+\/jobs\//i, /ashbyhq\.com\/.+\/job\//i,
  /applytojob\.com\/apply\//i, /indeed\.com\/viewjob/i,
  /glassdoor\.com\/job-listing/i, /ziprecruiter\.com\/jobs\//i,
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
  "redirect_url", "redirect_uri", "job_url", "jobUrl", "apply", "apply_url", "applyUrl", "to",
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
      const wrapped = REDIRECT_QUERY_KEYS.map((k) => parsed.searchParams.get(k))
        .find((c) => typeof c === "string" && c.trim().length > 0);
      if (!wrapped) break;
      const decoded = decodeURIComponent(wrapped).trim();
      try { parsed = new URL(/^https?:\/\//i.test(decoded) ? decoded : `https://${decoded}`); } catch { break; }
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
  try { return BLOCKED_URL_PATTERNS.some((p) => p.test(new URL(rawUrl.trim()).toString())); }
  catch { return true; }
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
    if (parts.length <= 2 && ["q", "query", "keywords", "search", "location", "department", "team"].some((k) => parsed.searchParams.has(k))) return true;
    return false;
  } catch { return true; }
}

function hasDirectPathSignals(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return false;
    if (NON_JOB_PAGE_SEGMENTS.has(parts[parts.length - 1] || "")) return false;
    const hasJobWord = parts.some((p) => /job|jobs|position|opening|opportunit|career/.test(p));
    const hasNumericId = parts.some((p) => /\d{4,}/.test(p));
    const hasLongSlug = parts.some((p) => p.includes("-") && p.length >= 16);
    const hasKnownQuery = ["gh_jid", "job", "jobid", "jk", "lever-source", "oid", "gh_src"].some((k) => url.searchParams.has(k));
    const explicitPath = /(\/jobs?\/|\/careers?\/).+/.test(url.pathname.toLowerCase());
    if (parts.length <= 2 && !hasNumericId && !hasLongSlug && !hasKnownQuery && !explicitPath) return false;
    return hasJobWord || hasNumericId || hasLongSlug || hasKnownQuery || explicitPath;
  } catch { return false; }
}

function isDirectJobPostingUrl(rawUrl: string): boolean {
  const normalized = normalizeJobUrl(rawUrl);
  if (!normalized || isBlockedUrl(normalized) || isGenericListingUrl(normalized)) return false;
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
    input.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`~\-|]+/g, " ").replace(/\s{2,}/g, " "),
  );
}

function looksLikeLocationText(value: string): boolean {
  const v = normalizeText(value).toLowerCase();
  if (!v) return false;
  return /\bremote\b/.test(v) || /^[a-z\s]+,\s*[a-z]{2}$/.test(v) ||
    /\b(united states|usa|us|canada|uk|united kingdom)\b/.test(v);
}

function isSuspiciousCompanyName(company: string): boolean {
  const cleaned = normalizeText(company);
  return !cleaned || GENERIC_COMPANY_NAMES.has(cleaned.toLowerCase()) || looksLikeLocationText(cleaned) || cleaned.length < 2;
}

function isLowSignalDescription(description: string, rawUrl: string): boolean {
  const text = normalizeText(description).toLowerCase();
  const host = getUrlHost(rawUrl);
  if (!text || text.length < 120 || text.split(/\s+/).length < 20) return true;
  if ([/jobs powered by/i, /view all jobs/i, /showing \d+ results/i, /search results for/i, /browse \d+ jobs/i, /sign up for job alerts/i, /page \d+ of \d+/i].some((p) => p.test(text))) return true;
  if (host.includes("linkedin.com") && [/get notified about new/i, /similar searches/i, /see who .* has hired/i].some((p) => p.test(text))) return true;
  return false;
}

function normalizeJobTitle(rawTitle: string): string {
  const title = normalizeText(rawTitle);
  if (!title) return "Job Opportunity";
  const lim = title.match(/^.+?\s+hiring\s+(.+?)\s+in\s+.+\|\s*linkedin$/i);
  if (lim?.[1]) return normalizeText(lim[1]);
  return normalizeText(title
    .replace(/\s*[|\-–—]\s*(lever|linkedin|workday|icims|jobvite|jobleads|jooble|indeed|glassdoor|ziprecruiter|monster|simplyhired|talent|adzuna|jobrapido|getwork|snagajob)\.?\w*$/i, "")
    .replace(/\s*\|\s*\S+\.com$/i, ""));
}

function isAggregatorListingTitle(title: string): boolean {
  const t = normalizeText(title).toLowerCase();
  if (!t) return true;
  if (/\bjobs?\s+(in|near|around|for)\s+/i.test(t)) return true;
  if (/\bjobs?\s*$/i.test(t) && t.split(/\s+/).length <= 5) return true;
  if (/^(search|browse|find|explore|view|all)\s+(results|jobs|positions|openings)/i.test(t)) return true;
  if (/^\d+\+?\s+(jobs|positions|openings)/i.test(t)) return true;
  return t === "job opportunity";
}

function extractCompanyFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    if ((host.includes("jobs.lever.co") || host.includes("greenhouse.io") || host.includes("greenhouse.com")) && parts[0]) {
      return parts[0].split(/[-_]/g).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    }
    return "";
  } catch { return ""; }
}

function extractCompany(rawCompany: string, title: string, url: string): string {
  const c = normalizeText(rawCompany);
  if (c && !GENERIC_COMPANY_NAMES.has(c.toLowerCase())) return c;
  const fromUrl = extractCompanyFromUrl(url);
  if (fromUrl) return fromUrl;
  const hm = title.match(/^(.{2,80}?)\s+hiring\b/i);
  if (hm?.[1] && !GENERIC_COMPANY_NAMES.has(normalizeText(hm[1]).toLowerCase())) return normalizeText(hm[1]);
  const am = title.match(/\s+at\s+([^|\-]{2,80})/i);
  if (am?.[1]) return normalizeText(am[1]);
  return c;
}

function extractCompanyFromHost(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, "");
    const base = host.split(".")[0] || "company";
    const inferred = base.split(/[-_]/g).filter(Boolean).map((p) => p[0]?.toUpperCase() + p.slice(1)).join(" ");
    return isSuspiciousCompanyName(inferred) ? "" : inferred;
  } catch { return ""; }
}

function extractLocation(rawLoc: string, title: string, desc: string, fallback: string): string {
  const c = normalizeText(rawLoc);
  if (c && c.length <= 80) return inferLocation(c, fallback);
  const text = `${title} ${desc}`;
  if (/\bremote\b/i.test(text)) return "Remote";
  const m = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})\b/);
  if (m?.[1]) return m[1];
  return fallback || "Remote";
}

function extractUrlCandidatesFromText(input: string): string[] {
  if (!input) return [];
  const trimmed = input.slice(0, 500);
  const md = [...trimmed.matchAll(/\((https?:\/\/[^)\s]+)\)/gi)].map((m) => m[1]);
  const plain = trimmed.match(/https?:\/\/[^\s<>'"\])]+/gi) || [];
  return [...md, ...plain];
}

function scoreCandidateUrl(raw: string): number {
  const n = normalizeJobUrl(raw);
  if (!n) return -999;
  if (isBlockedUrl(n)) return -500;
  let s = 0;
  if (DIRECT_JOB_PATTERNS.some((p) => p.test(n))) s += 120;
  if (isHighSignalHost(n)) s += 30;
  if (hasDirectPathSignals(n)) s += 40;
  if (isGenericListingUrl(n)) s -= 120;
  return s;
}

function pickBestJobUrl(candidates: string[]): string {
  if (!candidates.length) return "";
  const scored = [...new Set(candidates.map((c) => normalizeJobUrl(c)).filter(Boolean))]
    .map((url) => ({ url, score: scoreCandidateUrl(url) })).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 20 ? scored[0].url : "";
}

function hasMinimalDescription(desc: string): boolean {
  const t = normalizeText(desc);
  return t.length >= 100 && t.split(/\s+/).length >= 15;
}

function cleanSearchFragment(input: string, maxWords = 10): string {
  const ignored = new Set(["and", "or", "with", "for", "the", "of", "to", "in", "at"]);
  return normalizeText(input).replace(/\([^)]*\)/g, " ").replace(/[^a-zA-Z0-9+\-\/\s]/g, " ")
    .split(/\s+/).filter((t) => t.length >= 2 && !ignored.has(t.toLowerCase())).slice(0, maxWords).join(" ");
}

function tokenize(text: string): string[] {
  const stop = new Set(["the", "and", "for", "with", "from", "that", "this", "job", "jobs", "role", "work", "full", "time", "part", "remote", "hybrid", "onsite", "in", "at", "on", "to", "of", "a", "an"]);
  return normalizeText(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !stop.has(t));
}

function buildSearchQueries(p: { query: string; targetTitles: string[]; skills: string[]; careerLevel: string; jobTypes: string[] }): string[] {
  const titles = p.targetTitles.map((t) => cleanSearchFragment(t, 8)).filter(Boolean).slice(0, 3);
  const skills = p.skills.map((s) => cleanSearchFragment(s, 4)).filter(Boolean).slice(0, 4);
  const eq = cleanSearchFragment(p.query, 10);
  const level = cleanSearchFragment(p.careerLevel, 4);
  const remote = p.jobTypes.some((t) => /remote/i.test(t)) ? "remote" : "";
  const primary = eq || titles[0] || skills[0] || "software engineer";
  const secondary = titles[1] || cleanSearchFragment(`${primary} ${skills[0] || ""}`, 10);
  const candidates = [
    cleanSearchFragment(`${primary} ${remote}`, 10),
    cleanSearchFragment(`${secondary} ${remote}`, 10),
  ];
  const deduped = [...new Set(candidates.filter((c) => c.length >= 4))].slice(0, 2);
  return deduped.length ? deduped : ["jobs hiring now"];
}

// ── Data fetching ──────────────────────────────────────────────────────

async function fetchDatabaseJobs(supabaseAdmin: any): Promise<NormalizedJob[]> {
  const { data, error } = await supabaseAdmin
    .from("scraped_jobs")
    .select("title, company, location, job_type, description, job_url, quality_score")
    .gte("quality_score", 10).not("job_url", "is", null)
    .order("quality_score", { ascending: false }).limit(100);
  if (error) { console.error("DB error:", error.message); return []; }
  if (!data?.length) { console.warn("fetchDatabaseJobs: 0 rows"); return []; }
  return data.map((row: any) => {
    const url = normalizeJobUrl(row.job_url);
    return {
      title: normalizeText(row.title), company: normalizeText(row.company),
      location: inferLocation(row.location, "Remote"),
      type: normalizeText(row.job_type) || "full-time",
      description: normalizeText(row.description).slice(0, 400),
      url, source: "db" as const,
      qualityScore: Number(row.quality_score || 0),
      urlVerified: isDirectJobPostingUrl(url),
    };
  }).filter((j: NormalizedJob) => j.url && j.title && !isSuspiciousCompanyName(j.company)
    && !isAggregatorListingTitle(j.title) && !isBlockedUrl(j.url) && !isGenericListingUrl(j.url));
}

async function searchFirecrawlSingleQuery(
  firecrawlApiKey: string, query: string, location: string,
): Promise<NormalizedJob[]> {
  const q = normalizeText(`${query} ${cleanSearchFragment(location, 5)} hiring`).slice(0, 200);
  console.log(`Firecrawl query:`, q);

  let response: Response;
  try {
    response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, limit: 10, tbs: "qdr:m", scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
    });
  } catch (e) { console.error("Firecrawl fetch error:", e); return []; }

  if (!response.ok) {
    await response.text(); // consume body
    return [];
  }

  let payload: any;
  try { payload = await response.json(); } catch { return []; }

  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.results) ? payload.results : [];
  console.log(`Firecrawl returned ${rows.length} results`);

  const jobs: NormalizedJob[] = [];
  for (const row of rows) {
    const urlCandidates = [row.url, row.link, row.sourceURL, row?.metadata?.sourceURL, row?.metadata?.url,
      ...extractUrlCandidatesFromText(row.title || "")].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    const url = pickBestJobUrl(urlCandidates);
    if (!url || !isDirectJobPostingUrl(url) || isAggregatorListingTitle(row.title || "")) continue;
    const description = cleanMarkdownText(row.markdown || row.description || "").slice(0, 400);
    if (!hasMinimalDescription(description)) continue;
    const title = normalizeJobTitle(row.title || "Job Opportunity");
    const company = extractCompany(row.company || "", title, url) || extractCompanyFromHost(url);
    if (!company || isSuspiciousCompanyName(company)) continue;
    jobs.push({
      title, company, location: extractLocation(row.location || "", title, description, location || "Remote"),
      type: inferJobType(`${title} ${description}`), description, url, source: "firecrawl",
      qualityScore: Math.min(90, Math.max(50, Math.floor(description.split(/\s+/).length / 3) + 40)),
      urlVerified: DIRECT_JOB_PATTERNS.some((p) => p.test(url)),
    });
    // Free memory
    row.markdown = undefined; row.description = undefined;
  }
  payload = null;
  return jobs;
}

// ── Scoring ────────────────────────────────────────────────────────────

function scoreJobMatch(
  job: NormalizedJob, skillTokens: string[], titleTokens: string[],
  titlePhrases: string[], locationPref: string,
): { finalScore: number; skillHits: number; titleHits: number; phraseHit: boolean } {
  const h = `${job.title} ${job.description} ${job.company} ${job.type} ${job.location}`.toLowerCase();
  let score = job.qualityScore;
  const skillHits = skillTokens.filter((t) => h.includes(t)).length;
  const titleHits = titleTokens.filter((t) => h.includes(t)).length;
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
  if (getUrlHost(job.url).includes("linkedin.com")) score -= 6;
  if (isSuspiciousCompanyName(job.company)) score -= 14;
  return { finalScore: score, skillHits, titleHits, phraseHit };
}

function buildSearchUrl(title: string, company: string): string {
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${title} ${company}`)}`;
}

// ── Background processor ───────────────────────────────────────────────

async function processSearchInBackground(
  jobId: string, userId: string,
  params: { skills: string[]; targetTitles: string[]; jobTypes: string[]; location: string; query: string; careerLevel: string; limit: number },
) {
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

  try {
    // Update progress: 10%
    await supabaseAdmin.from("processing_jobs").update({ progress: 10, updated_at: new Date().toISOString() }).eq("id", jobId);

    const searchQueries = buildSearchQueries({
      query: params.query, targetTitles: params.targetTitles,
      skills: params.skills, careerLevel: params.careerLevel, jobTypes: params.jobTypes,
    });
    const skillTokens = tokenize(params.skills.join(" ")).slice(0, 16);
    const titleTokens = tokenize(`${params.targetTitles.join(" ")} ${params.query} ${params.careerLevel}`).slice(0, 16);
    const titlePhrases = params.targetTitles.map((t) => cleanSearchFragment(t, 8).toLowerCase()).filter((t) => t.length >= 5).slice(0, 4);

    console.log("BG Queries:", searchQueries, "location:", params.location);

    // Fetch DB jobs
    const databaseJobs = await fetchDatabaseJobs(supabaseAdmin);
    await supabaseAdmin.from("processing_jobs").update({ progress: 30, updated_at: new Date().toISOString() }).eq("id", jobId);

    // Fetch Firecrawl jobs sequentially (one query at a time to minimize memory)
    let crawledJobs: NormalizedJob[] = [];
    if (!firecrawlApiKey) {
      console.warn("FIRECRAWL_API_KEY not set — web search disabled, using database results only");
    }
    if (firecrawlApiKey) {
      for (const [i, q] of searchQueries.entries()) {
        const batch = await searchFirecrawlSingleQuery(firecrawlApiKey, q, params.location);
        crawledJobs = crawledJobs.concat(batch);
        await supabaseAdmin.from("processing_jobs").update({
          progress: 30 + Math.floor(((i + 1) / searchQueries.length) * 40),
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);
        if (crawledJobs.length >= params.limit) break;
      }
    }

    console.log(`BG DB: ${databaseJobs.length}, Crawled: ${crawledJobs.length}`);

    // Deduplicate
    const dedupedByUrl = new Map<string, NormalizedJob>();
    for (const job of [...databaseJobs, ...crawledJobs]) {
      if (!job.url) continue;
      const existing = dedupedByUrl.get(job.url);
      if (!existing || job.qualityScore > existing.qualityScore) dedupedByUrl.set(job.url, job);
    }

    // Score and rank
    // When no tokens exist (empty profile), skip the relevance filter and rank purely by quality score
    const hasTokens = skillTokens.length > 0 || titleTokens.length > 0 || titlePhrases.length > 0;
    if (!hasTokens) {
      console.log("No search tokens — returning all DB jobs by quality score");
    }
    const ranked = [...dedupedByUrl.values()]
      .map((job) => ({ ...job, ...scoreJobMatch(job, skillTokens, titleTokens, titlePhrases, params.location) }))
      .filter((j) => !hasTokens || j.phraseHit || j.skillHits >= 1 || j.titleHits >= 1 || j.finalScore >= 50)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, params.limit)
      .map((job) => ({
        title: job.title, company: job.company, location: job.location, type: job.type,
        description: job.description,
        matchReason: job.urlVerified ? `Direct posting • ${job.skillHits} skill matches` : `Web search • ${job.skillHits} skill matches`,
        url: job.url, googleUrl: buildSearchUrl(job.title, job.company),
        urlVerified: job.urlVerified, urlType: job.urlVerified ? "direct" : "search",
      }));

    console.log(`BG Returning ${ranked.length} jobs for job ${jobId}`);

    await supabaseAdmin.from("processing_jobs").update({
      status: "completed", progress: 100,
      result: { jobs: ranked, citations: [], webSearchEnabled: Boolean(firecrawlApiKey), dbJobCount: databaseJobs.length },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

  } catch (e) {
    console.error(`BG search error for job ${jobId}:`, e);
    await supabaseAdmin.from("processing_jobs").update({
      status: "failed", error: e instanceof Error ? e.message : "Unknown error",
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

// ── Main handler ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "",
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

    const requestBody: SearchRequest = await req.json();

    // ── POLL MODE: client checks status of an existing job ──
    if (requestBody.job_id) {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data, error } = await supabaseAdmin
        .from("processing_jobs")
        .select("status, progress, result, error")
        .eq("id", requestBody.job_id)
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Job not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (data.status === "completed") {
        return new Response(JSON.stringify(data.result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (data.status === "failed") {
        return new Response(JSON.stringify({ error: data.error || "Search failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Still processing
      return new Response(JSON.stringify({ status: "processing", progress: data.progress }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ENQUEUE MODE: start a new search ──
    const skills = Array.isArray(requestBody.skills) ? requestBody.skills : [];
    const targetTitles = Array.isArray(requestBody.targetTitles) ? requestBody.targetTitles : [];
    const jobTypes = Array.isArray(requestBody.jobTypes) ? requestBody.jobTypes : [];
    const location = normalizeText(requestBody.location);
    const query = normalizeText(requestBody.query);
    const careerLevel = normalizeText(requestBody.careerLevel);
    const limit = Math.max(5, Math.min(Number(requestBody.limit || 50), 100));

    // Create the processing job record
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: job, error: insertError } = await supabaseAdmin
      .from("processing_jobs")
      .insert({
        user_id: userId,
        status: "processing",
        progress: 0,
        query: { skills, targetTitles, jobTypes, location, query, careerLevel, limit },
      })
      .select("id")
      .single();

    if (insertError || !job) {
      console.error("Failed to create processing job:", insertError);
      return new Response(JSON.stringify({ error: "Failed to start search" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Start background processing using EdgeRuntime.waitUntil
    const bgParams = { skills, targetTitles, jobTypes, location, query, careerLevel, limit };

    // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processSearchInBackground(job.id, userId, bgParams));
    } else {
      // Fallback: run inline (less ideal but works)
      processSearchInBackground(job.id, userId, bgParams).catch((e) => console.error("Inline BG error:", e));
    }

    // Return immediately with job ID
    return new Response(JSON.stringify({ job_id: job.id, status: "processing", progress: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("search-jobs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
