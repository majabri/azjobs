import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic } from "../_shared/anthropic.ts";
import { corsHeaders } from "../_shared/cors.ts";

// ── Well-known ATS boards to crawl daily ──
const DEFAULT_GREENHOUSE_BOARDS = [
  "airbnb", "figma", "stripe", "notion", "databricks", "cloudflare",
  "discord", "instacart", "robinhood", "coinbase", "grammarly",
  "plaid", "brex", "airtable", "vercel", "netlify",
  "dropbox", "squarespace", "hashicorp", "elastic", "confluent",
  "datadog", "snyk", "mongodb", "cockroachlabs", "dbt-labs",
  "samsara", "benchling", "retool", "linear", "loom",
];

const DEFAULT_LEVER_COMPANIES = [
  "netflix", "shopify", "twitch", "palantir", "reddit",
  "doordash", "lyft", "snap", "spotify", "hubspot",
  "nerdwallet", "webflow", "postman", "calendly", "miro",
  "lucidchart", "gong", "lattice", "greenhouse", "gusto",
];

const GENERIC_JOB_PATH_SEGMENTS = new Set([
  "careers", "career", "jobs", "job", "job-search", "open-positions",
  "positions", "vacancies", "opportunities", "join-us", "work-with-us", "employment",
]);

const LISTING_TAIL_SEGMENTS = new Set(["search", "results", "all", "openings", "index", "list"]);

const NON_JOB_PAGE_SEGMENTS = new Set(["about", "company", "team", "culture", "people", "mission", "values", "home", "contact"]);

// ── Helpers (reused from scrape-jobs-ats) ──
function detectJobType(title: string, desc: string): string | null {
  const t = `${title} ${desc}`.toLowerCase();
  if (/\bcontract\b/.test(t)) return "contract";
  if (/\bpart[- ]time\b/.test(t)) return "part-time";
  if (/\bintern\b/.test(t)) return "internship";
  return "full-time";
}

function detectSeniority(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(chief|cto|ceo|cfo|coo|ciso)\b/.test(t)) return "executive";
  if (/\b(vp|vice president|svp)\b/.test(t)) return "vp";
  if (/\bdirector\b/.test(t)) return "director";
  if (/\b(lead|principal|staff|senior)\b/.test(t)) return "senior";
  if (/\bjunior\b/.test(t)) return "junior";
  if (/\bintern\b/.test(t)) return "intern";
  return "mid";
}

function scoreJob(job: any): { score: number; flagged: boolean; reasons: string[] } {
  let score = 100;
  const reasons: string[] = [];
  if (!job.description || job.description.length < 50) { score -= 30; reasons.push("Short description"); }
  if (!job.location && !job.is_remote) { score -= 10; reasons.push("No location"); }
  if (!job.salary) { score -= 5; reasons.push("No salary info"); }
  if (job.description && /\b(urgent|immediately|asap)\b/i.test(job.description)) { score -= 15; reasons.push("Urgency keywords"); }
  if (job.description && /\b(commission only|unpaid|volunteer)\b/i.test(job.description)) { score -= 25; reasons.push("Potentially unpaid"); }
  return { score: Math.max(0, score), flagged: score < 60, reasons };
}

function normalizeJobUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  const markdownMatch = trimmed.match(/\((https?:\/\/[^)\s]+)\)/i);
  const plainMatch = trimmed.match(/https?:\/\/[^\s<>'"\])]+/i);
  const extracted = (markdownMatch?.[1] || plainMatch?.[0] || trimmed).replace(/[),.;]+$/g, "").trim();
  if (!extracted) return "";

  const withProtocol = /^https?:\/\//i.test(extracted) ? extracted : `https://${extracted}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();
    if (!host || host.includes("example.com") || host.includes("placeholder")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function isGenericJobListingUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname
      .split("/")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    if (parts.length === 0) return true;

    const allGeneric = parts.every((p) => GENERIC_JOB_PATH_SEGMENTS.has(p) || LISTING_TAIL_SEGMENTS.has(p));
    if (allGeneric) return true;

    if (parts.length === 1 && GENERIC_JOB_PATH_SEGMENTS.has(parts[0])) return true;
    if (parts.length === 2 && GENERIC_JOB_PATH_SEGMENTS.has(parts[0]) && LISTING_TAIL_SEGMENTS.has(parts[1])) return true;

    const last = parts[parts.length - 1];
    if (GENERIC_JOB_PATH_SEGMENTS.has(last) || LISTING_TAIL_SEGMENTS.has(last)) return true;

    const qp = url.searchParams;
    if (["q", "query", "keywords", "search", "location", "department", "team"].some((key) => qp.has(key)) && parts.length <= 2) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

function isLikelyDirectJobPostingUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname
      .split("/")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    if (parts.length === 0) return false;

    const last = parts[parts.length - 1];
    if (NON_JOB_PAGE_SEGMENTS.has(last)) return false;

    const hasJobWordInPath = parts.some((p) => /job|jobs|position|opening|opportunit|career/.test(p));
    const hasNumericId = parts.some((p) => /\d{4,}/.test(p));
    const hasLongSlug = parts.some((p) => p.includes("-") && p.length >= 16);
    const hasKnownJobQuery = ["gh_jid", "job", "jobid", "jk", "lever-source", "oid"].some((k) =>
      url.searchParams.has(k)
    );

    if (parts.length === 1 && !hasNumericId && !hasLongSlug && !hasKnownJobQuery) return false;

    return hasJobWordInPath || hasNumericId || hasLongSlug || hasKnownJobQuery;
  } catch {
    return false;
  }
}

function hasSubstantiveDescription(description: unknown): boolean {
  if (typeof description !== "string") return false;
  const text = description.trim();
  if (text.length < 140) return false;
  if (text.split(/\s+/).length < 24) return false;
  return true;
}

// ── ATS scrapers ──
async function scrapeGreenhouse(board: string) {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map((j: any) => ({
      title: j.title || "",
      company: data.name || board,
      description: (j.content || "").replace(/<[^>]*>/g, " ").substring(0, 5000),
      location: j.location?.name || null,
      salary: null,
      job_url: j.absolute_url || null,
      source: "greenhouse",
      source_id: `gh-${board}-${j.id}`,
      job_type: detectJobType(j.title, j.content || ""),
      seniority: detectSeniority(j.title),
      industry: null,
      is_remote: /remote/i.test(j.location?.name || "") || /remote/i.test(j.title),
    }));
  } catch (e) {
    console.error(`Greenhouse ${board} failed:`, e);
    return [];
  }
}

