// USAJobs.gov adapter (stub — requires API key from USAJOBS_API_KEY env var)
// Full docs: https://developer.usajobs.gov/
// Enable by setting feature flag discovery_board_usajobs = true
// and setting env var USAJOBS_API_KEY + USAJOBS_USER_AGENT in Supabase secrets.

import {
  BoardAdapter,
  SearchParams,
  AdapterResult,
  NormalisedJob,
} from "../types.ts";
import {
  politeFetch,
  htmlToText,
  parseSalary,
  matchesSearch,
} from "../helpers.ts";

interface USAJobsResult {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionTitle: string;
    OrganizationName: string;
    PositionLocationDisplay?: string;
    PositionRemuneration?: {
      MinimumRange: string;
      MaximumRange: string;
      RateIntervalCode: string;
    }[];
    UserArea?: { Details?: { JobSummary?: string } };
    PositionURI: string;
    ApplicationCloseDate?: string;
    PublicationStartDate?: string;
    PositionSchedule?: { Name?: string }[];
  };
}

export const usaJobsAdapter: BoardAdapter = {
  board_id: "usajobs",

  async search(params: SearchParams): Promise<AdapterResult> {
    const apiKey = Deno.env.get("USAJOBS_API_KEY");
    const userAgent = Deno.env.get("USAJOBS_USER_AGENT");

    if (!apiKey || !userAgent) {
      console.warn(
        "[usajobs] USAJOBS_API_KEY or USAJOBS_USER_AGENT not set — skipping",
      );
      return { jobs: [], http_status: 0, fetched_at: new Date().toISOString() };
    }

    const q = new URLSearchParams({
      Keyword: params.search_term,
      ResultsPerPage: String(params.results_wanted ?? 25),
    });
    if (params.location) q.set("LocationName", params.location);
    // RemoteIndicator is intentionally NOT set: federal government jobs are
    // rarely classified as remote, so the filter returns 0 results in practice.
    // is_remote is inferred from location text in the normalised job instead.

    const url = `https://data.usajobs.gov/api/search?${q}`;
    const res = await politeFetch(url, {
      headers: { "Authorization-Key": apiKey, "User-Agent": userAgent },
    });

    if (!res.ok)
      return {
        jobs: [],
        http_status: res.status,
        fetched_at: new Date().toISOString(),
      };

    const payload = (await res.json()) as {
      SearchResult: { SearchResultItems: USAJobsResult[] };
    };
    const items = payload?.SearchResult?.SearchResultItems ?? [];
    const jobs: NormalisedJob[] = [];

    for (const item of items) {
      const d = item.MatchedObjectDescriptor;
      const desc = d.UserArea?.Details?.JobSummary ?? null;
      // Skip matchesSearch — the USAJobs API's Keyword parameter already filters;
      // re-filtering against commercial job titles (e.g. "software engineer")
      // removes valid federal listings that use different title conventions.

      const rem = d.PositionRemuneration?.[0];
      const salMin = rem ? Number(rem.MinimumRange) || null : null;
      const salMax = rem ? Number(rem.MaximumRange) || null : null;
      const isAnnual = rem?.RateIntervalCode === "PA";

      const locationText = (d.PositionLocationDisplay ?? "").toLowerCase();
      const isRemote =
        locationText.includes("remote") || locationText.includes("anywhere");

      jobs.push({
        source_board: "usajobs",
        source_url: d.PositionURI,
        external_id: item.MatchedObjectId,
        title: d.PositionTitle,
        company: d.OrganizationName,
        location: d.PositionLocationDisplay ?? null,
        remote_type: isRemote ? "remote" : null,
        employment_type: d.PositionSchedule?.[0]?.Name?.toLowerCase().includes(
          "full",
        )
          ? "full_time"
          : null,
        salary_min: isAnnual ? salMin : null,
        salary_max: isAnnual ? salMax : null,
        salary_currency: "USD",
        description: desc,
        description_html: null,
        posted_at: d.PublicationStartDate ?? null,
        raw_payload: d as unknown as Record<string, unknown>,
      });
    }

    return {
      jobs,
      http_status: res.status,
      fetched_at: new Date().toISOString(),
    };
  },
};
