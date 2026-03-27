import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type IntentMatch = {
  skillHits: number;
  titleHits: number;
  phraseHit: boolean;
  score: number;
};

const GENERIC_COMPANY_NAMES = new Set([
  "jobs", "job", "careers", "career", "linkedin", "workday", "lever",
  "company", "unknown",
]);

// URLs we never want to show
const BLOCKED_URL_PATTERNS = [
  /linkedin\.com\/company\//i,
  /linkedin\.com\/jobs\/search/i,
  /linkedin\.com\/jobs\/collections/i,
  /linkedin\.com\/feed/i,
  /linkedin\.com\/in\//i,
  /facebook\.com/i,
  /twitter\.com/i,
  /instagram\.com/i,
  /youtube\.com/i,
  /wikipedia\.org/i,
  /reddit\.com/i,
  // Block aggregator search/listing pages (not individual postings)
  /indeed\.com\/q-/i,
  /indeed\.com\/jobs\?/i,
  /ziprecruiter\.com\/Jobs\/[^/]+\/-in-/i,
  /careercircle\.com\/jobs$/i,
  /glassdoor\.com\/Job\/.*-jobs-/i,
  /monster\.com\/jobs\/search/i,
  /salary\.com/i,
  /payscale\.com/i,
  /comparably\.com/i,
];

// URLs that are definitely direct job postings
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
  /myworkdayjobs\.com/i,
  /icims\.com/i,
  /jobvite\.com/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /smartrecruiters\.com/i,
  /ashbyhq\.com/i,
  /wellfound\.com/i,
  /applytojob\.com/i,
];

const GENERIC_LISTING_PATH_SEGMENTS = new Set([
  "jobs",
  "job",
  "careers",
  "career",
  "open-positions",
  "positions",
  "search",
  "results",
  "openings",
  "all",
  "index",
  "list",
]);

function normalizeText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
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

function getUrlHost(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
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

  const generalLowSignalPatterns = [
    /jobs powered by/i,
    /view all jobs/i,
    /join our talent network/i,
    /all locations/i,
  ];
  if (generalLowSignalPatterns.some((pattern) => pattern.test(text))) return true;

  // LinkedIn snippets often contain related-job boilerplate, not real descriptions
  if (host.includes("linkedin.com")) {
    const lowSignalPatterns = [
      /get notified about new/i,
      /similar searches/i,
      /open jobs/i,
      /jobs\s*[·|]/i,
      /see who .* has hired for this role/i,
    ];
    if (lowSignalPatterns.some((pattern) => pattern.test(text))) return true;
  }

  return false;
}

function normalizeJobTitle(rawTitle: string): string {
  const title = normalizeText(rawTitle);
  if (!title) return "Job Opportunity";

  // Example: "Deloitte hiring ServiceNow Consultant in Detroit, MI | LinkedIn"
  const linkedInHiringMatch = title.match(/^.+?\s+hiring\s+(.+?)\s+in\s+.+\|\s*linkedin$/i);
  if (linkedInHiringMatch?.[1]) return normalizeText(linkedInHiringMatch[1]);

  return normalizeText(
    title
      .replace(/\s+-\s+(lever|linkedin|workday|icims|jobvite)\.?$/i, "")
      .replace(/\|\s*linkedin$/i, ""),
  );
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
  } catch {
    return "";
  }
}

function extractCompany(rawCompany: string, title: string, url: string): string {
  const cleanedRaw = normalizeText(rawCompany);
  if (cleanedRaw && !GENERIC_COMPANY_NAMES.has(cleanedRaw.toLowerCase())) return cleanedRaw;

  const fromUrl = extractCompanyFromUrl(url);
  if (fromUrl) return fromUrl;

  const hiringPrefixMatch = title.match(/^(.{2,80}?)\s+hiring\b/i);
  if (hiringPrefixMatch?.[1]) {
    const candidate = normalizeText(hiringPrefixMatch[1]);
    if (candidate && !GENERIC_COMPANY_NAMES.has(candidate.toLowerCase())) return candidate;
  }

  const atMatch = title.match(/\s+at\s+([^|\-]{2,80})/i);
  if (atMatch?.[1]) return normalizeText(atMatch[1]);

  const dashMatch = title.split(" - ");
  if (dashMatch.length >= 2) {
    const candidate = normalizeText(dashMatch[dashMatch.length - 1]);
    if (candidate && !looksLikeLocationText(candidate) && !/lever|linkedin|workday|icims|jobvite/i.test(candidate)) {
      return candidate;
    }
  }

  return cleanedRaw;
}

