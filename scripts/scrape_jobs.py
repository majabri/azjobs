"""
iCareerOS v5 — Native Job Scraper
Runs every 2 hours via GitHub Actions (free compute, $0 cost).
Reads top search terms from search_queries table to stay aligned with what users actually want.

Improvements over v4:
- country_indeed is derived from config location (not hardcoded "USA")
- Cross-site deduplication: same job appearing on Indeed + Google is counted once (content hash)
- Run-level caching: skips configs whose search term+location already has fresh data in the DB
- All tuning knobs (sites, results count, age window, cache TTL) are env-var configurable
- Column mapping is explicit and documented; no raw JobSpy columns reach the DB
"""
import os, sys, re, time, hashlib, logging
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("icareeros-scraper")

try:
    from jobspy import scrape_jobs
except ImportError:
    log.error("python-jobspy not installed"); sys.exit(1)
try:
    from supabase import create_client
except ImportError:
    log.error("supabase not installed"); sys.exit(1)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required"); sys.exit(1)

# ── Tuning knobs (all overridable via environment variables) ──────────────────
SITES             = [s.strip() for s in os.environ.get("SCRAPER_SITES", "indeed,google,zip_recruiter").split(",")]
RESULTS_PER_SEARCH = int(os.environ.get("RESULTS_PER_SEARCH", "30"))
HOURS_OLD         = int(os.environ.get("HOURS_OLD", "48"))
# Skip a (term, location) config if we already have jobs scraped within this many hours.
# Set to 0 to disable caching and always re-scrape (useful for manual test runs).
CACHE_HOURS       = int(os.environ.get("SCRAPER_CACHE_HOURS", "4"))
# Seconds to sleep between scrape calls — avoids hammering upstream job sites.
SCRAPE_DELAY_SECS = float(os.environ.get("SCRAPE_DELAY_SECS", "2"))

# ── country_indeed mapping ────────────────────────────────────────────────────
# Maps location strings → JobSpy country_indeed parameter.
# JobSpy uses "USA", "Canada", "UK", "Australia", etc.
_COUNTRY_MAP = {
    "united states": "USA",
    "usa":           "USA",
    "us":            "USA",
    "canada":        "Canada",
    "united kingdom":"UK",
    "uk":            "UK",
    "australia":     "Australia",
    "germany":       "Germany",
    "france":        "France",
    "india":         "India",
    "netherlands":   "Netherlands",
    "singapore":     "Singapore",
}
_US_STATE_ABBRS = {
    "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in",
    "ia","ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv",
    "nh","nj","nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn",
    "tx","ut","vt","va","wa","wv","wi","wy","dc",
}

def location_to_country(location: str) -> str:
    """Return the country_indeed value for a given location string."""
    loc = location.lower().strip()
    # Exact / prefix match against known countries
    for key, country in _COUNTRY_MAP.items():
        if loc == key or loc.startswith(key):
            return country
    # US city/state pattern: ends with ", XX" where XX is a 2-letter state
    m = re.search(r",\s*([a-z]{2})$", loc)
    if m and m.group(1) in _US_STATE_ABBRS:
        return "USA"
    # Default to USA (all baseline configs are US-focused)
    return "USA"

