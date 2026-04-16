#!/usr/bin/env bun
// =============================================================================
// iCareerOS — Job Ingestion Runner
// Thin CLI wrapper around JobIngestionService for local development & testing.
//
// Usage:
//   bun run scripts/run-ingestion.ts                      # All tiers
//   bun run scripts/run-ingestion.ts --tier=1             # Tier 1 only
//   bun run scripts/run-ingestion.ts --tier=2 --dry-run   # Tier 2, no DB writes
//   INGESTION_TIER=3 bun run scripts/run-ingestion.ts     # Via env var
//
// Required env vars:
//   SUPABASE_URL or VITE_SUPABASE_URL
//   SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY
//
// Optional env vars (Tier 2 only):
//   ADZUNA_APP_ID, ADZUNA_APP_KEY — from developer.adzuna.com (free)
//   JOOBLE_API_KEY                — from jooble.org/api (free)
//
// In GitHub Actions, this script is NOT used — the workflow calls
// src/services/job-ingestion/index.ts directly.
// =============================================================================

import { JobIngestionService } from '../src/services/job-ingestion/index'

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let tier: string = process.env.INGESTION_TIER ?? 'all'
  let dry_run: boolean = process.env.DRY_RUN?.toLowerCase() === 'true'

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      tier = arg.replace('--tier=', '').trim()
    } else if (arg === '--dry-run' || arg === '--dry_run') {
      dry_run = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return { tier, dry_run }
}

function printHelp() {
  console.log(`
iCareerOS Job Ingestion Runner

Usage:
  bun run scripts/run-ingestion.ts [options]

Options:
  --tier=<1|2|3|4|5|all>   Run specific tier (default: all)
  --dry-run                 Log only, do not write to database
  --help, -h                Show this help

Tiers:
  1  ATS APIs:     Greenhouse, Lever, Ashby
  2  Aggregators:  Adzuna, Jooble  (requires API keys)
  3  Remote APIs:  Himalayas, RemoteOK, Remotive, Jobicy, Arbeitnow
  4  RSS feeds:    WeWorkRemotely
  5  JSON-LD:      Career pages (Stripe, Shopify, Cloudflare, etc.)

Environment Variables:
  SUPABASE_URL or VITE_SUPABASE_URL         — required
  SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY — required
  ADZUNA_APP_ID, ADZUNA_APP_KEY             — required for tier 2
  JOOBLE_API_KEY                            — required for tier 2
  INGESTION_TIER                            — alternative to --tier flag
  DRY_RUN                                   — alternative to --dry-run flag
`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { tier, dry_run } = parseArgs()

  // Map string tier → typed option
  const tierMap: Record<string, 1 | 2 | 3 | 4 | 5 | 'all'> = {
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, 'all': 'all',
  }
  const typedTier = tierMap[tier]
  if (!typedTier) {
    console.error(`[Ingestion] Invalid tier: "${tier}". Must be 1, 2, 3, 4, 5, or all.`)
    process.exit(1)
  }

  // Warn if Tier 2 keys are missing
  if ((typedTier === 2 || typedTier === 'all') && !dry_run) {
    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
      console.warn('[Ingestion] ⚠️  ADZUNA_APP_ID / ADZUNA_APP_KEY not set — Adzuna will be skipped')
    }
    if (!process.env.JOOBLE_API_KEY) {
      console.warn('[Ingestion] ⚠️  JOOBLE_API_KEY not set — Jooble will be skipped')
    }
  }

  const start = Date.now()
  console.log(`[Ingestion] Starting — tier: ${typedTier}, dry_run: ${dry_run}`)
  console.log(`[Ingestion] ${new Date().toISOString()}`)

  try {
    const service = new JobIngestionService()
    await service.run({ tier: typedTier, dry_run })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[Ingestion] ✅ Completed in ${elapsed}s`)
    process.exit(0)
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.error(`[Ingestion] ❌ Failed after ${elapsed}s:`, (err as Error).message)
    process.exit(1)
  }
}

main()
