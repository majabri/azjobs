/**
 * job-parser.ts — Section-aware job description parser
 *
 * Splits raw job text into labeled sections, then:
 *   KEEP  — skills-relevant content (responsibilities, requirements, qualifications)
 *   STRIP — noise that pollutes the AI analysis engine (benefits, EEO, apply info)
 *   META  — useful metadata (title, location, salary) → preserved separately
 *
 * The result is a clean text block containing ONLY content the AI needs to
 * accurately score skills and identify gaps, without benefits or legal boilerplate
 * inflating the skill extraction.
 *
 * Runtime: Deno (Supabase Edge Functions — no Node.js APIs)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SectionTag = "keep" | "strip" | "meta" | "unknown";

export interface ParsedSection {
  header: string;
  body: string;
  tag: SectionTag;
  reason?: string;
}

export interface JobParseResult {
  /** Clean job description — only KEEP sections. Use this for AI analysis. */
  cleanDescription: string;
  /** Metadata pulled out (title, location, salary, company, type). */
  meta: JobMeta;
  /** All parsed sections with tags (for debugging / observability). */
  sections: ParsedSection[];
  /** Number of characters stripped. */
  strippedChars: number;
  /** True if the result looks like a real job description. */
  isJobDescription: boolean;
}

export interface JobMeta {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  jobType?: string; // full-time, part-time, contract, etc.
  remote?: boolean;
  department?: string;
}

// ---------------------------------------------------------------------------
// Section classification rules
// ---------------------------------------------------------------------------

/**
 * Headers that indicate KEEP sections.
 * Content under these headers contains skills / requirements the AI needs.
 */
const KEEP_HEADERS: RegExp[] = [
  /^(job\s*)?description/i,
  /^(about|overview of)\s*(the\s*)?(role|position|opportunity|job)/i,
  /^the\s*role/i,
  /^position\s*(overview|summary|description)/i,
  /^role\s*(overview|summary|description)/i,
  /^what\s*you.?ll\s*(do|be\s*doing|own|build|drive|lead)/i,
  /^(key\s*)?(responsibilities|duties|accountabilities)/i,
  /^(your\s*)?day[- ]to[- ]day/i,
  /^what\s*we.?re\s*looking\s*for/i,
  /^(minimum\s*)?(required\s*)?(qualifications?|requirements?)/i,
  /^(basic|minimum|preferred|desired|nice[- ]to[- ]have)\s*(qualifications?|requirements?)/i,
  /^(technical\s*)?(skills?|competencies|expertise)/i,
  /^(must[- ]have|need\s*to\s*have)/i,
  /^(preferred|bonus)\s*(skills?|qualifications?|experience)/i,
  /^(minimum|required)\s*experience/i,
  /^experience\s*(required|and\s*skills?)/i,
  /^what\s*you\s*(bring|offer|have)/i,
  /^your\s*(background|profile|skills?|experience)/i,
  /^(core\s*)?competencies/i,
  /^(key\s*)?(success\s*)?factors/i,
  /^(about\s*the\s*)?(team|project|product)/i,
  /^technologies?(\s*stack)?/i,
  /^tech\s*stack/i,
  /^tools?\s*(&|and)\s*technologies?/i,
];

/**
 * Headers that indicate STRIP sections.
 * Content here doesn't contribute to skills analysis — strip it.
 */
const STRIP_HEADERS: RegExp[] = [
  // Benefits & compensation
  /^(what\s*we\s*offer|what\s*you.?ll\s*get|why\s*(join|work(\s*with)?\s*us)|our\s*offer)/i,
  /^(employee\s*)?(benefits?|perks?|rewards?)/i,
  /^compensation(\s*&\s*benefits?)?/i,
  /^(total\s*)?rewards?/i,
  /^(salary|pay)\s*(range|information|details?)/i,
  /^(our\s*)?(package|offerings?)/i,
  /^why\s*(this\s*role|this\s*opportunity)/i,
  /^life\s*at\s*/i,
  /^working\s*at\s*/i,
  // Apply / process info
  /^(how\s*to\s*)?apply/i,
  /^application\s*(process|instructions?|details?)/i,
  /^(next\s*)?steps?/i,
  /^interview\s*(process|stages?)/i,
  /^hiring\s*(process|stages?)/i,
  /^what\s*(to\s*expect|happens\s*next)/i,
  // EEO / legal boilerplate
  /^equal\s*(opportunity|employment)/i,
  /^eeo/i,
  /^(our\s*)?commitment\s*to\s*(diversity|inclusion|equity)/i,
  /^diversity(\s*&\s*(equity\s*&\s*)?inclusion)?/i,
  /^(we\s*(are|value|celebrate)\s*(an?\s*)?)?(equal|inclusive|diverse)/i,
  /^(disability|accommodation)/i,
  /^notice\s*(to\s*)?(staffing\s*)?agencies?/i,
  /^(no\s*)?(recruiters?|agencies?|third[- ]party)/i,
  /^unsolicited\s*(resumes?|applications?)/i,
  // Company marketing fluff
  /^(about\s*(the\s*)?company|company\s*overview|who\s*we\s*are)/i,
  /^our\s*(story|mission|vision|values?|culture)/i,
  /^mission(\s*&\s*vision)?/i,
  /^(our\s*)?culture(\s*&\s*values?)?/i,
  // Disclaimers
  /^(important\s*)?(notice|disclaimer|note)/i,
  /^please\s*note/i,
  /^(job\s*)?(id|code|number|ref|reference)\s*:/i,
];

