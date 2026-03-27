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
  lastSeenAt?: string;
};

const NOISY_DESCRIPTION_PATTERNS = [
  /skip to main content/i,
  /all rights reserved/i,
  /jobs powered by/i,
  /follow us/i,
  /privacy policy/i,
  /terms of (use|service)/i,
  /cookie/i,
];

const GENERIC_COMPANY_NAMES = new Set([
  "jobs",
  "job",
  "careers",
  "career",
  "linkedin",
  "workday",
  "lever",
]);

function normalizeText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function hasSubstantiveDescription(description: string): boolean {
  const text = normalizeText(description);
  if (text.length < 140) return false;
  if (text.split(/\s+/).length < 24) return false;
  if (NOISY_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text))) return false;

  const signalWords = [
    "responsibilities",
    "requirements",
    "qualifications",
    "experience",
    "team",
    "role",
    "position",
    "skills",
    "benefits",
  ];
  const hits = signalWords.reduce((acc, word) => acc + (text.toLowerCase().includes(word) ? 1 : 0), 0);
  if (hits < 2) return false;

  return true;
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

function extractCompanyFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("jobs.lever.co") && parts[0]) {
      return parts[0]
        .split(/[-_]/g)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
    }

    if ((host.includes("greenhouse.io") || host.includes("greenhouse.com")) && parts[0]) {
      return parts[0]
        .split(/[-_]/g)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
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

  const atMatch = title.match(/\s+at\s+([^|\-]{2,80})/i);
  if (atMatch?.[1]) return normalizeText(atMatch[1]);

  const dashMatch = title.split(" - ");
  if (dashMatch.length >= 2) {
    const candidate = normalizeText(dashMatch[dashMatch.length - 1]);
    if (candidate && !/lever|linkedin|workday|icims|jobvite/i.test(candidate)) return candidate;
  }

  return cleanedRaw || "Company";
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

function extractCompanyFromHost(rawUrl: string): string {
  try {
    const { hostname } = new URL(rawUrl);
    const host = hostname.replace(/^www\./, "");
    const base = host.split(".")[0] || "company";
    return base
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "Company";
  }
}

const DIRECT_JOB_PATTERNS = [
  /linkedin\.com\/jobs\/view\//i,
  /boards\.greenhouse\.io\/.+\/jobs\//i,
  /job-boards\.greenhouse\.io\/.+\/jobs\//i,
  /jobs\.lever\.co\/.+\/.+/i,
  /myworkdayjobs\.com\/.+\/job\//i,
  /icims\.com\/jobs\//i,
  /jobvite\.com\/(?:job|jobs|careers)\//i,
  /smartrecruiters\.com\/.+\/jobs\//i,
  /ashbyhq\.com\/.+\/job\//i,
  /applytojob\.com\/apply\//i,
];

const BLOCKED_URL_PATTERNS = [
  /linkedin\.com\/company\//i,
  /linkedin\.com\/jobs\/search/i,
  /linkedin\.com\/jobs\/collections/i,
  /\/careers?(?:\/)?$/i,
  /\/jobs?(?:\/)?$/i,
  /\/job-search(?:\/)?$/i,
  /\/search(?:\/)?$/i,
];

function isDirectJobPostingUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl.trim());
    const href = url.toString();

    if (BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(href))) return false;
    if (!DIRECT_JOB_PATTERNS.some((pattern) => pattern.test(href))) return false;

    return true;
  } catch {
    return false;
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

function scoreJobMatch(job: NormalizedJob, tokens: string[], locationPref: string): number {
  let score = job.qualityScore;
  const haystack = `${job.title} ${job.company} ${job.description} ${job.type} ${job.location}`.toLowerCase();

  for (const token of tokens) {
    if (haystack.includes(token)) score += 8;
  }

  const location = normalizeText(locationPref).toLowerCase();
  if (location) {
    if (job.location.toLowerCase().includes(location)) score += 15;
    if (location.includes("remote") && /remote/i.test(job.location)) score += 20;
  }

  if (/remote/i.test(job.location)) score += 4;
  return score;
}

async function fetchDatabaseJobs(supabaseAdmin: ReturnType<typeof createClient>): Promise<NormalizedJob[]> {
  const { data, error } = await supabaseAdmin
    .from("scraped_jobs")
    .select("title, company, location, job_type, description, job_url, quality_score, last_seen_at, is_flagged")
    .gte("quality_score", 65)
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
        lastSeenAt: row.last_seen_at,
      };
    })
    .filter((job) => job.title && job.company)
    .filter((job) => hasSubstantiveDescription(job.description))
    .filter((job) => isDirectJobPostingUrl(job.url));
}

