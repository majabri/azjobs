import { describe, it, expect } from "vitest";
import { normalizeError } from "@/lib/normalizeError";

describe("normalizeError", () => {
  it("returns message for Error instances", () => {
    expect(normalizeError(new Error("boom"))).toBe("boom");
  });

  it("returns message field from plain objects with a message string", () => {
    expect(normalizeError({ message: "oauth failed" })).toBe("oauth failed");
  });

  it("ignores non-string message fields and falls back to JSON.stringify", () => {
    const result = normalizeError({ code: 401, details: "unauthorized" });
    expect(result).toBe(JSON.stringify({ code: 401, details: "unauthorized" }));
  });

  it("converts primitive strings as-is", () => {
    expect(normalizeError("something went wrong")).toBe("something went wrong");
  });

  it("converts numbers to string", () => {
    expect(normalizeError(42)).toBe("42");
  });

  it("converts null to the string 'null'", () => {
    expect(normalizeError(null)).toBe("null");
  });

  it("handles objects with circular references gracefully", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    // JSON.stringify throws on circular refs → falls back to String()
    const result = normalizeError(obj);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