function extractCompanyFromHost(rawUrl: string): string {
  try {
    const { hostname } = new URL(rawUrl);
    const host = hostname.replace(/^www\./, "");
    const base = host.split(".")[0] || "company";
    const inferred = base.split(/[-_]/g).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
    return isSuspiciousCompanyName(inferred) ? "" : inferred;
  } catch {
    return "";
  }
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

function isBlockedUrl(rawUrl: string): boolean {
  if (!rawUrl) return true;
  try {
    const href = new URL(rawUrl.trim()).toString();
    return BLOCKED_URL_PATTERNS.some((p) => p.test(href));
  } catch {
    return true;
  }
}

function isDirectJobPostingUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const href = new URL(rawUrl.trim()).toString();
    return DIRECT_JOB_PATTERNS.some((p) => p.test(href));
  } catch {
    return false;
  }
}

function isHighSignalHost(rawUrl: string): boolean {
  const host = getUrlHost(rawUrl);
  if (!host) return false;
  if (host.includes("linkedin.com")) return false;
  return HIGH_SIGNAL_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

function isGenericListingUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname
      .split("/")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    if (parts.length === 0) return true;
    if (host.includes("jobs.lever.co") && parts.length <= 1) return true;
    if ((host.includes("greenhouse.io") || host.includes("greenhouse.com")) && parts.length <= 1) return true;

    const allGeneric = parts.every((segment) => GENERIC_LISTING_PATH_SEGMENTS.has(segment));
    if (allGeneric) return true;

    if (parts.length <= 2) {
      const hasSearchQuery = ["q", "query", "keywords", "search", "location", "department", "team"].some((k) =>
        parsed.searchParams.has(k),
      );
      if (hasSearchQuery) return true;
    }

    return false;
  } catch {
    return true;
  }
}

function tokenize(text: string): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "job", "jobs", "role", "work", "full", "time", "part",
    "remote", "hybrid", "onsite", "in", "at", "on", "to", "of", "a", "an",
  ]);

  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function buildIntentMatch(
  job: NormalizedJob,
  skillTokens: string[],
  titleTokens: string[],
  titlePhrases: string[],
): IntentMatch {
  const haystack = `${job.title} ${job.description} ${job.company} ${job.type}`.toLowerCase();
  const skillHits = skillTokens.filter((token) => haystack.includes(token)).length;
  const titleHits = titleTokens.filter((token) => haystack.includes(token)).length;
  const phraseHit = titlePhrases.some((phrase) => phrase && job.title.toLowerCase().includes(phrase));

  let score = skillHits * 12 + titleHits * 7 + (phraseHit ? 20 : 0);
  if (/\bhiring\b.+\|\s*linkedin/i.test(job.title)) score -= 10;
  if (isSuspiciousCompanyName(job.company)) score -= 14;

  return { skillHits, titleHits, phraseHit, score };
}

function scoreJobMatch(job: NormalizedJob, tokens: string[], locationPref: string): number {
  let score = job.qualityScore;
  const haystack = `${job.title} ${job.company} ${job.description} ${job.type} ${job.location}`.toLowerCase();
  const host = getUrlHost(job.url);

  for (const token of tokens) {
    if (haystack.includes(token)) score += 8;
  }

  const location = normalizeText(locationPref).toLowerCase();
  if (location) {
    if (job.location.toLowerCase().includes(location)) score += 15;
    if (location.includes("remote") && /remote/i.test(job.location)) score += 20;
  }

  if (/remote/i.test(job.location)) score += 4;
  // Bonus for verified direct URLs
  if (job.urlVerified) score += 10;

  if (host.includes("myworkdayjobs.com") || host.includes("icims.com") || host.includes("jobvite.com")) score += 10;
  if (host.includes("greenhouse.io") || host.includes("job-boards.greenhouse.io") || host.includes("jobs.lever.co")) score += 9;
  if (host.includes("smartrecruiters.com") || host.includes("ashbyhq.com")) score += 7;
  if (host.includes("linkedin.com")) score -= 6;

  if (isLowSignalDescription(job.description, job.url)) score -= 20;
  return score;
}

function hasMinimalDescription(description: string): boolean {
  const text = normalizeText(description);
  // Just require 50+ chars and 8+ words — much more lenient
  return text.length >= 50 && text.split(/\s+/).length >= 8;
}

function cleanSearchFragment(input: string, maxWords = 10): string {
  const ignoredTokens = new Set(["and", "or", "with", "for", "the", "of", "to", "in", "at"]);
  const tokens = normalizeText(input)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9+\-\/\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .filter((token) => !ignoredTokens.has(token.toLowerCase()));

  return tokens.slice(0, maxWords).join(" ");
}