async function searchFirecrawlJobs(
  firecrawlApiKey: string,
  query: string,
  location: string,
  limit: number,
): Promise<NormalizedJob[]> {
  const q = `${query} ${location} site:linkedin.com/jobs/view OR site:boards.greenhouse.io OR site:jobs.lever.co OR site:myworkdayjobs.com OR site:icims.com/jobs OR site:jobvite.com`;

  const response = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: q,
      limit: Math.max(12, Math.min(limit * 3, 36)),
      tbs: "qdr:w",
      scrapeOptions: {
        formats: ["markdown"],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Firecrawl search failed:", response.status, errorText);
    return [];
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.results) ? payload.results : [];

  return rows
    .map((row: any) => {
      const url = normalizeText(row.url || row.link || "");
      const description = cleanMarkdownText(row.markdown || row.description || "").slice(0, 5000);
      const title = normalizeText(row.title || "Job Opportunity").replace(/\s+-\s+(lever|linkedin|workday|icims|jobvite)\.?$/i, "");
      const company = extractCompany(row.company || "", title, url) || extractCompanyFromHost(url);
      const detectedType = inferJobType(`${title} ${description}`);
      const resolvedLocation = extractLocation(row.location || "", title, description, location || "Remote");

      const keywordHits = tokenize(`${title} ${description}`).length;
      const semanticScore = Math.min(95, Math.max(68, Math.floor(description.length / 40) + Math.min(15, keywordHits)));

      return {
        title,
        company,
        location: resolvedLocation,
        type: detectedType,
        description,
        url,
        source: "firecrawl" as const,
        qualityScore: semanticScore,
      };
    })
    .filter((job) => job.url && isDirectJobPostingUrl(job.url))
    .filter((job) => job.company && !GENERIC_COMPANY_NAMES.has(job.company.toLowerCase()))
    .filter((job) => hasSubstantiveDescription(job.description));
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

    const mergedQuery = normalizeText(
      [
        query,
        targetTitles.join(" "),
        skills.join(" "),
        careerLevel,
        jobTypes.join(" "),
      ].join(" "),
    ) || "software engineer";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const [databaseJobs, crawledJobs] = await Promise.all([
      fetchDatabaseJobs(supabaseAdmin),
      searchFirecrawlJobs(firecrawlApiKey, mergedQuery, location, limit),
    ]);

    const tokens = tokenize(`${mergedQuery} ${location}`);

    const dedupedByUrl = new Map<string, NormalizedJob>();
    for (const job of [...databaseJobs, ...crawledJobs]) {
      const existing = dedupedByUrl.get(job.url);
      if (!existing || job.qualityScore > existing.qualityScore) {
        dedupedByUrl.set(job.url, job);
      }
    }

    const ranked = [...dedupedByUrl.values()]
      .map((job) => ({
        ...job,
        matchScore: scoreJobMatch(job, tokens, location),
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
      .map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        description: job.description,
        matchReason:
          job.source === "db"
            ? "Matched from verified postings in the job database"
            : "Matched from live web crawl with direct posting URL verification",
        url: job.url,
        urlVerified: true,
        urlType: "direct",
      }));

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
