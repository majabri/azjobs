/**
 * Tests for the CacheManager utility class.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import CacheManager from "@/lib/platform/cacheManager";

afterEach(() => {
  vi.useRealTimers();
});

describe("CacheManager", () => {
  it("returns null for a key that has never been set", () => {
    const cache = new CacheManager();
    expect(cache.get("missing")).toBeNull();
  });

  it("returns the value immediately after set", () => {
    const cache = new CacheManager();
    cache.set("key", "hello");
    expect(cache.get("key")).toBe("hello");
  });

  it("stores and retrieves complex objects", () => {
    const cache = new CacheManager();
    const data = { name: "Alice", score: 99, tags: ["a", "b"] };
    cache.set("user", data);
    expect(cache.get("user")).toEqual(data);
  });

  it("validate returns true for a live key", () => {
    const cache = new CacheManager();
    cache.set("token", "abc123");
    expect(cache.validate("token")).toBe(true);
  });

  it("validate returns false for a missing key", () => {
    const cache = new CacheManager();
    expect(cache.validate("nothing")).toBe(false);
  });

  it("clear removes all entries", () => {
    const cache = new CacheManager();
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });

  it("returns null for an expired entry", () => {
    vi.useFakeTimers();
    const cache = new CacheManager(1000); // 1 second validity
    cache.set("token", "xyz");

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000);

    expect(cache.get("token")).toBeNull();
  });

  it("validate returns false for an expired entry", () => {
    vi.useFakeTimers();
    const cache = new CacheManager(500);
    cache.set("item", "value");
    vi.advanceTimersByTime(600);
    expect(cache.validate("item")).toBe(false);
  });

  it("overwrites existing key with new value", () => {
    const cache = new CacheManager();
    cache.set("key", "first");
    cache.set("key", "second");
    expect(cache.get("key")).toBe("second");
  });

  it("stores null as a value", () => {
    const cache = new CacheManager();
    cache.set("nullable", null);
    // null is stored but get() returns null for both missing and null values
    // by design (null value is treated same as missing)
    expect(cache.get("nullable")).toBeNull();
  });
});