function buildSearchQueries(params: {
  query: string;
  targetTitles: string[];
  skills: string[];
  careerLevel: string;
  jobTypes: string[];
}): string[] {
  const titles = params.targetTitles
    .map((title) => cleanSearchFragment(title, 8))
    .filter(Boolean)
    .slice(0, 3);

  const skills = params.skills
    .map((skill) => cleanSearchFragment(skill, 4))
    .filter(Boolean)
    .slice(0, 4);

  const explicitQuery = cleanSearchFragment(params.query, 10);
  const level = cleanSearchFragment(params.careerLevel, 4);
  const remoteHint = params.jobTypes.some((type) => /remote/i.test(type)) ? "remote" : "";

  const primaryRole = explicitQuery || titles[0] || skills[0] || "software engineer";
  const secondaryRole = titles[1] || cleanSearchFragment(`${primaryRole} ${skills[0] || ""}`, 10);
  const roleWithLevel = cleanSearchFragment(`${level} ${primaryRole}`, 10);

  const candidates = [
    cleanSearchFragment(`${primaryRole} ${remoteHint}`, 10),
    cleanSearchFragment(`${secondaryRole} ${remoteHint}`, 10),
    cleanSearchFragment(`${roleWithLevel} ${remoteHint}`, 10),
    cleanSearchFragment(`${primaryRole} ${skills.slice(0, 2).join(" ")}`, 10),
    cleanSearchFragment(`${titles[0] || primaryRole} ${skills.slice(0, 2).join(" ")} ${remoteHint}`, 10),
  ];

  const deduped = [...new Set(candidates.filter((candidate) => candidate.length >= 4))].slice(0, 6);
  return deduped.length ? deduped : ["software engineer remote"];
}

async function fetchDatabaseJobs(supabaseAdmin: ReturnType<typeof createClient>): Promise<NormalizedJob[]> {
  const { data, error } = await supabaseAdmin
    .from("scraped_jobs")
    .select("title, company, location, job_type, description, job_url, quality_score, last_seen_at, is_flagged")
    .gte("quality_score", 50)
    .eq("is_flagged", false)
    .not("job_url", "is", null)
    .order("quality_score", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(250);

  if (error) {
    console.error("Failed to load scraped jobs:", error.message);
    return [];
  }

  return (data || [])
    .map((row: any) => {
      const url = normalizeText(row.job_url);
      const description = normalizeText(row.description);
      return {
        title: normalizeText(row.title),
        company: normalizeText(row.company),
        location: inferLocation(row.location, "Remote"),
        type: normalizeText(row.job_type) || inferJobType(`${row.title} ${description}`),
        description,
        url,
        source: "db" as const,
        qualityScore: Number(row.quality_score || 0),
        urlVerified: isDirectJobPostingUrl(url),
      };
    })
    .filter((job) => job.title && !isSuspiciousCompanyName(job.company))
    .filter((job) => !isBlockedUrl(job.url))
    .filter((job) => !isGenericListingUrl(job.url))
    .filter((job) => job.urlVerified)
    .filter((job) => isHighSignalHost(job.url))
    .filter((job) => !isLowSignalDescription(job.description, job.url));
}

async function searchFirecrawlJobs(
  firecrawlApiKey: string,
  queries: string[],
  location: string,
  limit: number,
): Promise<NormalizedJob[]> {
  // Search broadly — no site: restrictions — like Perplexity did
  const locationHint = cleanSearchFragment(location, 5);
  const mergedJobs = new Map<string, NormalizedJob>();

  for (const [index, query] of queries.entries()) {
    const q = normalizeText(`${query} ${locationHint} job opening apply`).slice(0, 200);
    console.log(`Firecrawl search query #${index + 1}:`, q);

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: q,
        limit: Math.max(25, Math.min(limit * 5, 50)),
        tbs: "qdr:m",
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl search failed for query #${index + 1}:`, response.status, errorText);
      continue;
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.results) ? payload.results : [];
    console.log(`Firecrawl returned ${rows.length} raw results for query #${index + 1}`);

    const jobs = rows
      .map((row: any) => {
        const url = normalizeText(row.url || row.link || "");
        const description = cleanMarkdownText(row.markdown || row.description || "").slice(0, 5000);
        const title = normalizeJobTitle(row.title || "Job Opportunity");
        const company = extractCompany(row.company || "", title, url) || extractCompanyFromHost(url);
        const detectedType = inferJobType(`${title} ${description}`);
        const resolvedLocation = extractLocation(row.location || "", title, description, location || "Remote");

        const wordCount = description.split(/\s+/).length;
        const semanticScore = Math.min(95, Math.max(50, Math.floor(wordCount / 3) + 40));

        return {
          title,
          company,
          location: resolvedLocation,
          type: detectedType,
          description,
          url,
          source: "firecrawl" as const,
          qualityScore: semanticScore,
          urlVerified: isDirectJobPostingUrl(url),
        };
      })
      // Block bad URLs and generic listing/aggregator pages
      .filter((job) => !isBlockedUrl(job.url))
      .filter((job) => !isGenericListingUrl(job.url))
      .filter((job) => job.company && !GENERIC_COMPANY_NAMES.has(job.company.toLowerCase()))
      .filter((job) => !isSuspiciousCompanyName(job.company))
      .filter((job) => hasMinimalDescription(job.description))
      .filter((job) => !isLowSignalDescription(job.description, job.url));

    console.log(`After filtering query #${index + 1}: ${jobs.length} jobs`);

    for (const job of jobs) {
      const existing = mergedJobs.get(job.url);
      if (!existing || job.qualityScore > existing.qualityScore) {
        mergedJobs.set(job.url, job);
      }
    }

    if (mergedJobs.size >= Math.max(limit * 3, 40)) break;
  }

  return [...mergedJobs.values()];
}

