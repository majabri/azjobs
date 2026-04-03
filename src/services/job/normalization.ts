/**
 * Job Service — Data normalization layer.
 * Standardizes job data before scoring.
 */

/** Parse salary strings like "$80k-100k", "$120,000/yr", "80000-100000" into {min, max} */
export function parseSalaryRange(raw: string | null | undefined): { min: number; max: number } | null {
  if (!raw) return null;
  const text = raw.replace(/,/g, "").toLowerCase().trim();

  // Match patterns like "$80k-$100k", "80k - 100k", "$80,000 - $100,000"
  const rangeMatch = text.match(/\$?\s*(\d+\.?\d*)\s*k?\s*[-–—to]+\s*\$?\s*(\d+\.?\d*)\s*k?/i);
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1]);
    let max = parseFloat(rangeMatch[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    if (min > 0 && max > 0 && max >= min) return { min, max };
  }

  // Single value like "$120k", "$120,000"
  const singleMatch = text.match(/\$?\s*(\d+\.?\d*)\s*k?/i);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1]);
    if (val < 1000) val *= 1000;
    if (val > 0) return { min: val * 0.9, max: val * 1.1 };
  }

  return null;
}

/** Normalize job title to title case and strip common suffixes */
export function normalizeTitle(raw: string): string {
  return raw
    .replace(/\s*[-|–—]\s*(remote|hybrid|onsite|on-site|full[- ]time|part[- ]time|contract).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize company name */
export function normalizeCompanyName(raw: string): string {
  return raw
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|plc\.?|gmbh|s\.a\.?)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize location string */
export function normalizeLocation(raw: string): string {
  const text = raw.trim();
  if (!text) return "Not specified";
  if (/\bremote\b/i.test(text)) return "Remote";
  // Standardize "City, ST" format
  const match = text.match(/^([A-Za-z\s]+),\s*([A-Z]{2})$/);
  if (match) return `${match[1].trim()}, ${match[2]}`;
  return text;
}

/** Generate a dedup hash key from title + company + location */
export function dedupKey(title: string, company: string, location: string): string {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${normalize(title)}|${normalize(company)}|${normalize(location)}`;
}

/** Infer seniority from title */
export function inferSeniority(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(chief|cto|ceo|cfo|coo|vp|vice president|svp|evp)\b/.test(t)) return "executive";
  if (/\b(director|head of)\b/.test(t)) return "director";
  if (/\b(senior|sr\.?|staff|principal|lead)\b/.test(t)) return "senior";
  if (/\b(mid[- ]?level|intermediate)\b/.test(t)) return "mid";
  if (/\b(junior|jr\.?|entry[- ]?level|associate)\b/.test(t)) return "junior";
  if (/\b(intern|internship|co[- ]?op)\b/.test(t)) return "intern";
  return null;
}

/** Classify remote status from text */
export function classifyRemote(title: string, location: string, description: string): boolean {
  const combined = `${title} ${location} ${description}`.toLowerCase();
  return /\b(remote|work from home|wfh|fully remote|100% remote)\b/.test(combined);
}