/**
 * Body-level patterns that should be stripped even outside labeled sections.
 * These are inline boilerplate that appears without a section header.
 */
const STRIP_INLINE_PATTERNS: RegExp[] = [
  // EEO statements
  /we\s*(are|provide)\s*an?\s*equal\s*(opportunity|employment)/i,
  /regardless\s*of\s*(race|color|gender|sex|age|national\s*origin|religion|disability|veteran)/i,
  /all\s*qualified\s*applicants\s*will\s*receive\s*consideration/i,
  /we\s*do\s*not\s*discriminate/i,
  /protected\s*(characteristics?|class|veteran)/i,
  // Agency notices
  /we\s*do\s*not\s*accept\s*(unsolicited\s*)?(resumes?|applications?)\s*from\s*(recruiters?|agencies?|staffing)/i,
  /to\s*all\s*recruitment\s*agencies/i,
  /third[- ]party\s*(recruiters?|agencies?)/i,
  // Legal / disclaimer
  /this\s*(job\s*)?posting\s*(is|was)\s*(not|no\s*longer)\s*(accepting|active|open)/i,
  /application\s*deadline\s*:/i,
];

/**
 * Salary / compensation patterns to extract as metadata (not for AI analysis).
 */
const SALARY_PATTERN =
  /\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*(?:per\s*year|\/yr|annually|\/year|\/hour|\/hr|per\s*hour|k))?/i;

const JOB_TYPE_PATTERN =
  /\b(full[- ]time|part[- ]time|contract|temporary|temp|freelance|internship|intern|co[- ]op)\b/i;

const REMOTE_PATTERN =
  /\b(fully\s*remote|remote[- ]first|remote\s*ok|work\s*from\s*home|wfh|hybrid|on[- ]site|in[- ]office)\b/i;

// ---------------------------------------------------------------------------
// Section splitter
// ---------------------------------------------------------------------------

/**
 * Split raw text into sections based on header detection.
 * Headers are lines that are short, possibly styled (#, **, ALL CAPS).
 */
