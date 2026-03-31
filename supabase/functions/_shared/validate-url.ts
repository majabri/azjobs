/**
 * URL validation helpers for Supabase Edge Functions.
 *
 * Blocks localhost, private IPv4/IPv6 ranges, link-local and cloud-metadata
 * addresses so that user-supplied URLs cannot be used for SSRF.
 *
 * Usage:
 *   import { validatePublicUrl } from "../_shared/validate-url.ts";
 *
 *   const result = validatePublicUrl(rawUrl);
 *   if (!result.ok) return errorResponse(result.error, 400);
 *   // use result.url (the validated, normalised URL string)
 */

export type UrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** IPv4 CIDR ranges that must never be reachable from user-supplied URLs. */
const PRIVATE_IPV4_RANGES: Array<{ base: number; mask: number }> = [
  // 127.0.0.0/8  – loopback
  { base: 0x7f000000, mask: 0xff000000 },
  // 10.0.0.0/8   – RFC-1918
  { base: 0x0a000000, mask: 0xff000000 },
  // 172.16.0.0/12 – RFC-1918
  { base: 0xac100000, mask: 0xfff00000 },
  // 192.168.0.0/16 – RFC-1918
  { base: 0xc0a80000, mask: 0xffff0000 },
  // 169.254.0.0/16 – link-local / AWS metadata
  { base: 0xa9fe0000, mask: 0xffff0000 },
  // 0.0.0.0/8
  { base: 0x00000000, mask: 0xff000000 },
];

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return false;
  const addr = ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
  return PRIVATE_IPV4_RANGES.some(({ base, mask }) => (addr & mask) === base);
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  // AWS EC2 instance metadata (IPv4 and IPv6)
  "169.254.169.254",
  "fd00:ec2::254",
  "[fd00:ec2::254]",
  // GCP metadata
  "metadata.google.internal",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => h.endsWith(suffix))) return true;
  // IPv6 loopback / link-local
  if (h === "::1" || h === "[::1]") return true;
  if (h.startsWith("fe80:") || h.startsWith("[fe80:")) return true;
  // AWS IMDSv2 IPv6 prefix fd00:ec2::/32
  const bare = h.replace(/^\[|\]$/g, "");
  if (bare.startsWith("fd00:ec2:")) return true;
  return false;
}

/**
 * Validates that `rawUrl` is a safe, public HTTP(S) URL.
 *
 * Returns `{ ok: true, url }` on success, or `{ ok: false, error }` on failure.
 */
export function validatePublicUrl(rawUrl: unknown): UrlValidationResult {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { ok: false, error: "URL is required" };
  }

  let urlStr = rawUrl.trim();
  // Normalise bare hostnames submitted without a scheme
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:") {
    return { ok: false, error: "Only http and https URLs are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHost(hostname)) {
    return { ok: false, error: "URL hostname is not allowed" };
  }
  if (isPrivateIPv4(hostname)) {
    return { ok: false, error: "URL resolves to a private or reserved address" };
  }

  return { ok: true, url: parsed.toString() };
}
