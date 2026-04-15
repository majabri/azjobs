/**
 * cheerio-fallback.ts — Enhanced HTML extraction for job postings
 *
 * Strategy (in priority order):
 *  1. ATS-specific selectors — 40+ platforms
 *  2. Semantic landmark selectors (<main>, <article>, [role=main])
 *  3. Common job-board CSS classes / data attributes
 *  4. Largest text block heuristic
 *  5. Full-body strip
 *
 * Runtime: Deno (Supabase Edge Functions)
 */

import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

export interface ExtractionResult {
  ok: boolean;
  text: string;
  title?: string;
  strategy?: string;
  usedFallback: boolean;
}

const MAX_CHARS = 8_000;

// ---------------------------------------------------------------------------
// ATS / Job board selectors (hostname → ordered selector list)
// ---------------------------------------------------------------------------

const ATS_SELECTORS: Record<string, string[]> = {
  // ── ATS platforms ─────────────────────────────────────────────────────────
  "boards.greenhouse.io":     ["#content", ".job__description", "section.content", "main"],
  "greenhouse.io":            ["#content", ".job__description", "main"],
  "jobs.lever.co":            [".section-wrapper", ".posting-requirements", ".posting-description", "main"],
  "jobs.ashbyhq.com":         [".ashby-job-posting-description", ".job-posting-description", "main"],
  "jobs.smartrecruiters.com": [".job-description", ".details-content", "[data-testid='job-description']", "main"],
  "smartrecruiters.com":      [".job-description", ".details-content", "main"],
  "icims.com":                [".iCIMS_JobContent", "#jobDetails", "#col-left", "main"],
  "bamboohr.com":             [".BambooHR-ATS-Jobs-Item", "#BambooHR-ATS-body", "main"],
  "taleo.net":                ["#mainframe", "#job-details", ".job-content", "main"],
  "app.jazz.co":              [".job-description", "main"],
  "ats.rippling.com":         [".job-description", "main"],
  "breezy.hr":                [".description", ".job-description", "main"],
  "workable.com":             [".job-description", "[data-ui='job-description']", "main"],
  "apply.workable.com":       [".job-description", "[data-ui='job-description']", "main"],
  "recruitee.com":            [".job-description", ".offer-description", "main"],
  "pinpointhq.com":           [".job-description", "main"],
  "teamtailor.com":           ["[data-testid='body']", ".job-description", "main"],
  "personio.com":             [".job-description", ".description", "main"],
  "freshteam.com":            [".job-description", "main"],
  "jobvite.com":              ["#job-description", ".jv-job-detail-description", "main"],
  "myworkdayjobs.com":        ['[data-automation-id="jobPostingDescription"]', ".job-description", "main"],

  // ── Major aggregators & boards ────────────────────────────────────────────
  "indeed.com":               ["#jobDescriptionText", ".jobsearch-jobDescriptionText", "[data-testid='jobsearch-JobInfoHeader-jobDescription']"],
  "linkedin.com":             [".description__text", ".show-more-less-html", ".jobs-description__content"],
  "glassdoor.com":            [".desc", ".jobDescriptionContent", "[data-test='jobDescriptionContent']"],
  "ziprecruiter.com":         [".job_description", "[data-testid='job-description']", ".jobDescriptionSection"],
  "monster.com":              [".content-desc", "#JobDescription", ".job-description"],
  "careerbuilder.com":        ["[data-testid='job-description']", ".cb-description", "#description-content-details"],
  "snagajob.com":             [".job-description", "[data-testid='job-post-description']", ".JobDescriptionWrapper"],
  "simplyhired.com":          [".viewjob-description", ".job-description", "main"],
  "dice.com":                 ["#jobdescSec", "[data-testid='jobDescription']", ".job-description", ".position-jd"],

  // ── Tech / startup focused ────────────────────────────────────────────────
  "wellfound.com":            [".job-listing-description", ".job__description", ".description"],
  "angel.co":                 [".job-listing-description", ".description"],
  "hired.com":                [".JobDescription", ".job-description", "main"],
  "triplebyte.com":           [".job-description", "main"],
  "stackoverflow.com":        [".job-description", "#job-description", ".description"],
  "levels.fyi":               [".description", ".job-description", "main"],

  // ── Freelance platforms ───────────────────────────────────────────────────
  "upwork.com":               ["[data-test='Description']", ".job-description", ".description", "main"],
  "fiverr.com":               [".job-description", ".description", "main"],
  "freelancer.com":           [".project-description", ".job-description", "main"],
  "toptal.com":               [".job-description", ".description", "main"],

  // ── Early career ──────────────────────────────────────────────────────────
  "joinhandshake.com":        [".style__description", ".posting-title", "main"],
  "wayup.com":                [".job-description", ".listing-description", "main"],
  "chegg.com":                [".job-description", "main"],

  // ── Remote-focused ────────────────────────────────────────────────────────
  "weworkremotely.com":       [".job-description", ".listing-container", "section.job-listing"],
  "remote.co":                [".job_description", ".job-description-full", ".description"],
  "remotive.com":             ["#job-description", ".job-description", "main"],
  "flexjobs.com":             [".job-description", "main"],
  "remoteleaf.com":           [".job-description", "main"],

  // ── Niche / specialty ─────────────────────────────────────────────────────
  "mediabistro.com":          [".job-description", "#job-description", "main"],
  "dribbble.com":             [".job-description-content", ".content", "main"],
  "behance.net":              [".job-description", "main"],
  "idealist.org":             [".listing-description", ".description", "main"],
  "healthecareers.com":       [".job-description", "main"],
  "craigslist.org":           ["#postingbody", "section[id*='postingbody']", ".posting-body"],
  "facebook.com":             [".job-description", "[data-testid='job-description']", "main"],

  // ── Staffing agencies ─────────────────────────────────────────────────────
  "roberthalf.com":           [".job-description", ".jobDetailDescription", "main"],
  "randstad.com":             [".job-description", ".jd-details", "main"],
  "adecco.com":               [".job-description", "main"],

  // ── Government ────────────────────────────────────────────────────────────
  "usajobs.gov":              ["#job-duty", ".job-description", "[class*='Description']", "main"],
  "governmentjobs.com":       [".job-description", "#job-description", "main"],
};

