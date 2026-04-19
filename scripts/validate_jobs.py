"""
iCareerOS — Daily Job Validation Script
========================================
Runs once a day via GitHub Actions (.github/workflows/validate-jobs.yml).

What it does:
  1. Queries job_postings for rows that haven't been validated in >24h
     (or have never been validated: validated_at IS NULL)
  2. Runs the full three-layer validation pipeline:
       - Heuristics (scam keywords, missing fields, suspicious URLs)
       - Live URL check (HEAD request — confirms posting still exists)
       - AI check via Claude Haiku for borderline jobs (score 30-70)
  3. Updates is_flagged, flag_reasons, quality_score, validated_at, url_valid
  4. Logs a summary including how many jobs were newly flagged

Environment variables required:
  SUPABASE_URL              Supabase project URL
  SUPABASE_SERVICE_KEY      Supabase service-role key (bypasses RLS)
  ANTHROPIC_API_KEY         Optional; AI check is skipped if absent

Optional tuning:
  VALIDATE_BATCH_SIZE       Jobs per batch (default 50)
  VALIDATE_MAX_JOBS         Max jobs per run (default 500; safety cap)
  VALIDATE_STALE_HOURS      Re-validate if last check older than N hours (default 24)
  URL_CHECK_TIMEOUT_SECS    Seconds for HEAD request timeout (default 5)
  DISABLE_AI_CHECK          Set to "1" to skip AI layer entirely
"""

import os, sys, logging, time
from datetime import datetime, timezone, timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("icareeros-validator-daily")

# ── Deps ──────────────────────────────────────────────────────────────────────
try:
    from supabase import create_client
except ImportError:
    log.error("supabase not installed"); sys.exit(1)

try:
    from job_validator import validate_job
except ImportError:
    log.error("job_validator.py not found — is it in the scripts/ directory?"); sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL        = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required"); sys.exit(1)

BATCH_SIZE     = int(os.environ.get("VALIDATE_BATCH_SIZE",   "50"))
MAX_JOBS       = int(os.environ.get("VALIDATE_MAX_JOBS",     "500"))
STALE_HOURS    = int(os.environ.get("VALIDATE_STALE_HOURS",  "24"))
# Small delay between URL checks to avoid hammering job sites
URL_CHECK_DELAY = float(os.environ.get("URL_CHECK_DELAY_SECS", "0.5"))


def age_days(first_seen_at: str | None, scraped_at: str | None) -> int | None:
    """Return age in days from the earliest available timestamp."""
    raw = first_seen_at or scraped_at
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except Exception:
        return None


def run():
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    log.info("Connected to Supabase")

    stale_cutoff = (datetime.now(timezone.utc) - timedelta(hours=STALE_HOURS)).isoformat()

    # ── Fetch jobs that need validation ───────────────────────────────────────
    # Jobs where:
    #   a) validated_at IS NULL (never validated), OR
    #   b) validated_at < stale_cutoff (re-validate stale entries)
    # Only scraper-ingested rows (external_id IS NOT NULL).
    # Ordered oldest validation first so freshest jobs get checked sooner.
    try:
        result = (
            supabase.table("job_postings")
            .select("id,title,company,location,description,job_url,scraped_at,validated_at")
            .not_.is_("external_id", "null")
            .or_(f"validated_at.is.null,validated_at.lt.{stale_cutoff}")
            .order("validated_at", desc=False, nullsfirst=True)
            .limit(MAX_JOBS)
            .execute()
        )
        jobs = result.data or []
    except Exception as e:
        log.error(f"Failed to fetch jobs for validation: {e}"); sys.exit(1)

    if not jobs:
        log.info("No jobs need validation — all up to date"); return

    log.info(f"Validating {len(jobs)} job(s) (stale_hours={STALE_HOURS}, max={MAX_JOBS})")

    # ── Validate in batches ───────────────────────────────────────────────────
    total_flagged = total_unflagged = total_url_dead = total_errors = 0
    updates = []

    for i, job in enumerate(jobs):
        job_id   = job["id"]
        title    = job.get("title") or ""
        company  = job.get("company") or ""
        location = job.get("location") or ""
        desc     = job.get("description") or ""
        url      = job.get("job_url") or ""
        days     = age_days(job.get("scraped_at"), job.get("validated_at"))

        try:
            vr = validate_job(
                title=title,
                company=company,
                location=location,
                description=desc,
                job_url=url,
                job_age_days=days,
                skip_url_check=False,  # daily script runs the full URL check
            )

            if vr.url_valid is False:
                total_url_dead += 1
            if vr.is_flagged:
                total_flagged += 1
                log.info(f"  FLAGGED [{vr.quality_score:3d}] {title[:50]!r} @ {company!r} — {vr.flag_reasons}")
            else:
                total_unflagged += 1

            updates.append({
                "id":            job_id,
                "quality_score": vr.quality_score,
                "is_flagged":    vr.is_flagged,
                "flag_reasons":  vr.flag_reasons if vr.flag_reasons else None,
                "validated_at":  datetime.now(timezone.utc).isoformat(),
                "url_valid":     vr.url_valid,
            })

        except Exception as e:
            log.warning(f"  Validation error for job {job_id}: {e}")
            total_errors += 1

        # Small delay between URL checks
        if url:
            time.sleep(URL_CHECK_DELAY)

        # Flush batch to DB
        if len(updates) >= BATCH_SIZE:
            _flush(supabase, updates)
            updates = []

    # Flush remainder
    if updates:
        _flush(supabase, updates)

    log.info("=" * 60)
    log.info(
        f"Validation complete. "
        f"Flagged: {total_flagged} | "
        f"Clean: {total_unflagged} | "
        f"Dead URLs: {total_url_dead} | "
        f"Errors: {total_errors}"
    )


def _flush(supabase, updates: list[dict]):
    """Write a batch of validation updates back to job_postings."""
    if not updates:
        return
    try:
        supabase.table("job_postings").upsert(updates, on_conflict="id").execute()
        log.info(f"  Flushed {len(updates)} validation update(s)")
    except Exception as e:
        log.error(f"  Batch flush failed: {e}")


if __name__ == "__main__":
    run()
