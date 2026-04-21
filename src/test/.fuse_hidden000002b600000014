/**
 * Tests for security helper utilities.
 */
import { describe, it, expect } from "vitest";
import { sanitizePromptInput, corsAllowList } from "@/lib/platform/securityHelpers";

describe("sanitizePromptInput", () => {
  it("returns non-script text unchanged", () => {
    const input = "Tell me about React development";
    expect(sanitizePromptInput(input)).toBe(input);
  });

  it("removes script tags and their contents", () => {
    const result = sanitizePromptInput('Hello <script>alert("xss")</script> World');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("handles multi-line script tags", () => {
    const result = sanitizePromptInput("Before <script>\nconsole.log('bad')\n</script> After");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("console.log");
  });

  it("returns empty string unchanged", () => {
    expect(sanitizePromptInput("")).toBe("");
  });

  it("handles case-insensitive SCRIPT tags", () => {
    const result = sanitizePromptInput("<SCRIPT>evil()</SCRIPT>");
    expect(result).not.toContain("evil");
  });

  it("preserves content outside script tags", () => {
    const result = sanitizePromptInput('Clean text <script>bad()</script> more clean');
    expect(result).toContain("Clean text");
    expect(result).toContain("more clean");
  });
});

describe("corsAllowList", () => {
  it("returns true when origin is in allowed list", () => {
    expect(corsAllowList("https://icareeros.com", ["https://icareeros.com", "https://api.icareeros.com"])).toBe(true);
  });

  it("returns false when origin is not in allowed list", () => {
    expect(corsAllowList("https://evil.com", ["https://icareeros.com"])).toBe(false);
  });

  it("returns false for empty allowed list", () => {
    expect(corsAllowList("https://icareeros.com", [])).toBe(false);
  });

  it("is case-sensitive (exact match required)", () => {
    expect(corsAllowList("https://ICAREEROS.COM", ["https://icareeros.com"])).toBe(false);
  });

  it("returns true when multiple origins are allowed", () => {
    const allowed = ["https://app.com", "https://staging.app.com", "http://localhost:3000"];
    expect(corsAllowList("http://localhost:3000", allowed)).toBe(true);
  });
});
