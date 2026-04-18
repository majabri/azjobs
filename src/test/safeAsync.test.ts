/**
 * Tests for the safeAsync retry utility.
 */
import { describe, it, expect, vi } from "vitest";
import safeAsync from "@/lib/platform/safeAsync";

describe("safeAsync", () => {
  it("resolves immediately on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await safeAsync(fn, 3, 5000);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue("recovered");

    const result = await safeAsync(fn, 3, 5000);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent failure"));
    await expect(safeAsync(fn, 2, 5000)).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns the resolved value from the successful attempt", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(42);
    const result = await safeAsync(fn, 3, 5000);
    expect(result).toBe(42);
  });

  it("rejects with Timeout error when fn takes too long", async () => {
    // fn never resolves; very short timeout forces rejection
    const fn = () => new Promise<void>(() => {});
    await expect(safeAsync(fn, 1, 1)).rejects.toThrow("Timeout");
  });
});
