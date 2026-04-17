// Shared helpers used by every Discovery Agent adapter.
// Patterns ported from python-jobspy: rotating UAs, polite fetch,
// salary regex, HTML → text, keyword post-filtering.

// ---------------------------------------------------------------------------
// User-agent rotation — same pattern jobspy uses.
// ---------------------------------------------------------------------------
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ---------------------------------------------------------------------------
// Polite fetch — random UA, timeout, Accept-Language header.
// ---------------------------------------------------------------------------
export async function politeFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': pickUserAgent(),
        Accept: 'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Dedupe hash — deterministic across runs; same board+id+title+company = same hash.
// ---------------------------------------------------------------------------
export async function computeDedupeHash(
  board: string,
  externalId: string,
  title: string,
  company: string
): Promise<string> {
  const input = `${board}::${externalId}::${title.trim().toLowerCase()}::${company.trim().toLowerCase()}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Salary parser — handles "$80k", "$80k-$120k", "80,000 - 120,000", "USD 80000".
// Ported from jobspy's salary extraction logic.
// ---------------------------------------------------------------------------
const SALARY_RE =
  /(?<currency>\$|USD|EUR|GBP|CAD)?\s*(?<min>\d{1,3}(?:[,.]\d{3})*|\d+)\s*(?<minK>k)?(?:\s*[-–to]+\s*(?<max>\d{1,3}(?:[,.]\d{3})*|\d+)\s*(?<maxK>k)?)?/i;

export function parseSalary(input: string | null | undefined): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  if (!input) return { min: null, max: null, currency: null };
  const m = input.match(SALARY_RE);
  if (!m?.groups) return { min: null, max: null, currency: null };

  const parseNum = (s: string | undefined, k: boolean): number | null => {
    if (!s) return null;
    const n = Number(s.replace(/[,.]/g, ''));
    if (Number.isNaN(n)) return null;
    return k ? n * 1000 : n;
  };

  const min = parseNum(m.groups.min, Boolean(m.groups.minK));
  const max = parseNum(m.groups.max, Boolean(m.groups.maxK));

  // Reject implausible values (parse miss) — must be between $10k and $2M.
  const clean = (n: number | null) =>
    n !== null && n >= 10_000 && n <= 2_000_000 ? n : null;

  const currency =
    m.groups.currency === '$' ? 'USD' : m.groups.currency?.toUpperCase() ?? null;

  return { min: clean(min), max: clean(max), currency };
}

// ---------------------------------------------------------------------------
// HTML → plain text — works in Deno without jsdom.
// ---------------------------------------------------------------------------
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Post-filter — keyword must appear in title or description.
// Used when a board's own search is weak or absent (e.g. RemoteOK full feed).
// ---------------------------------------------------------------------------
export function matchesSearch(
  job: { title: string; description?: string | null },
  term: string
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return (
    job.title.toLowerCase().includes(needle) ||
    (job.description ?? '').toLowerCase().includes(needle)
  );
}