async function scrapeLever(company: string) {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`);
    if (!res.ok) return [];
    const jobs: any[] = await res.json();
    return jobs.map((j: any) => ({
      title: j.text || "",
      company,
      description: (j.descriptionPlain || j.description || "").substring(0, 5000),
      location: j.categories?.location || null,
      salary: null,
      job_url: j.hostedUrl || j.applyUrl || null,
      source: "lever",
      source_id: `lv-${company}-${j.id}`,
      job_type: j.categories?.commitment || detectJobType(j.text, j.descriptionPlain || ""),
      seniority: detectSeniority(j.text),
      industry: j.categories?.department || null,
      is_remote: /remote/i.test(j.categories?.location || "") || /remote/i.test(j.text),
    }));
  } catch (e) {
    console.error(`Lever ${company} failed:`, e);
    return [];
  }
}

// ── AI-powered web crawl for each unique search query ──
async function aiWebCrawl(searchQuery: string, anthropicApiKey: string) {
  try {
    const prompt = `Search the entire internet for REAL, CURRENTLY ACTIVE job postings matching: "${searchQuery}".

Find jobs from ALL sources including:
- Job boards: LinkedIn, Indeed, Glassdoor, ZipRecruiter, Dice, SimplyHired
- ATS platforms: Workday (myworkdayjobs.com), iCIMS, Jobvite, Lever, Greenhouse, SmartRecruiters
- Company career pages hosted on Workday, iCIMS, Jobvite, and other enterprise ATS systems

Return 15-20 real job listings. For each:
- title: exact job title
- company: real company name
- location: job location
- type: remote/hybrid/in-office/full-time/part-time/contract
- description: 4-6 sentence detailed summary with responsibilities and requirements
- url: the REAL direct URL to the SPECIFIC job posting page (e.g. myworkdayjobs.com/en-US/company/job/..., icims.com/jobs/.../job, jobvite.com/...). NOT a careers landing page, NOT a search results page, NOT a company homepage.
- salary: salary range if available, null otherwise

CRITICAL: Only include jobs with REAL, WORKING URLs pointing to SPECIFIC individual job detail pages. No generic career pages, no search result pages, no company homepages.`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are a job search crawler. Return only valid JSON. No markdown." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_jobs",
            description: "Return crawled job listings",
            parameters: {
              type: "object",
              properties: {
                jobs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      company: { type: "string" },
                      location: { type: "string" },
                      type: { type: "string" },
                      description: { type: "string" },
                      url: { type: "string" },
                      salary: { type: "string" },
                    },
                    required: ["title", "company", "description", "url"],
                  },
                },
              },
              required: ["jobs"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_jobs" } },
      }),
    });

    if (!response.ok) {
      console.error(`AI crawl failed for "${searchQuery}":`, response.status);
      return [];
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        return (parsed.jobs || []).map((j: any) => ({
          title: j.title || "",
          company: j.company || "",
          description: (j.description || "").substring(0, 5000),
          location: j.location || null,
          salary: j.salary || null,
          job_url: j.url || null,
          source: "ai_crawl",
          source_id: `ai-${j.url || `${j.company}-${j.title}`}`.replace(/\s+/g, "-").toLowerCase().substring(0, 200),
          job_type: j.type || detectJobType(j.title, j.description || ""),
          seniority: detectSeniority(j.title),
          industry: null,
          is_remote: /remote/i.test(j.location || "") || /remote/i.test(j.title),
        }));
      } catch { return []; }
    }
    return [];
  } catch (e) {
    console.error(`AI crawl error for "${searchQuery}":`, e);
    return [];
  }
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("🔄 Starting daily job refresh...");

    // ── Step 1: Scrape all default ATS boards ──
    let allJobs: any[] = [];

    const ghResults = await Promise.allSettled(
      DEFAULT_GREENHOUSE_BOARDS.map((b) => scrapeGreenhouse(b))
    );
    for (const r of ghResults) {
      if (r.status === "fulfilled") allJobs = allJobs.concat(r.value);
    }
    console.log(`✅ Greenhouse: ${allJobs.length} jobs from ${DEFAULT_GREENHOUSE_BOARDS.length} boards`);

    const lvResults = await Promise.allSettled(
      DEFAULT_LEVER_COMPANIES.map((c) => scrapeLever(c))
    );
    const lvCount = allJobs.length;
    for (const r of lvResults) {
      if (r.status === "fulfilled") allJobs = allJobs.concat(r.value);
    }
    console.log(`✅ Lever: ${allJobs.length - lvCount} jobs from ${DEFAULT_LEVER_COMPANIES.length} companies`);

    // ── Step 2: Scrape user-defined targets from scraping_targets table ──
    const { data: targets } = await supabaseAdmin
      .from("scraping_targets")
      .select("*")
      .eq("is_active", true);

    if (targets?.length) {
      for (const target of targets) {
        try {
          let jobs: any[] = [];
          if (target.target_type === "greenhouse") {
            jobs = await scrapeGreenhouse(target.url);
          } else if (target.target_type === "lever") {
            jobs = await scrapeLever(target.url);
          }
          allJobs = allJobs.concat(jobs);
        } catch (e) {
          console.error(`Target ${target.name} failed:`, e);
        }
        // Update last_scraped_at
        await supabaseAdmin
          .from("scraping_targets")
          .update({ last_scraped_at: new Date().toISOString() })
          .eq("id", target.id);
      }
      console.log(`✅ User targets: ${targets.length} processed`);
    }

    // ── Step 3: AI web crawl based on active user profiles ──
    const { data: profiles } = await supabaseAdmin
      .from("job_seeker_profiles")
      .select("target_job_titles, skills, location, career_level, preferred_job_types")
      .not("target_job_titles", "is", null);

    // Build unique search queries from user profiles
    const searchQueries = new Set<string>();
    for (const p of profiles || []) {
      const titles = p.target_job_titles as string[] | null;
      if (titles?.length) {
        for (const title of titles.slice(0, 3)) {
          const loc = p.location ? ` ${p.location}` : "";
          const level = p.career_level ? ` ${p.career_level}` : "";
          searchQueries.add(`${title}${level}${loc} job openings`);
        }
      }
    }

    // Also add some broad popular searches
    const broadSearches = [
      "software engineer remote job openings",
      "data analyst job openings",
      "product manager job openings",
      "UX designer job openings",
      "DevOps engineer job openings",
      "project manager job openings",
      "business analyst job openings",
      "marketing manager job openings",
      "cybersecurity engineer job openings",
      "cloud architect job openings",
      "VP information technology job openings",
      "CISO chief information security officer job openings",
      "IT director job openings",
      "data engineer job openings",
      "machine learning engineer job openings",
      "site:myworkdayjobs.com software engineer",
      "site:myworkdayjobs.com data analyst",
      "site:icims.com software engineer jobs",
    ];
    for (const s of broadSearches) searchQueries.add(s);

    // Run AI crawls in batches of 3 to avoid rate limits
    const queries = Array.from(searchQueries);
    console.log(`🌐 AI crawling ${queries.length} search queries...`);

    for (let i = 0; i < queries.length; i += 3) {
      const batch = queries.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map((q) => aiWebCrawl(q, Deno.env.get("ANTHROPIC_API_KEY")))
      );
      for (const r of results) {
        if (r.status === "fulfilled") allJobs = allJobs.concat(r.value);
      }
      // Small delay between batches
      if (i + 3 < queries.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`📊 Total raw jobs collected: ${allJobs.length}`);

    // ── Step 4: Deduplicate ──
    const seen = new Set<string>();
    const unique = allJobs.filter((j) => {
      const normalizedUrl = normalizeJobUrl(j.job_url);
      j.job_url = normalizedUrl;

      const key = j.source_id || `${j.company}-${j.title}`.toLowerCase().replace(/\s+/g, "-");
      if (seen.has(key)) return false;
      seen.add(key);
      if (!j.job_url) return false;
      if (isGenericJobListingUrl(j.job_url)) return false;
      if (!isLikelyDirectJobPostingUrl(j.job_url)) return false;
      if (!hasSubstantiveDescription(j.description)) return false;
      return true;
    });

    console.log(`🔍 After dedup/filter: ${unique.length} jobs`);

    // ── Step 5: Upsert into scraped_jobs ──
    let inserted = 0;
    for (const job of unique) {
      const quality = scoreJob(job);
      const { error } = await supabaseAdmin.from("scraped_jobs").upsert(
        {
          title: job.title,
          company: job.company,
          description: job.description,
          location: job.location,
          salary: job.salary,
          job_url: job.job_url,
          source: job.source,
          source_id: job.source_id,
          job_type: job.job_type,
          seniority: job.seniority,
          industry: job.industry,
          is_remote: job.is_remote,
          quality_score: quality.score,
          is_flagged: quality.flagged,
          flag_reasons: quality.reasons,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "source_id" }
      );
      if (!error) inserted++;
      else console.error("Upsert error:", error.message);
    }

    // ── Step 6: Clean up stale jobs (not seen in 14 days) ──
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 14);
    const { count: deletedCount } = await supabaseAdmin
      .from("scraped_jobs")
      .delete({ count: "exact" })
      .lt("last_seen_at", staleDate.toISOString());

    console.log(`🗑️ Cleaned up ${deletedCount || 0} stale jobs`);
    console.log(`✅ Daily refresh complete: ${inserted} jobs upserted`);

    return new Response(
      JSON.stringify({
        success: true,
        total_collected: allJobs.length,
        unique_filtered: unique.length,
        upserted: inserted,
        stale_removed: deletedCount || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Daily refresh error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