// Build a LinkedIn search URL as fallback when no direct URL
function buildSearchUrl(title: string, company: string): string {
  const q = encodeURIComponent(`${title} ${company}`);
  return `https://www.linkedin.com/jobs/search/?keywords=${q}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlApiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

    const requestBody: SearchRequest = await req.json();
    const skills = Array.isArray(requestBody.skills) ? requestBody.skills : [];
    const targetTitles = Array.isArray(requestBody.targetTitles) ? requestBody.targetTitles : [];
    const jobTypes = Array.isArray(requestBody.jobTypes) ? requestBody.jobTypes : [];

    const location = normalizeText(requestBody.location);
    const query = normalizeText(requestBody.query);
    const careerLevel = normalizeText(requestBody.careerLevel);
    const limit = Math.max(5, Math.min(Number(requestBody.limit || 12), 20));

    const searchQueries = buildSearchQueries({
      query,
      targetTitles,
      skills,
      careerLevel,
      jobTypes,
    });
    const primaryQuery = searchQueries[0] || "software engineer";
    const skillTokens = tokenize(skills.join(" ")).slice(0, 24);
    const titleTokens = tokenize(`${targetTitles.join(" ")} ${query} ${careerLevel}`).slice(0, 24);
    const titlePhrases = targetTitles
      .map((title) => cleanSearchFragment(title, 8).toLowerCase())
      .filter((title) => title.length >= 5)
      .slice(0, 6);

    console.log("Search queries:", searchQueries, "location:", location);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const [databaseJobs, crawledJobs] = await Promise.all([
      fetchDatabaseJobs(supabaseAdmin),
      searchFirecrawlJobs(firecrawlApiKey, searchQueries, location, limit),
    ]);

    console.log(`DB jobs: ${databaseJobs.length}, Crawled jobs: ${crawledJobs.length}`);

    const tokens = tokenize(`${primaryQuery} ${searchQueries.slice(1, 3).join(" ")} ${location}`);

    const dedupedByUrl = new Map<string, NormalizedJob>();
    for (const job of [...databaseJobs, ...crawledJobs]) {
      if (!job.url) continue;
      const existing = dedupedByUrl.get(job.url);
      if (!existing || job.qualityScore > existing.qualityScore) {
        dedupedByUrl.set(job.url, job);
      }
    }

    const rankedCandidates = [...dedupedByUrl.values()]
      .map((job) => ({
        ...job,
        matchScore: scoreJobMatch(job, tokens, location),
        intent: buildIntentMatch(job, skillTokens, titleTokens, titlePhrases),
      }))
      .map((job) => ({
        ...job,
        finalScore: job.matchScore + job.intent.score,
      }))
      .sort((a, b) => b.finalScore - a.finalScore);

    const strictFiltered = rankedCandidates.filter((job) => {
      if (skillTokens.length > 0) {
        return job.intent.skillHits >= 1 && (job.intent.titleHits >= 1 || job.intent.phraseHit || job.finalScore >= 90);
      }
      return job.intent.titleHits >= 1 || job.intent.phraseHit;
    });

    const qualityFirst = strictFiltered.filter((job) =>
      job.intent.phraseHit || job.intent.skillHits >= 1 || job.finalScore >= 85,
    );

    const ranked = (qualityFirst.length > 0
      ? qualityFirst
      : strictFiltered.length > 0
        ? strictFiltered
        : rankedCandidates.filter((job) => job.finalScore >= 40)
    )
      .slice(0, limit)
      .map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        description: job.description,
        matchReason: job.urlVerified
          ? `Direct posting verified • ${job.intent.skillHits} skill matches`
          : `Matched from web search • ${job.intent.skillHits} skill matches`,
        url: job.urlVerified ? job.url : job.url,
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
