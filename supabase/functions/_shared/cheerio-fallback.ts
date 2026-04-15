/**
 * cheerio-fallback.ts — Enhanced HTML extraction for job postings
 *
 * When the primary fetch+regex approach in scrape-url yields insufficient
 * content, this module performs a second, more aggressive parse using
 * structured selector strategies (via cheerio on esm.sh).
 *
 * Strategy (in priority order):
 *  1. ATS-specific selectors (Greenhouse, Lever, Workday, Ashby, iCIMS, etc.)
 *  2. Semantic landmark selectors (<main>, <article>, [role=main])
 *  3. Common job-board CSS classes (.job-description, .job-details, etc.)
 *  4. Largest text block heuristic
 *  5. Full-body strip as last resort
 *
 * Runtime: Deno (Supabase Edge Functions)
 */

// Pin version for reproducible builds — no auto-upgrade surprises.
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  ok: boolean;
  text: string;
  title?: string;
  /** Which selector strategy succeeded. */
  strategy?: string;
  /** True whenever this fallback module was used instead of the primary extractor. */
  usedFallback: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS = 8_000;

/**
 * ATS host → ordered selector list (most → least specific).
 * Hostname matching uses String.includes so "greenhouse.io" matches
 * both "boards.greenhouse.io" and "greenhouse.io/jobs".
 */
const ATS_SELECTORS: Record<string, string[]> = {
  "boards.greenhouse.io": ["#content", ".job__description", "section.content"],
  "jobs.lever.co":        [".section-wrapper", ".posting-requirements", ".posting-description"],
  "myworkdayjobs.com":    ['[data-automation-id="jobPostingDescription"]', ".css-7m7ger"],
  "jobs.ashbyhq.com":     [".ashby-job-posting-description", "main"],
  "icims.com":            [".iCIMS_JobContent", "#jobDetails", "#col-left"],
  "bamboohr.com":         [".BambooHR-ATS-Jobs-Item", "#BambooHR-ATS-body"],
  "taleo.net":            ["#mainframe", "#job-details"],
  "jobs.smartrecruiters.com": [".job-description", ".details-content"],
  "app.jazz.co":          [".job-description"],
  "ats.rippling.com":     [".job-description"],
  "linkedin.com":         [".description__text", ".show-more-less-html"],
  "indeed.com":           ["#jobDescriptionText", ".jobsearch-jobDescriptionText"],
  "glassdoor.com":        [".desc", ".jobDescriptionContent"],
  "wellfound.com":        [".job-listing-description", ".job__description"],
};

const GENERIC_SELECTORS = [
  "main",
  "article",
  '[role="main"]',
  ".job-description",
  ".job-details",
  ".job-content",
  ".job-post-description",
  ".posting-description",
  ".description",
  "#job-description",
  "#job-details",
  "#description",
  '[itemprop="description"]',
];

/** Tags removed before text extraction. */
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
    .replace(/<\/(?:p|li|h[1-6]|div|section|blockquote)>/gi, "\n\n")
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
    const classId = ($el.attr("class") ?? "") + ($el.attr("id") ?? "");
    if (/nav|footer|header|sidebar|cookie|banner|ad-|ads-/i.test(classId)) return;
    const len = $el.text().trim().length;
    if (len > bestLen) { bestLen = len; best = $el; }
  });

  return best;
}

function atsSelectorsFor(url: string): string[] {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [pattern, selectors] of Object.entries(ATS_SELECTORS)) {
      if (hostname.includes(pattern)) return selectors;
    }
  } catch { /* malformed URL handled upstream */ }
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract job description text from raw HTML using Cheerio.
 *
 * @param html  Raw HTML string from the job URL.
 * @param url   Original URL — used for ATS selector lookup.
 */
export async function extractWithCheerio(html: string, url: string): Promise<ExtractionResult> {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch (e) {
    console.error("[cheerio-fallback] load error:", e);
    return { ok: false, text: "", usedFallback: true };
  }

  const title = $("title").first().text().trim() || undefined;

  // Remove global noise upfront.
  NOISE_TAGS.forEach((tag) => $(tag).remove());

  // 1. ATS-specific selectors
  for (const selector of atsSelectorsFor(url)) {
    const $el = $(selector).first();
    if ($el.length) {
      const text = elementToText($, $el[0]);
      if (text.length >= 200) {
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
      if (text.length >= 200) {
        console.log(`[cheerio-fallback] Generic match: "${selector}" (${text.length} chars)`);
        return { ok: true, text: text.slice(0, MAX_CHARS), title, strategy: `generic:${selector}`, usedFallback: true };
      }
    }
  }

  // 3. Largest block heuristic
  const $largest = findLargestBlock($);
  if ($largest) {
    const text = elementToText($, $largest[0]);
    if (text.length >= 200) {
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

/**
 * Assess whether extracted text looks like a real job description.
 * Shared between primary extractor and cheerio fallback.
 */
export function looksLikeJobDescription(text: string): boolean {
  const lower = text.toLowerCase();
  const hits = [
    "responsibilities", "requirements", "qualifications", "experience",
    "skills", "position", "role", "job", "team", "apply",
    "salary", "benefits", "candidate", "opportunity",
  ].filter((kw) => lower.includes(kw)).length;
  return text.length > 200 && hits >= 2;
}