function splitIntoSections(text: string): Array<{ header: string; body: string }> {
  const lines = text.split("\n");
  const sections: Array<{ header: string; body: string }> = [];
  let currentHeader = "";
  let currentBody: string[] = [];

  const isHeader = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 120) return false;
    // Markdown headers
    if (/^#{1,4}\s+/.test(trimmed)) return true;
    // Bold text
    if (/^\*{1,2}[^*]+\*{1,2}$/.test(trimmed)) return true;
    // ALL CAPS line (at least 3 words or 10+ chars)
    if (trimmed === trimmed.toUpperCase() && trimmed.length >= 8 && /[A-Z]{2,}/.test(trimmed)) return true;
    // Ends with colon and is short
    if (trimmed.endsWith(":") && trimmed.length <= 60 && !/^[-•*]/.test(trimmed)) return true;
    return false;
  };

  const cleanHeader = (h: string) =>
    h.replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").replace(/:$/, "").trim();

  for (const line of lines) {
    if (isHeader(line)) {
      // Save previous section
      if (currentHeader || currentBody.length > 0) {
        sections.push({ header: cleanHeader(currentHeader), body: currentBody.join("\n").trim() });
      }
      currentHeader = line.trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // Last section
  if (currentHeader || currentBody.length > 0) {
    sections.push({ header: cleanHeader(currentHeader), body: currentBody.join("\n").trim() });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Section classifier
// ---------------------------------------------------------------------------

function classifySection(header: string, body: string): { tag: SectionTag; reason: string } {
  const h = header.toLowerCase();

  // Check STRIP first (more specific)
  for (const pattern of STRIP_HEADERS) {
    if (pattern.test(h)) return { tag: "strip", reason: `strip-header: ${pattern.source.slice(0, 40)}` };
  }

  // Check inline strip patterns in body
  const strippableLines = body.split("\n").filter((line) =>
    STRIP_INLINE_PATTERNS.some((p) => p.test(line))
  );
  if (strippableLines.length > 0 && strippableLines.length >= body.split("\n").length * 0.7) {
    return { tag: "strip", reason: "strip-inline: majority of lines are boilerplate" };
  }

  // Check KEEP
  for (const pattern of KEEP_HEADERS) {
    if (pattern.test(h)) return { tag: "keep", reason: `keep-header: ${pattern.source.slice(0, 40)}` };
  }

  // Meta signals (no header — first section is usually job summary)
  if (!header && body.length > 0) return { tag: "keep", reason: "keep: opening paragraph (no header)" };

  return { tag: "unknown", reason: "unknown: no matching rule" };
}

// ---------------------------------------------------------------------------
// Inline noise stripper
// ---------------------------------------------------------------------------

function stripInlineNoise(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true; // preserve blank lines
      return !STRIP_INLINE_PATTERNS.some((p) => p.test(t));
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Metadata extractor
// ---------------------------------------------------------------------------

function extractMeta(text: string, titleHint?: string): JobMeta {
  const meta: JobMeta = {};

  if (titleHint) meta.title = titleHint;

  const salaryMatch = text.match(SALARY_PATTERN);
  if (salaryMatch) meta.salary = salaryMatch[0];

  const typeMatch = text.match(JOB_TYPE_PATTERN);
  if (typeMatch) meta.jobType = typeMatch[1].toLowerCase();

  const remoteMatch = text.match(REMOTE_PATTERN);
  if (remoteMatch) {
    const r = remoteMatch[1].toLowerCase();
    meta.remote = /remote|wfh/.test(r);
  }

  // Location: "Location: City, State" or "Remote - City, State"
  const locationMatch = text.match(/(?:location|based\s+in|office)\s*:?\s*([^\n,]{3,60})/i);
  if (locationMatch) meta.location = locationMatch[1].trim();

  // Department
  const deptMatch = text.match(/(?:department|team|division)\s*:?\s*([^\n]{3,50})/i);
  if (deptMatch) meta.department = deptMatch[1].trim();

  return meta;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw job description text into clean, AI-ready content.
 *
 * Strips: benefits, EEO statements, apply instructions, company marketing,
 *         salary ranges, disclaimers, agency notices.
 *
 * Keeps: responsibilities, requirements, qualifications, skills, tech stack,
 *        role overview, team context.
 *
 * @param rawText   Raw extracted text (from Cheerio or ATS API)
 * @param titleHint Page title or ATS-provided title
 */
export function parseJobDescription(rawText: string, titleHint?: string): JobParseResult {
  const meta = extractMeta(rawText, titleHint);
  const rawSections = splitIntoSections(rawText);

  const sections: ParsedSection[] = rawSections.map(({ header, body }) => {
    const { tag, reason } = classifySection(header, body);
    return { header, body, tag, reason };
  });

  // If no sections were KEEP-tagged, treat all unknown sections as keep
  // (better to over-include than return empty for an unrecognized format)
  const hasKeep = sections.some((s) => s.tag === "keep");

  const keepSections = sections.filter((s) =>
    s.tag === "keep" || (!hasKeep && s.tag === "unknown")
  );

  // Reconstruct clean text from keep sections
  const cleanParts = keepSections.map((s) => {
    const header = s.header ? `\n${s.header}\n` : "";
    const body = stripInlineNoise(s.body);
    return `${header}${body}`.trim();
  });

  const cleanDescription = cleanParts.filter(Boolean).join("\n\n").trim();

  // Calculate stripped chars
  const strippedSections = sections.filter((s) => s.tag === "strip");
  const strippedChars = strippedSections.reduce((acc, s) => acc + s.body.length, 0);

  // Quality check
  const isJobDescription =
    cleanDescription.length >= 150 &&
    /\b(experience|requirements?|qualifications?|responsibilities|skills?|role|position)\b/i.test(cleanDescription);

  return { cleanDescription, meta, sections, strippedChars, isJobDescription };
}

/**
 * Convenience: parse and return just the clean text.
 * Returns the original text if parsing produces empty output (safe fallback).
 */
export function cleanJobText(rawText: string, titleHint?: string): string {
  if (!rawText || rawText.length < 100) return rawText;
  const result = parseJobDescription(rawText, titleHint);
  // If parser stripped too aggressively (e.g. unusual format), return original
  if (result.cleanDescription.length < 150 && rawText.length >= 300) {
    console.warn(`[job-parser] Parser output too short (${result.cleanDescription.length} chars), using original`);
    return rawText;
  }
  return result.cleanDescription || rawText;
}
