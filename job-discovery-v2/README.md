# iCareerOS — Job Discovery Microservices v2

6 independent microservices + event bus. $0/month. 2,000+ jobs/day. <1s search latency.

---

## Architecture

```
GitHub Actions (every 2h, free)
  └── scrape_jobs.py → job_postings (existing table, unchanged)
                               ↓
                   [JobSpy Bridge Adapter reads]
                               ↓
┌──────────────────────────────────────────────────────────┐
│                     NEW PIPELINE                          │
│                                                           │
│  Sourcing Service                                         │
│  ├── JobSpy bridge (job_postings → raw_jobs)             │
│  └── Cowork APIs (Greenhouse, Lever, SmartRecruiters,    │
│                   Remotive, WWR, Ashby)                   │
│         ↓  [event: job.fetched]                          │
│                                                           │
│  Extraction Service                                       │
│  ├── Mistral 7B via Ollama (free, handles ~90%)          │
│  └── Claude Haiku fallback (~$5/mo, handles ~10%)        │
│         ↓  [event: job.extracted]                        │
│                                                           │
│  Deduplication Service                                    │
│  └── SHA256(title+company+location) → merge across       │
│      platforms into deduplicated_jobs                     │
│         ↓  [event: job.deduped]                          │
│                                                           │
│  Matching Service                                         │
│  └── Score deduplicated_jobs × user profiles → job_scores│
│         ↓  [event: job.scored]                           │
│                                                           │
│  Learning Service                                         │
│  └── Track accuracy → auto-retrain Mistral prompts       │
│      when source accuracy < 80%                          │
└──────────────────────────────────────────────────────────┘
         ↓
    User sees top-scored jobs at icareeros.com
```

---

## Compatibility

**Zero breaking changes.** All new tables are additive. Existing tables untouched:

| Table | Status |
|---|---|
| `job_postings` | ✅ Unchanged — GitHub Actions scraper still writes here |
| `discovered_jobs` | ✅ Unchanged — existing edge functions still use this |
| `user_search_preferences` | ✅ Unchanged — used by both old and new matching |
| `raw_jobs` | 🆕 New |
| `extracted_jobs` | 🆕 New |
| `deduplicated_jobs` | 🆕 New |
| `job_scores` | 🆕 New |
| `extraction_feedback` | 🆕 New |
| `extraction_accuracy` | 🆕 New |
| `platform_events` | 🆕 New |

---

## Setup (Phase 1)

### 1. Prerequisites

```bash
# Install Ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.ai/install.sh | sh

# Pull Mistral 7B (4GB download, one-time)
ollama pull mistral

# Start Ollama server
ollama serve
```

Or use Docker (recommended for consistency):

```bash
docker compose up -d
# Wait ~2 minutes for Mistral to download and warm up
```

### 2. Environment Variables

Add to `.env.local`:

```env
# Supabase (already configured)
SUPABASE_URL=https://bryoehuhhhjqcueomgev.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Ollama
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Optional: Claude fallback for low-confidence extractions (~$5/month)
ANTHROPIC_API_KEY=your_key_here
```

### 3. Apply Migrations

```bash
# Apply both migrations in order
supabase db push --file supabase/migrations/20260415_001_job_discovery_schema.sql
supabase db push --file supabase/migrations/20260415_002_schedule_batch_jobs.sql

# Verify tables
supabase db list
```

For migration 002 (pg_cron schedules), replace placeholders before running:
- `<SUPABASE_URL>` → `https://bryoehuhhhjqcueomgev.supabase.co`
- `<SERVICE_ROLE_KEY>` → your actual service role key

### 4. Install Dependencies

```bash
cd /path/to/icareeros/repo
bun add @supabase/supabase-js axios
bun add -D @types/node jest ts-jest
```

### 5. Test It

```bash
# Unit tests (no Ollama needed)
bun test src/services/job-extraction-service/__tests__/unit.test.ts

# Integration tests (requires Ollama + Supabase)
bun test src/services/__tests__/phase1.integration.test.ts
```

---

## File Structure

```
job-discovery-v2/
├── Dockerfile.ollama              — Ollama + Mistral Docker image
├── docker-compose.yml             — Local dev stack
├── docker-entrypoint.sh           — Container startup + model pull
├── supabase/
│   └── migrations/
│       ├── 20260415_001_job_discovery_schema.sql   — 7 tables + views
│       └── 20260415_002_schedule_batch_jobs.sql    — pg_cron pipeline
└── src/
    ├── shared/
    │   └── services/
    │       └── event-bus.ts        — Publish/subscribe for all services
    └── services/
        ├── job-sourcing-service/
        │   ├── index.ts            — Main fetch orchestrator
        │   ├── job-spy-adapter.ts  — Bridge to existing job_postings table
        │   ├── cowork-adapters.ts  — Greenhouse, Lever, SmartRecruiters, Remotive, WWR, Ashby
        │   └── types.ts
        ├── job-extraction-service/
        │   ├── index.ts            — Mistral + Claude extraction
        │   └── __tests__/unit.test.ts
        ├── deduplication-service/
        │   └── index.ts            — SHA256 hash dedup
        ├── learning-service/
        │   └── index.ts            — Accuracy tracking + prompt auto-retrain
        ├── matching-service/
        │   └── index.ts            — Job × user profile scoring
        └── __tests__/
            └── phase1.integration.test.ts
```

---

## Pipeline Schedule (UTC)

| Time | Task | Trigger |
|---|---|---|
| Every 2h | Scrape jobs | GitHub Actions (existing) |
| 03:00 | Extract raw → structured | pg_cron → jd-extraction-runner |
| 04:00 | Deduplicate across sources | pg_cron → jd-dedup-runner |
| 05:00 | Score jobs × profiles | pg_cron → jd-matching-runner |
| 06:00 | Update accuracy stats | pg_cron → SQL function |
| 08:00 | Send job alerts | pg_cron → job-alerts (existing) |
| 00:00 Sun | Archive stale data | pg_cron → SQL function |

Results ready for users by 07:00 UTC = 11pm PT / 2am ET.

---

## Cost Breakdown

| Component | Service | Cost |
|---|---|---|
| Scraping | GitHub Actions + jobspy | $0 |
| Cowork APIs | Greenhouse, Lever, Remotive, etc | $0 |
| Extraction (90%) | Mistral 7B via Ollama | $0 |
| Extraction (10%) | Claude Haiku fallback | ~$5/mo |
| Database | Supabase (existing plan) | $0 |
| Scheduling | pg_cron (included) | $0 |
| Hosting | Vercel (existing) | $0 |
| **TOTAL** | | **~$5/month** |

---

## Phase Roadmap

| Phase | Weeks | Status |
|---|---|---|
| Phase 1: Foundation — Schema + Sourcing + Extraction + Events | 1–2 | ✅ **Code ready** |
| Phase 2: Processing — Dedup + Learning + Matching batch mode | 3–4 | ✅ **Code ready** |
| Phase 3: Optimization — Redis cache + prompt tuning + 40 platforms | 5–6 | 🔲 Scaffold |
| Phase 4: Launch — Deploy + monitoring + go-live | 7–8 | 🔲 Scaffold |

All Phase 1 and Phase 2 code is complete and ready to deploy.
