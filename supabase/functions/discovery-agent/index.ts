// discovery-agent/index.ts
// Scheduled edge function: scrapes RemoteOK, Greenhouse, Lever
// and writes directly to job_postings (feeds into discovered_jobs via pg_cron bridge).
// Called every 4 hours by GitHub Actions workflow.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { remoteOkAdapter }    from '../_shared/discovery/adapters/remoteok.ts';
import { greenhouseAdapter }  from '../_shared/discovery/adapters/greenhouse.ts';
import { leverAdapter }       from '../_shared/discovery/adapters/lever.ts';
import { adzunaAdapter }      from '../_shared/discovery/adapters/adzuna.ts';
import { usaJobsAdapter }     from '../_shared/discovery/adapters/usajobs.ts';
import { computeDedupeHash }  from '../_shared/discovery/helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Title quality filter ───────────────────────────────────────────────────────
// Rejects resume blobs and other noise from job_seeker_profiles.target_titles.
function isCleanTitle(title: string): boolean {
  const t = (title ?? '').trim();
  if (!t || t.length < 3 || t.length > 70) return false;
  if (t.split(/\s+/).length > 7)            return false;  // > 7 words = resume fragment
  if (/\d{4}/.test(t))                      return false;  // has year (e.g. "Manager 2002-2003")
  if (/\bOR\b/.test(t))                     return false;  // boolean OR = raw query, not a title
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Service-role only — this function runs server-side, never from the browser.
  // Validates the JWT payload rather than comparing against an env var to avoid
  // mismatches between the Supabase-injected key and the caller's key.
  const auth  = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  let isAuthorized = false;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      isAuthorized = payload.role === 'service_role' &&
                     payload.ref  === 'bryoehuhhhjqcueomgev';
    }
  } catch { /* invalid JWT — isAuthorized stays false */ }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Use the passed service-role token for the Supabase client so it works
  // regardless of whether SUPABASE_SERVICE_ROLE_KEY is injected correctly.
  const serviceKey = token;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceKey,
  );

  // ── Feature flags ────────────────────────────────────────────────────────────
  const { data: flagRows } = await supabase
    .from('feature_flags')
    .select('key, enabled')
    .in('key', [
      'discovery_board_remoteok',
      'discovery_board_greenhouse',
      'discovery_board_lever',
      'discovery_board_adzuna',
      'discovery_board_usajobs',
    ]);

  const flags: Record<string, boolean> = {};
  for (const f of flagRows ?? []) flags[f.key] = f.enabled;

  // ── Search terms from active user preferences ────────────────────────────────
  const { data: prefs } = await supabase
    .from('user_search_preferences')
    .select('target_titles')
    .eq('alerts_enabled', true)
    .limit(100);

  const termSet = new Set<string>();
  for (const p of prefs ?? []) {
    for (const t of p.target_titles ?? []) {
      if (isCleanTitle(t)) termSet.add(t.trim());
      if (termSet.size >= 5) break;  // cap to avoid WORKER_RESOURCE_LIMIT
    }
    if (termSet.size >= 5) break;
  }

  // Fallback terms so the agent is useful before any user preferences exist.
  if (termSet.size === 0) {
    for (const t of [
      'software engineer', 'product manager', 'data scientist',
    ]) termSet.add(t);
  }
  const terms = [...termSet];

  // ── Adapter registry ─────────────────────────────────────────────────────────
  const adapters = [
    ...(flags['discovery_board_remoteok']   ? [remoteOkAdapter]   : []),
    ...(flags['discovery_board_adzuna']     ? [adzunaAdapter]     : []),
    ...(flags['discovery_board_usajobs']    ? [usaJobsAdapter]    : []),
    ...(flags['discovery_board_greenhouse'] ? [greenhouseAdapter] : []),
    ...(flags['discovery_board_lever']      ? [leverAdapter]      : []),
  ];

  let totalInserted = 0;
  let totalDupes    = 0;
  let totalErrors   = 0;
  const runLog: Record<string, unknown>[] = [];

  // ── Per-adapter loop ─────────────────────────────────────────────────────────
  for (const adapter of adapters) {
    const startedAt = new Date().toISOString();
    let found = 0, inserted = 0, dupes = 0;

    try {
      for (const term of terms) {
        const result = await adapter.search({
          search_term:    term,
          results_wanted: 30,
          is_remote:      true,
        });
        found += result.jobs.length;

        for (const job of result.jobs) {
          const externalId = `${job.source_board}::${job.external_id}`;

          const row = {
            external_id:     externalId,
            title:           job.title,
            company:         job.company,
            location:        job.location,
            is_remote:       job.remote_type === 'remote',
            job_type:        job.employment_type,
            salary_min:      job.salary_min,
            salary_max:      job.salary_max,
            salary_currency: job.salary_currency ?? 'USD',
            description:     job.description,
            job_url:         job.source_url,
            source:          job.source_board,
            date_posted:     job.posted_at,
            scraped_at:      new Date().toISOString(),
            quality_score:   50,
            is_flagged:      false,
          };

          const { error } = await supabase
            .from('job_postings')
            .upsert(row, { onConflict: 'external_id', ignoreDuplicates: true });

          if (error) { dupes++; }
          else        { inserted++; }
        }
      }

      await supabase.from('scraper_runs').insert({
        source_board:            adapter.board_id,
        search_term:             terms.join(', ').slice(0, 250),
        started_at:              startedAt,
        finished_at:             new Date().toISOString(),
        status:                  'success',
        jobs_found:              found,
        jobs_inserted:           inserted,
        jobs_skipped_duplicate:  dupes,
      });

      totalInserted += inserted;
      totalDupes    += dupes;
      runLog.push({ adapter: adapter.board_id, found, inserted, dupes });

    } catch (err) {
      totalErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[discovery-agent] ${adapter.board_id} error:`, msg);

      await supabase.from('scraper_runs').insert({
        source_board:  adapter.board_id,
        started_at:    startedAt,
        finished_at:   new Date().toISOString(),
        status:        'failed',
        error_message: msg,
      });

      runLog.push({ adapter: adapter.board_id, error: msg });
    }
  }

  return new Response(
    JSON.stringify({
      success:        totalErrors < adapters.length,
      adapters_run:   adapters.map((a) => a.board_id),
      search_terms:   terms,
      total_inserted: totalInserted,
      total_dupes:    totalDupes,
      total_errors:   totalErrors,
      run_log:        runLog,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

