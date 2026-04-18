/**
 * Tests for the production-safe logger utility.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  // Reset import.meta.env mock between tests
  const originalDev = import.meta.env.DEV;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports info, warn, error, debug methods", async () => {
    const { logger } = await import("@/lib/logger");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("logger methods are callable without throwing", async () => {
    const { logger } = await import("@/lib/logger");
    expect(() => logger.info("test info")).not.toThrow();
    expect(() => logger.warn("test warn")).not.toThrow();
    expect(() => logger.error("test error")).not.toThrow();
    expect(() => logger.debug("test debug")).not.toThrow();
  });

  it("accepts additional arguments", async () => {
    const { logger } = await import("@/lib/logger");
    expect(() => logger.error("message", new Error("detail"), { extra: 1 })).not.toThrow();
    expect(() => logger.info("info", "arg1", 42, { obj: true })).not.toThrow();
  });
});
