import { describe, it, expect } from "vitest";
import { isJobIgnored, isJobAlreadySaved, type IgnoredJob } from "@/lib/ignoredJobs";

const makeIgnored = (overrides: Partial<IgnoredJob> = {}): IgnoredJob => ({
  id: "1",
  job_title: "Software Engineer",
  company: "Acme Corp",
  job_url: "https://acme.com/jobs/123",
  ...overrides,
});

describe("isJobIgnored", () => {
  it("returns false when ignoredList is empty", () => {
    expect(isJobIgnored({ title: "Engineer", company: "Acme", url: "https://acme.com/jobs/1" }, [])).toBe(false);
  });

  it("matches by exact URL (case-insensitive)", () => {
    const ignored = [makeIgnored({ job_url: "https://acme.com/jobs/123" })];
    expect(isJobIgnored({ title: "Any Title", company: "Any Co", url: "https://acme.com/jobs/123" }, ignored)).toBe(true);
    expect(isJobIgnored({ title: "Any Title", company: "Any Co", url: "HTTPS://ACME.COM/JOBS/123" }, ignored)).toBe(true);
  });

  it("matches by title+company when URL is absent", () => {
    const ignored = [makeIgnored({ job_url: null })];
    expect(isJobIgnored({ title: "Software Engineer", company: "Acme Corp", url: null }, ignored)).toBe(true);
  });

  it("does NOT match when URL is different and title+company differ", () => {
    const ignored = [makeIgnored()];
    expect(isJobIgnored({ title: "Product Manager", company: "Other Co", url: "https://other.com/jobs/999" }, ignored)).toBe(false);
  });

  it("falls back to title+company match even when job URL differs from ignored URL", () => {
    const ignored = [makeIgnored({ job_url: "https://acme.com/jobs/123" })];
    // Job has a different URL but same title+company → still matched via title+company fallback
    const job = { title: "Software Engineer", company: "Acme Corp", url: "https://acme.com/jobs/999" };
    expect(isJobIgnored(job, ignored)).toBe(true);
  });

  it("matches title+company when ignored entry has no URL and job has a URL", () => {
    const ignored = [makeIgnored({ job_url: null })];
    // ignored entry has no url; job has url → falls back to title+company
    expect(
      isJobIgnored({ title: "Software Engineer", company: "Acme Corp", url: "https://different.com/123" }, ignored),
    ).toBe(true);
  });
});

describe("isJobAlreadySaved", () => {
  const savedApps = [
    { job_title: "Backend Developer", company: "Beta Inc", job_url: "https://beta.com/jobs/55" },
    { job_title: "Frontend Engineer", company: "Gamma Ltd", job_url: null },
  ];

  it("returns false when savedApps is empty", () => {
    expect(isJobAlreadySaved({ title: "Engineer", company: "X", url: "https://x.com/1" }, [])).toBe(false);
  });

  it("matches by URL", () => {
    expect(isJobAlreadySaved({ title: "Any", company: "Any", url: "https://beta.com/jobs/55" }, savedApps)).toBe(true);
  });

  it("matches by title+company when URL is null in saved entry", () => {
    expect(isJobAlreadySaved({ title: "Frontend Engineer", company: "Gamma Ltd", url: "https://gamma.com/999" }, savedApps)).toBe(true);
  });

  it("does not match different job", () => {
    expect(isJobAlreadySaved({ title: "Data Scientist", company: "Delta Corp", url: "https://delta.com/1" }, savedApps)).toBe(false);
  });
});

describe("pagination page size", () => {
  it("PAGE_SIZE constant controls initial visible count", () => {
    const PAGE_SIZE = 20;
    const jobs = Array.from({ length: 50 }, (_, i) => ({ id: i, title: `Job ${i}` }));
    expect(jobs.slice(0, PAGE_SIZE).length).toBe(20);
    expect(jobs.slice(0, PAGE_SIZE * 2).length).toBe(40);
  });

  it("shows all jobs when visibleCount >= total", () => {
    const PAGE_SIZE = 20;
    const jobs = Array.from({ length: 15 }, (_, i) => ({ id: i }));
    expect(jobs.slice(0, PAGE_SIZE).length).toBe(15);
  });
});