# ── Baseline searches ─────────────────────────────────────────────────────────
BASELINE_CONFIGS = [
    # ── Software Engineering ──────────────────────────────────────────────────
    {"term": "software engineer",          "location": "United States", "is_remote": True},
    {"term": "software engineer",          "location": "San Francisco, CA"},
    {"term": "software engineer",          "location": "New York, NY"},
    {"term": "frontend developer",         "location": "United States", "is_remote": True},
    {"term": "backend developer",          "location": "United States", "is_remote": True},
    {"term": "full stack developer",       "location": "United States", "is_remote": True},
    {"term": "devops engineer",            "location": "United States", "is_remote": True},
    {"term": "cloud architect",            "location": "United States", "is_remote": True},
    {"term": "site reliability engineer",  "location": "United States", "is_remote": True},
    {"term": "junior software engineer",   "location": "United States", "is_remote": True},
    {"term": "software engineer intern",   "location": "United States"},

    # ── Cybersecurity ─────────────────────────────────────────────────────────
    {"term": "CISO",                             "location": "United States", "is_remote": True},
    {"term": "VP of Cybersecurity",              "location": "United States", "is_remote": True},
    {"term": "VP of Information Security",       "location": "United States", "is_remote": True},
    {"term": "Director of Cybersecurity",        "location": "United States", "is_remote": True},
    {"term": "Director of Information Security", "location": "United States", "is_remote": True},
    {"term": "cybersecurity manager",            "location": "United States", "is_remote": True},
    {"term": "information security manager",     "location": "United States", "is_remote": True},
    {"term": "cybersecurity engineer",           "location": "United States", "is_remote": True},
    {"term": "security architect",               "location": "United States", "is_remote": True},
    {"term": "cloud security engineer",          "location": "United States", "is_remote": True},
    {"term": "penetration tester",               "location": "United States", "is_remote": True},
    {"term": "security analyst",                 "location": "United States", "is_remote": True},

    # ── Product & Design ──────────────────────────────────────────────────────
    {"term": "product manager",            "location": "United States", "is_remote": True},
    {"term": "product manager",            "location": "San Francisco, CA"},
    {"term": "UX designer",                "location": "United States", "is_remote": True},

    # ── Data & AI ─────────────────────────────────────────────────────────────
    {"term": "data scientist",             "location": "United States", "is_remote": True},
    {"term": "data engineer",              "location": "United States", "is_remote": True},
    {"term": "machine learning engineer",  "location": "United States", "is_remote": True},
    {"term": "AI engineer",                "location": "United States", "is_remote": True},

    # ── Leadership & Management ───────────────────────────────────────────────
    {"term": "engineering manager",        "location": "United States", "is_remote": True},
    {"term": "VP of Engineering",          "location": "United States", "is_remote": True},
    {"term": "CTO",                        "location": "United States", "is_remote": True},

    # ── Finance & Accounting ──────────────────────────────────────────────────
    {"term": "financial analyst",          "location": "New York, NY"},
    {"term": "financial analyst",          "location": "United States", "is_remote": True},
    {"term": "business analyst",           "location": "United States", "is_remote": True},
    {"term": "CFO",                        "location": "United States", "is_remote": True},
    {"term": "VP of Finance",              "location": "United States", "is_remote": True},
    {"term": "Director of Finance",        "location": "United States", "is_remote": True},
    {"term": "controller",                 "location": "United States", "is_remote": True},
    {"term": "accountant",                 "location": "United States", "is_remote": True},
    {"term": "senior accountant",          "location": "United States", "is_remote": True},
    {"term": "FP&A analyst",               "location": "United States", "is_remote": True},
    {"term": "investment analyst",         "location": "New York, NY"},

    # ── Human Resources & Recruiting ─────────────────────────────────────────
    {"term": "HR manager",                 "location": "United States", "is_remote": True},
    {"term": "HR business partner",        "location": "United States", "is_remote": True},
    {"term": "recruiter",                  "location": "United States", "is_remote": True},
    {"term": "technical recruiter",        "location": "United States", "is_remote": True},
    {"term": "talent acquisition manager", "location": "United States", "is_remote": True},
    {"term": "Chief People Officer",       "location": "United States", "is_remote": True},
    {"term": "VP of People",               "location": "United States", "is_remote": True},
    {"term": "Director of HR",             "location": "United States", "is_remote": True},
    {"term": "people operations manager",  "location": "United States", "is_remote": True},

    # ── Marketing & Growth ────────────────────────────────────────────────────
    {"term": "marketing manager",          "location": "United States", "is_remote": True},
    {"term": "digital marketing manager",  "location": "United States", "is_remote": True},
    {"term": "content marketing manager",  "location": "United States", "is_remote": True},
    {"term": "growth marketing manager",   "location": "United States", "is_remote": True},
    {"term": "SEO specialist",             "location": "United States", "is_remote": True},
    {"term": "CMO",                        "location": "United States", "is_remote": True},
    {"term": "VP of Marketing",            "location": "United States", "is_remote": True},
    {"term": "Director of Marketing",      "location": "United States", "is_remote": True},
    {"term": "brand manager",              "location": "United States", "is_remote": True},
    {"term": "social media manager",       "location": "United States", "is_remote": True},

    # ── Sales & Business Development ─────────────────────────────────────────
    {"term": "sales manager",              "location": "United States", "is_remote": True},
    {"term": "account executive",          "location": "United States", "is_remote": True},
    {"term": "account manager",            "location": "United States", "is_remote": True},
    {"term": "VP of Sales",                "location": "United States", "is_remote": True},
    {"term": "Director of Sales",          "location": "United States", "is_remote": True},
    {"term": "business development manager", "location": "United States", "is_remote": True},
    {"term": "sales development representative", "location": "United States", "is_remote": True},
    {"term": "enterprise account executive", "location": "United States", "is_remote": True},

    # ── Legal & Compliance ────────────────────────────────────────────────────
    {"term": "compliance manager",         "location": "United States", "is_remote": True},
    {"term": "compliance officer",         "location": "United States", "is_remote": True},
    {"term": "general counsel",            "location": "United States", "is_remote": True},
    {"term": "corporate attorney",         "location": "New York, NY"},
    {"term": "legal counsel",              "location": "United States", "is_remote": True},
    {"term": "privacy counsel",            "location": "United States", "is_remote": True},
    {"term": "Chief Compliance Officer",   "location": "United States", "is_remote": True},

    # ── Operations & Supply Chain ─────────────────────────────────────────────
    {"term": "operations manager",         "location": "United States", "is_remote": True},
    {"term": "COO",                        "location": "United States", "is_remote": True},
    {"term": "VP of Operations",           "location": "United States", "is_remote": True},
    {"term": "Director of Operations",     "location": "United States", "is_remote": True},
    {"term": "supply chain manager",       "location": "United States", "is_remote": True},
    {"term": "logistics manager",          "location": "United States", "is_remote": True},
    {"term": "project manager",            "location": "United States", "is_remote": True},
    {"term": "program manager",            "location": "United States", "is_remote": True},
    {"term": "scrum master",               "location": "United States", "is_remote": True},

    # ── Healthcare ────────────────────────────────────────────────────────────
    {"term": "registered nurse",           "location": "United States"},
    {"term": "nurse practitioner",         "location": "United States"},
    {"term": "physician assistant",        "location": "United States"},
    {"term": "healthcare administrator",   "location": "United States"},
    {"term": "medical director",           "location": "United States"},
    {"term": "clinical manager",           "location": "United States"},
    {"term": "health informatics",         "location": "United States", "is_remote": True},

    # ── Customer Success & Support ────────────────────────────────────────────
    {"term": "customer success manager",   "location": "United States", "is_remote": True},
    {"term": "VP of Customer Success",     "location": "United States", "is_remote": True},
    {"term": "Director of Customer Success", "location": "United States", "is_remote": True},
    {"term": "customer support manager",   "location": "United States", "is_remote": True},

    # ── Education & Training ──────────────────────────────────────────────────
    {"term": "instructional designer",     "location": "United States", "is_remote": True},
    {"term": "learning and development manager", "location": "United States", "is_remote": True},
    {"term": "training manager",           "location": "United States", "is_remote": True},
    {"term": "curriculum developer",       "location": "United States", "is_remote": True},
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def make_url_id(url: str) -> str:
    """SHA-256 of the job URL — primary dedup key across runs."""
    return hashlib.sha256(url.encode()).hexdigest()[:32]

def make_content_hash(title: str, company: str) -> str:
    """
    Content-based hash of (normalized title, normalized company).
    Used for cross-site deduplication within a single run: the same posting
    often appears on Indeed AND Google with different URLs.
    """
    t = re.sub(r"\s+", " ", (title or "").lower().strip())
    c = re.sub(r"\s+", " ", (company or "").lower().strip())
    # Strip legal suffixes that vary by site: "Inc.", "LLC", "Corp.", "Ltd.", "Co."
    c = re.sub(r"\b(inc|llc|corp|ltd|co)\b\.?", "", c).strip(" ,.")
    return hashlib.sha256(f"{t}|{c}".encode()).hexdigest()[:24]

def safe_int(v):
    try: return int(v) if v and str(v).strip() not in ("", "nan", "None") else None
    except: return None

def safe_str(v):
    if v is None: return None
    s = str(v).strip()
    return s if s and s.lower() not in ("nan", "none", "") else None

def safe_bool(v):
    if isinstance(v, bool): return v
    if isinstance(v, str): return v.lower() in ("true", "1", "yes")
    return bool(v)

def norm_type(raw):
    if not raw: return None
    m = {
        "fulltime":    "fulltime", "full-time":  "fulltime", "full_time": "fulltime",
        "parttime":    "parttime", "part-time":  "parttime", "part_time": "parttime",
        "contract":    "contract", "contractor": "contract",
        "internship":  "internship", "intern":   "internship",
        "temporary":   "contract", "temp":       "contract",
    }
    return m.get(str(raw).lower().replace(" ", ""), None)

# ── Dynamic config builder ────────────────────────────────────────────────────

def get_dynamic_configs(supabase):
    """
    Build dynamic search configs from two sources:
    1. Top user search queries from the last 7 days (search_queries table)
    2. Target job titles from all active user profiles (job_seeker_profiles table)
    Both are deduplicated against BASELINE_CONFIGS.
    """
    dynamic = []
    existing_terms = {(c["term"].lower(), c["location"]) for c in BASELINE_CONFIGS}

    # ── Source 1: recent user search queries ─────────────────────────────────
    try:
        result = supabase.rpc("get_top_search_terms", {"limit_count": 10}).execute()
        if result.data:
            for row in result.data:
                term = (row.get("search_term") or "").strip()
                loc  = (row.get("location") or "United States").strip() or "United States"
                if term and (term.lower(), loc) not in existing_terms:
                    dynamic.append({"term": term, "location": loc, "is_remote": True})
                    existing_terms.add((term.lower(), loc))
    except Exception as e:
        log.warning(f"Could not fetch dynamic search terms: {e}")

    # ── Source 2: target job titles from user profiles ────────────────────────
    try:
        result = (supabase.table("job_seeker_profiles")
                  .select("target_job_titles, location")
                  .execute())
        if result.data:
            for profile in result.data:
                titles = profile.get("target_job_titles") or []
                loc    = (profile.get("location") or "United States").strip()
                if not loc or loc in ("<UNKNOWN>", "unknown") or len(loc) < 2:
                    loc = "United States"
                for title in titles:
                    title = (title or "").strip()
                    if not title or len(title) < 3:
                        continue
                    if (title.lower(), "United States") not in existing_terms:
                        dynamic.append({"term": title, "location": "United States", "is_remote": True})
                        existing_terms.add((title.lower(), "United States"))
                    if loc != "United States" and (title.lower(), loc) not in existing_terms:
                        dynamic.append({"term": title, "location": loc})
                        existing_terms.add((title.lower(), loc))
    except Exception as e:
        log.warning(f"Could not fetch profile target titles: {e}")

    return dynamic

# ── Run-level cache: skip configs with fresh data already in the DB ───────────

def build_fresh_config_set(supabase) -> set:
    """
    Returns a set of (term_lower, location_lower) tuples that already have
    fresh data in job_postings (scraped within CACHE_HOURS hours).
    Configs in this set are skipped to avoid hammering upstream job sites.
    Disabled when CACHE_HOURS == 0.
    """
    if CACHE_HOURS <= 0:
        return set()
    try:
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=CACHE_HOURS)).isoformat()
        result = (supabase.table("job_postings")
                  .select("source")
                  .gte("scraped_at", cutoff)
                  .limit(1)
                  .execute())
        # If ANY jobs were scraped within CACHE_HOURS, the last run is fresh.
        # We use a coarser heuristic: track freshness at run level, not per-term.
        # If the DB has recent jobs (> 50 rows in last CACHE_HOURS), mark all
        # baseline configs as fresh; only run dynamic ones (user-specific).
        count_result = (supabase.table("job_postings")
                        .select("id", count="exact")
                        .gte("scraped_at", cutoff)
                        .execute())
        recent_count = count_result.count or 0
        if recent_count >= 50:
            log.info(f"Cache hit: {recent_count} jobs already scraped in the last {CACHE_HOURS}h — skipping baseline configs")
            return {(c["term"].lower(), c["location"].lower()) for c in BASELINE_CONFIGS}
    except Exception as e:
        log.warning(f"Could not check scraper cache: {e}")
    return set()

# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    log.info("Connected to Supabase")
    log.info(f"Settings: sites={SITES}  results_per_search={RESULTS_PER_SEARCH}  hours_old={HOURS_OLD}  cache_hours={CACHE_HOURS}  delay={SCRAPE_DELAY_SECS}s")

    # Build skip set from cache check
    fresh_configs = build_fresh_config_set(supabase)

    dynamic = get_dynamic_configs(supabase)
    all_configs = BASELINE_CONFIGS + dynamic
    log.info(f"Total configs: {len(all_configs)} ({len(BASELINE_CONFIGS)} baseline + {len(dynamic)} dynamic)")

    total_upserted = total_skipped = total_errors = total_deduped = total_cache_skipped = 0

    # Cross-site deduplication: tracks content hashes seen this run.
    # Same job on Indeed + Google has different URLs → different external_id → two DB rows.
    # This prevents double-counting in a single run; the URL-based upsert handles cross-run dedup.
    seen_content_hashes: set = set()

    for config in all_configs:
        term     = config["term"]
        location = config["location"]
        remote   = config.get("is_remote", False)

        # ── Cache skip ────────────────────────────────────────────────────────
        if (term.lower(), location.lower()) in fresh_configs:
            log.info(f"Cache skip: '{term}' | {location}")
            total_cache_skipped += 1
            continue

        log.info(f"Scraping: '{term}' | {location} | remote={remote}")

        country = location_to_country(location)

        try:
            df = scrape_jobs(
                site_name=SITES,
                search_term=term,
                location=location,
                is_remote=remote,
                results_wanted=RESULTS_PER_SEARCH,
                hours_old=HOURS_OLD,
                description_format="markdown",
                country_indeed=country,          # dynamic, not hardcoded
                linkedin_fetch_description=False,
            )
        except Exception as e:
            log.warning(f"  Scrape failed: {e}"); total_errors += 1; continue
        finally:
            # Always sleep between calls to respect upstream rate limits
            time.sleep(SCRAPE_DELAY_SECS)

        if df is None or df.empty:
            log.info("  No results"); continue

        log.info(f"  Found {len(df)} raw rows from JobSpy")

        rows = []
        batch_deduped = 0
        for _, job in df.iterrows():
            url = safe_str(job.get("job_url"))
            if not url:
                total_skipped += 1
                continue

            title   = safe_str(job.get("title")) or "Untitled"
            company = safe_str(job.get("company")) or ""

            # ── Cross-site dedup ──────────────────────────────────────────────
            chash = make_content_hash(title, company)
            if chash in seen_content_hashes:
                batch_deduped += 1
                total_deduped += 1
                continue
            seen_content_hashes.add(chash)

            # ── Map JobSpy columns → job_postings schema ──────────────────────
            rows.append({
                "external_id":     make_url_id(url),
                "title":           title,
                "company":         company or None,
                "location":        safe_str(job.get("location")),
                "is_remote":       safe_bool(job.get("is_remote")),
                "job_type":        norm_type(safe_str(job.get("job_type"))),
                "salary_min":      safe_int(job.get("min_amount")),
                "salary_max":      safe_int(job.get("max_amount")),
                "salary_currency": safe_str(job.get("currency")) or "USD",
                "description":     safe_str(job.get("description")),
                "job_url":         url,
                "source":          safe_str(job.get("site")) or "unknown",
                "date_posted":     safe_str(job.get("date_posted")),
                "scraped_at":      datetime.now(timezone.utc).isoformat(),
            })

        if batch_deduped:
            log.info(f"  Cross-site deduped: {batch_deduped} duplicate(s) removed")

        if not rows:
            continue

        try:
            r = supabase.table("job_postings").upsert(rows, on_conflict="external_id").execute()
            n = len(r.data) if r.data else len(rows)
            total_upserted += n
            log.info(f"  Upserted {n} (from {len(rows)} unique rows)")
        except Exception as e:
            log.error(f"  Upsert failed: {e}"); total_errors += 1

    log.info("=" * 60)
    log.info(
        f"Done. Upserted: {total_upserted} | "
        f"Deduped (cross-site): {total_deduped} | "
        f"Skipped (no URL): {total_skipped} | "
        f"Cache-skipped configs: {total_cache_skipped} | "
        f"Errors: {total_errors}"
    )
    if total_errors > 0 and total_upserted == 0:
        log.error("All scrape attempts failed"); sys.exit(1)

if __name__ == "__main__":
    run()