// ---------------------------------------------------------------------------
// Generic selectors (tried after ATS-specific, before heuristics)
// ---------------------------------------------------------------------------

const GENERIC_SELECTORS = [
  "main",
  "article",
  '[role="main"]',
  "#job-description",
  "#job-details",
  "#job-content",
  "#description",
  "#jobDescription",
  "#job_description",
  ".job-description",
  ".job-details",
  ".job-content",
  ".job-post-description",
  ".posting-description",
  ".job-desc",
  ".jobDescription",
  ".job_description",
  ".description",
  '[data-testid="job-description"]',
  '[data-testid="jobDescription"]',
  '[data-cy="job-description"]',
  '[itemprop="description"]',
  'section[aria-label*="job"]',
  'div[aria-label*="description"]',
];

const NOISE_TAGS = ["script", "style", "noscript", "iframe", "svg", "nav", "header", "footer", "aside"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function elementToText($: cheerio.CheerioAPI, el: cheerio.AnyNode): string {
  const $clone = $(el).clone();
  NOISE_TAGS.forEach((tag) => $clone.find(tag).remove());
  return $clone
    .html()!
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|h[1-6]|div|section|blockquote|tr)>/gi, "\n\n")
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

function findLargestBlock($: cheerio.CheerioAPI): cheerio.Cheerio<cheerio.AnyNode> | null {
  let best: cheerio.Cheerio<cheerio.AnyNode> | null = null;
  let bestLen = 0;
  $("div, section, article").each((_, el) => {
    const $el = $(el);
    const meta = ($el.attr("class") ?? "") + ($el.attr("id") ?? "");
    if (/nav|footer|header|sidebar|cookie|banner|ad-|ads-|popup|modal|overlay/i.test(meta)) return;
    const len = $el.text().trim().length;
    if (len > bestLen) { bestLen = len; best = $el; }
  });
  return best;
}

function atsSelectorsFor(url: string): string[] {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    for (const [pattern, selectors] of Object.entries(ATS_SELECTORS)) {
      if (hostname.includes(pattern)) return selectors;
    }
  } catch { /* malformed URL handled upstream */ }
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function extractWithCheerio(html: string, url: string): Promise<ExtractionResult> {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch (e) {
    console.error("[cheerio-fallback] load error:", e);
    return { ok: false, text: "", usedFallback: true };
  }

  const title = $("title").first().text().trim() || undefined;
  NOISE_TAGS.forEach((tag) => $(tag).remove());

  // 1. ATS-specific selectors
  for (const selector of atsSelectorsFor(url)) {
    const $el = $(selector).first();
    if ($el.length) {
      const text = elementToText($, $el[0]);
      if (text.length >= 150) {
        console.log(`[cheerio-fallback] ATS match: "${selector}" (${text.length} chars)`);
        return { ok: true, text: text.slice(0, MAX_CHARS), title, strategy: `ats:${selector}`, usedFallback: true };
      }
    }
  }

  // 2. Generic selectors
  for (const selector of GENERIC_SELECTORS) {
    const $el = $(selector).first();
    if ($el.length) {
      const text = elementToText($, $el[0]);
      if (text.length >= 150) {
        console.log(`[cheerio-fallback] Generic match: "${selector}" (${text.length} chars)`);
        return { ok: true, text: text.slice(0, MAX_CHARS), title, strategy: `generic:${selector}`, usedFallback: true };
      }
    }
  }

  // 3. Largest block heuristic
  const $largest = findLargestBlock($);
  if ($largest) {
    const text = elementToText($, $largest[0]);
    if (text.length >= 150) {
      console.log(`[cheerio-fallback] Largest block (${text.length} chars)`);
      return { ok: true, text: text.slice(0, MAX_CHARS), title, strategy: "heuristic:largest-block", usedFallback: true };
    }
  }

  // 4. Full body strip
  const bodyEl = $("body")[0];
  if (bodyEl) {
    const bodyText = elementToText($, bodyEl);
    if (bodyText.length >= 100) {
      console.log(`[cheerio-fallback] Full body fallback (${bodyText.length} chars)`);
      return { ok: true, text: bodyText.slice(0, MAX_CHARS), title, strategy: "fallback:body", usedFallback: true };
    }
  }

  console.warn("[cheerio-fallback] All strategies exhausted");
  return { ok: false, text: "", title, strategy: "none", usedFallback: true };
}

export function looksLikeJobDescription(text: string): boolean {
  const lower = text.toLowerCase();
  const hits = [
    "responsibilities", "requirements", "qualifications", "experience",
    "skills", "position", "role", "job", "team", "apply",
    "salary", "benefits", "candidate", "opportunity", "compensation",
    "full-time", "part-time", "remote", "hybrid", "contract",
  ].filter((kw) => lower.includes(kw)).length;
  return text.length > 200 && hits >= 2;
}
