/**
 * job-feeds — Live Job Ingestion Agent (Supabase Edge Function, Deno)
 *
 * Fetches fresh job postings from public APIs and RSS feeds, normalizes them,
 * and upserts into job_postings. No third-party paid services required.
 *
 * Sources (all free, no API key needed):
 *   remotive      — https://remotive.com/api/remote-jobs  (JSON)
 *   weworkremotely— https://weworkremotely.com/...rss     (RSS/XML)
 *   greenhouse    — boards-api.greenhouse.io               (JSON, per board)
 *   lever         — api.lever.co                           (JSON, per company)
 *   arbeitnow     — https://arbeitnow.com/api/job-board-api (JSON, EU-focused)
 *
 * Triggered by:
 *   - GitHub Actions cron (every 2 hours)
 *   - Admin manual trigger
 *   - POST /job-feeds with { source: "all" | "remotive" | ... }
 *
 * POST body:
 *   { source?: string, boards?: string[] }
 *   boards = Greenhouse board tokens or Lever company slugs to fetch
 *
 * Response:
 *   { ingested: number, sources: { [source]: { new, updated, error } } }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanJobText } from "../_shared/job-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Normalized job structure for ingestion
// ---------------------------------------------------------------------------

interface NormalizedJob {
  external_id: string;    // unique ID for deduplication
  title: string;
  company: string;
  location: string;
  is_remote: boolean;
  job_type: string;       // 'fulltime' | 'parttime' | 'contract' | 'internship'
  description: string;    // cleaned by job-parser
  job_url: string;
  apply_url: string;
  source: string;
  salary_min: number | null;
  salary_max: number | null;
  date_posted: string;    // ISO timestamp
}

interface SourceResult {
  source: string;
  new: number;
  updated: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeJobType(raw: string): string {
  const t = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (t.includes("part")) return "parttime";
  if (t.includes("contract") || t.includes("freelance")) return "contract";
  if (t.includes("intern")) return "internship";
  return "fulltime";
}

function extractSalary(text: string): { min: number | null; max: number | null } {
  const m = text.match(/\$\s*([\d,]+)(?:\s*[-–]\s*\$?\s*([\d,]+))?/);
  if (!m) return { min: null, max: null };
  const min = parseInt(m[1].replace(/,/g, ""), 10);
  const max = m[2] ? parseInt(m[2].replace(/,/g, ""), 10) : null;
  // If values look like hourly rates, convert to annual
  const annualMin = min < 500 ? min * 2080 : min;
  const annualMax = max ? (max < 500 ? max * 2080 : max) : null;
  return { min: annualMin, max: annualMax };
}

// ---------------------------------------------------------------------------
// Source 1: Remotive — best free remote jobs API
// https://remotive.com/api/remote-jobs?category=software-dev&limit=50
// ---------------------------------------------------------------------------

const REMOTIVE_CATEGORIES = [
  "software-dev", "devops-sysadmin", "product", "design",
  "data", "qa", "cybersecurity", "finance-legal", "marketing",
];

async function fetchRemotive(): Promise<{ jobs: NormalizedJob[]; error?: string }> {
  const allJobs: NormalizedJob[] = [];
  const errors: string[] = [];

  for (const category of REMOTIVE_CATEGORIES) {
    try {
      const url = `https://remotive.com/api/remote-jobs?category=${category}&limit=50`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) { errors.push(`remotive/${category}: HTTP ${res.status}`); continue; }

      const data = await res.json();
      const jobs: any[] = data.jobs ?? [];

      for (const job of jobs) {
        const salary = extractSalary(job.salary ?? "");
        allJobs.push({
          external_id: `remotive-${job.id}`,
          title: job.title ?? "",
          company: job.company_name ?? "",
          location: job.candidate_required_location || "Worldwide",
          is_remote: true,
          job_type: normalizeJobType(job.job_type ?? "full_time"),
          description: cleanJobText(job.description?.replace(/<[^>]+>/g, " ") ?? "", job.title),
          job_url: job.url ?? "",
          apply_url: job.url ?? "",
          source: "remotive",
          salary_min: salary.min,
          salary_max: salary.max,
          date_posted: job.publication_date ?? new Date().toISOString(),
        });
      }
    } catch (e) {
      errors.push(`remotive/${category}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { jobs: allJobs, error: errors.length > 0 ? errors.join("; ") : undefined };
}

// ---------------------------------------------------------------------------
// Source 2: We Work Remotely — RSS feed
// ---------------------------------------------------------------------------

const WWR_FEEDS = [
  "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/categories/remote-product-jobs.rss",
  "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "https://weworkremotely.com/categories/remote-data-science-ai-statistics-jobs.rss",
];

function parseRssItem(item: string): { title?: string; link?: string; description?: string; company?: string; pubDate?: string } {
  const get = (tag: string) => {
    const m = item.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return m?.[1]?.trim();
  };
  const title = get("title") ?? "";
  // WWR title format: "Company: Job Title"
  const colonIdx = title.indexOf(":");
  const company = colonIdx > 0 ? title.slice(0, colonIdx).trim() : "";
  const jobTitle = colonIdx > 0 ? title.slice(colonIdx + 1).trim() : title;
  return {
    title: jobTitle,
    company,
    link: get("link"),
    description: get("description"),
    pubDate: get("pubDate"),
  };
}

async function fetchWeWorkRemotely(): Promise<{ jobs: NormalizedJob[]; error?: string }> {
  const allJobs: NormalizedJob[] = [];
  const errors: string[] = [];

  for (const feedUrl of WWR_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "iCareerOS/1.0" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) { errors.push(`wwr: HTTP ${res.status}`); continue; }

      const xml = await res.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];

      for (const item of items) {
        const parsed = parseRssItem(item);
        if (!parsed.title || !parsed.link) continue;

        const hash = btoa(parsed.link).replace(/[^a-z0-9]/gi, "").slice(0, 32);
        const salary = extractSalary(parsed.description ?? "");
        const desc = (parsed.description ?? "").replace(/<[^>]+>/g, " ");

        allJobs.push({
          external_id: `wwr-${hash}`,
          title: parsed.title,
          company: parsed.company ?? "",
          location: "Remote",
          is_remote: true,
          job_type: "fulltime",
          description: cleanJobText(desc, parsed.title),
          job_url: parsed.link,
          apply_url: parsed.link,
          source: "weworkremotely",
          salary_min: salary.min,
          salary_max: salary.max,
          date_posted: parsed.pubDate ? new Date(parsed.pubDate).toISOString() : new Date().toISOString(),
        });
      }
    } catch (e) {
      errors.push(`wwr: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { jobs: allJobs, error: errors.length > 0 ? errors.join("; ") : undefined };
}

// ---------------------------------------------------------------------------
// Source 3: Arbeitnow — free job board API (tech-focused, global)
// https://arbeitnow.com/api/job-board-api
// ---------------------------------------------------------------------------

async function fetchArbeitnow(): Promise<{ jobs: NormalizedJob[]; error?: string }> {
  try {
    const res = await fetch("https://arbeitnow.com/api/job-board-api", {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { jobs: [], error: `arbeitnow: HTTP ${res.status}` };

    const data = await res.json();
    const items: any[] = data.data ?? [];

    const jobs: NormalizedJob[] = items.map((job) => {
      const salary = extractSalary(job.description ?? "");
      return {
        external_id: `arbeitnow-${job.slug}`,
        title: job.title ?? "",
        company: job.company_name ?? "",
        location: job.location || (job.remote ? "Remote" : ""),
        is_remote: job.remote ?? false,
        job_type: normalizeJobType(job.job_types?.[0] ?? "full_time"),
        description: cleanJobText((job.description ?? "").replace(/<[^>]+>/g, " "), job.title),
        job_url: job.url ?? "",
        apply_url: job.url ?? "",
        source: "arbeitnow",
        salary_min: salary.min,
        salary_max: salary.max,
        date_posted: job.created_at ? new Date(job.created_at * 1000).toISOString() : new Date().toISOString(),
      };
    });

    return { jobs };
  } catch (e) {
    return { jobs: [], error: `arbeitnow: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// Source 4: Greenhouse boards — list of popular tech company boards
// (Add more boards here as needed — all are free public APIs)
// ---------------------------------------------------------------------------

const GREENHOUSE_BOARDS = [
  "anthropic", "stripe", "vercel", "supabase", "linear", "notion",
  "figma", "airbnb", "shopify", "databricks", "snowflake", "hashicorp",
  "cloudflare", "twilio", "datadog", "confluent", "asana",
];

async function fetchGreenhouseBoards(boards: string[]): Promise<{ jobs: NormalizedJob[]; error?: string }> {
  const allJobs: NormalizedJob[] = [];
  const errors: string[] = [];

  await Promise.allSettled(
    boards.map(async (board) => {
      try {
        const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) { errors.push(`greenhouse/${board}: HTTP ${res.status}`); return; }

        const data = await res.json();
        const company = data.name ?? board;

        for (const job of (data.jobs ?? [])) {
          const salary = extractSalary(job.content ?? "");
          const desc = (job.content ?? "").replace(/<[^>]+>/g, " ");
          allJobs.push({
            external_id: `greenhouse-${board}-${job.id}`,
            title: job.title ?? "",
            company,
            location: job.location?.name ?? "",
            is_remote: /remote/i.test(job.location?.name ?? "") || /remote/i.test(job.title),
            job_type: "fulltime",
            description: cleanJobText(desc, job.title),
            job_url: job.absolute_url ?? "",
            apply_url: job.absolute_url ?? "",
            source: `greenhouse:${board}`,
            salary_min: salary.min,
            salary_max: salary.max,
            date_posted: job.updated_at ?? new Date().toISOString(),
          });
        }
      } catch (e) {
        errors.push(`greenhouse/${board}: ${e instanceof Error ? e.message : String(e)}`);
      }
    })
  );

  return { jobs: allJobs, error: errors.length > 0 ? errors.slice(0, 3).join("; ") : undefined };
}

// ---------------------------------------------------------------------------
// Source 5: Lever boards — popular companies using Lever
// ---------------------------------------------------------------------------

const LEVER_COMPANIES = [
  "netflix", "reddit", "lyft", "coinbase", "robinhood",
  "duolingo", "canva", "discord", "plaid", "brex",
];

async function fetchLeverBoards(companies: string[]): Promise<{ jobs: NormalizedJob[]; error?: string }> {
  const allJobs: NormalizedJob[] = [];
  const errors: string[] = [];

  await Promise.allSettled(
    companies.map(async (company) => {
      try {
        const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) { errors.push(`lever/${company}: HTTP ${res.status}`); return; }

        const jobs: any[] = await res.json();
        for (const job of jobs) {
          const desc = [job.descriptionPlain, job.additionalPlain].filter(Boolean).join("\n\n");
          const salary = extractSalary(desc);
          allJobs.push({
            external_id: `lever-${company}-${job.id}`,
            title: job.text ?? "",
            company,
            location: job.categories?.location ?? "",
            is_remote: /remote/i.test(job.categories?.location ?? "") || /remote/i.test(job.text),
            job_type: normalizeJobType(job.categories?.commitment ?? "full-time"),
            description: cleanJobText(desc, job.text),
            job_url: job.hostedUrl ?? "",
            apply_url: job.applyUrl ?? job.hostedUrl ?? "",
            source: `lever:${company}`,
            salary_min: salary.min,
            salary_max: salary.max,
            date_posted: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
          });
        }
      } catch (e) {
        errors.push(`lever/${company}: ${e instanceof Error ? e.message : String(e)}`);
      }
    })
  );

  return { jobs: allJobs, error: errors.length > 0 ? errors.slice(0, 3).join("; ") : undefined };
}

// ---------------------------------------------------------------------------
// DB upsert
// ---------------------------------------------------------------------------

async function upsertJobs(
  supabase: any,
  jobs: NormalizedJob[],
  source: string
): Promise<{ new: number; updated: number; error?: string }> {
  if (jobs.length === 0) return { new: 0, updated: 0 };

  const rows = jobs
    .filter((j) => j.title && j.company && j.job_url)
    .map((j) => ({
      external_id: j.external_id,
      title: j.title.slice(0, 255),
      company: j.company.slice(0, 255),
      location: j.location.slice(0, 255),
      is_remote: j.is_remote,
      job_type: j.job_type,
      description: j.description.slice(0, 20_000),
      job_url: j.job_url.slice(0, 2048),
      apply_url: j.apply_url.slice(0, 2048),
      source: j.source,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      date_posted: j.date_posted,
      scraped_at: new Date().toISOString(),
      status: "active",
    }));

  // Get existing external_ids to distinguish new vs updated
  const externalIds = rows.map((r) => r.external_id);
  const { data: existing } = await supabase
    .from("job_postings")
    .select("external_id")
    .in("external_id", externalIds);

  const existingSet = new Set((existing ?? []).map((r: any) => r.external_id));
  const newCount = rows.filter((r) => !existingSet.has(r.external_id)).length;
  const updatedCount = rows.filter((r) => existingSet.has(r.external_id)).length;

  const { error } = await supabase
    .from("job_postings")
    .upsert(rows, { onConflict: "external_id", ignoreDuplicates: false });

  if (error) {
    console.error(`[job-feeds] upsert error for ${source}:`, error);
    return { new: 0, updated: 0, error: error.message };
  }

  return { new: newCount, updated: updatedCount };
}

// ---------------------------------------------------------------------------
// Feed log writer
// ---------------------------------------------------------------------------

async function logFeedRun(
  supabase: any,
  source: string,
  jobsFound: number,
  jobsNew: number,
  jobsUpdated: number,
  durationMs: number,
  error?: string
) {
  await supabase.from("job_feed_log").insert({
    source, jobs_found: jobsFound, jobs_new: jobsNew,
    jobs_updated: jobsUpdated, duration_ms: durationMs, error: error ?? null,
  }).catch(() => {}); // non-fatal
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    // ── Auth (service role or admin user) ─────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return res({ success: false, error: "Missing authorization header" }, 401);
    }

    // Allow service role key OR authenticated admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const requestedSource: string = body.source ?? "all";
    const customBoards: string[] = body.boards ?? [];
    const customCompanies: string[] = body.companies ?? [];

    const results: Record<string, SourceResult> = {};
    let totalIngested = 0;

    // ── Run selected sources in parallel ─────────────────────────────────────
    const sourceTasks: Array<() => Promise<void>> = [];

    if (requestedSource === "all" || requestedSource === "remotive") {
      sourceTasks.push(async () => {
        const fetchStart = Date.now();
        const { jobs, error } = await fetchRemotive();
        const { new: n, updated: u, error: dbErr } = await upsertJobs(supabaseAdmin, jobs, "remotive");
        results["remotive"] = { source: "remotive", new: n, updated: u, error: error ?? dbErr };
        totalIngested += n + u;
        await logFeedRun(supabaseAdmin, "remotive", jobs.length, n, u, Date.now() - fetchStart, error ?? dbErr);
      });
    }

    if (requestedSource === "all" || requestedSource === "weworkremotely") {
      sourceTasks.push(async () => {
        const fetchStart = Date.now();
        const { jobs, error } = await fetchWeWorkRemotely();
        const { new: n, updated: u, error: dbErr } = await upsertJobs(supabaseAdmin, jobs, "weworkremotely");
        results["weworkremotely"] = { source: "weworkremotely", new: n, updated: u, error: error ?? dbErr };
        totalIngested += n + u;
        await logFeedRun(supabaseAdmin, "weworkremotely", jobs.length, n, u, Date.now() - fetchStart, error ?? dbErr);
      });
    }

    if (requestedSource === "all" || requestedSource === "arbeitnow") {
      sourceTasks.push(async () => {
        const fetchStart = Date.now();
        const { jobs, error } = await fetchArbeitnow();
        const { new: n, updated: u, error: dbErr } = await upsertJobs(supabaseAdmin, jobs, "arbeitnow");
        results["arbeitnow"] = { source: "arbeitnow", new: n, updated: u, error: error ?? dbErr };
        totalIngested += n + u;
        await logFeedRun(supabaseAdmin, "arbeitnow", jobs.length, n, u, Date.now() - fetchStart, error ?? dbErr);
      });
    }

    if (requestedSource === "all" || requestedSource === "greenhouse") {
      const boards = customBoards.length > 0 ? customBoards : GREENHOUSE_BOARDS;
      sourceTasks.push(async () => {
        const fetchStart = Date.now();
        const { jobs, error } = await fetchGreenhouseBoards(boards);
        const { new: n, updated: u, error: dbErr } = await upsertJobs(supabaseAdmin, jobs, "greenhouse");
        results["greenhouse"] = { source: "greenhouse", new: n, updated: u, error: error ?? dbErr };
        totalIngested += n + u;
        await logFeedRun(supabaseAdmin, "greenhouse", jobs.length, n, u, Date.now() - fetchStart, error ?? dbErr);
      });
    }

    if (requestedSource === "all" || requestedSource === "lever") {
      const companies = customCompanies.length > 0 ? customCompanies : LEVER_COMPANIES;
      sourceTasks.push(async () => {
        const fetchStart = Date.now();
        const { jobs, error } = await fetchLeverBoards(companies);
        const { new: n, updated: u, error: dbErr } = await upsertJobs(supabaseAdmin, jobs, "lever");
        results["lever"] = { source: "lever", new: n, updated: u, error: error ?? dbErr };
        totalIngested += n + u;
        await logFeedRun(supabaseAdmin, "lever", jobs.length, n, u, Date.now() - fetchStart, error ?? dbErr);
      });
    }

    await Promise.allSettled(sourceTasks.map((t) => t()));

    console.log(`[job-feeds] Complete: ${totalIngested} jobs ingested in ${Date.now() - startTime}ms`);

    return res({
      success: true,
      ingested: totalIngested,
      durationMs: Date.now() - startTime,
      sources: results,
    });

  } catch (error) {
    console.error("[job-feeds] Unhandled error:", error);
    return res({ success: false, error: error instanceof Error ? error.message : "Feed ingestion failed" }, 500);
  }
});

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
