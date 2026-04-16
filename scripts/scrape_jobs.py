"""
iCareerOS v5 — Native Job Scraper
Runs every 2 hours via GitHub Actions (free compute, $0 cost).
Reads top search terms from search_queries table to stay aligned with what users actually want.
"""
import os, sys, hashlib, logging
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

# Baseline searches — always run regardless of user queries.
# Covers the full breadth of roles iCareerOS users target, not just engineering.
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

    # ── Finance & Business ────────────────────────────────────────────────────
    {"term": "financial analyst",          "location": "New York, NY"},
    {"term": "business analyst",           "location": "United States", "is_remote": True},
]

SITES = ["indeed", "google", "zip_recruiter"]
RESULTS_PER_SEARCH = 30
HOURS_OLD = 48

def make_id(url): return hashlib.sha256(url.encode()).hexdigest()[:32]
def safe_int(v):
    try: return int(v) if v and str(v).strip() not in ("","nan","None") else None
    except: return None
def safe_str(v):
    if v is None: return None
    s = str(v).strip()
    return s if s and s.lower() not in ("nan","none","") else None
def safe_bool(v):
    if isinstance(v, bool): return v
    if isinstance(v, str): return v.lower() in ("true","1","yes")
    return bool(v)
def norm_type(raw):
    if not raw: return None
    m = {"fulltime":"fulltime","full-time":"fulltime","full_time":"fulltime",
         "parttime":"parttime","part-time":"parttime","part_time":"parttime",
         "contract":"contract","contractor":"contract",
         "internship":"internship","intern":"internship"}
    return m.get(str(raw).lower().replace(" ",""), None)

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
                # Ignore sentinel values and very short locations
                if not loc or loc in ("<UNKNOWN>", "unknown") or len(loc) < 2:
                    loc = "United States"
                for title in titles:
                    title = (title or "").strip()
                    if not title or len(title) < 3:
                        continue
                    # Add remote search for each target title
                    if (title.lower(), "United States") not in existing_terms:
                        dynamic.append({"term": title, "location": "United States", "is_remote": True})
                        existing_terms.add((title.lower(), "United States"))
                    # Also add location-specific if profile has one
                    if loc != "United States" and (title.lower(), loc) not in existing_terms:
                        dynamic.append({"term": title, "location": loc})
                        existing_terms.add((title.lower(), loc))
    except Exception as e:
        log.warning(f"Could not fetch profile target titles: {e}")

    return dynamic

def run():
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    log.info(f"Connected to Supabase")

    dynamic = get_dynamic_configs(supabase)
    all_configs = BASELINE_CONFIGS + dynamic
    log.info(f"Running {len(all_configs)} search configs ({len(dynamic)} dynamic)")

    total_upserted = total_skipped = total_errors = 0

    for config in all_configs:
        term = config["term"]; location = config["location"]
        remote = config.get("is_remote", False)
        log.info(f"Scraping: '{term}' | {location} | remote={remote}")
        try:
            df = scrape_jobs(site_name=SITES, search_term=term, location=location,
                             is_remote=remote, results_wanted=RESULTS_PER_SEARCH,
                             hours_old=HOURS_OLD, description_format="markdown",
                             country_indeed="USA", linkedin_fetch_description=False)
        except Exception as e:
            log.warning(f"  Scrape failed: {e}"); total_errors += 1; continue

        if df is None or df.empty:
            log.info(f"  No results"); continue

        log.info(f"  Found {len(df)} jobs")
        rows = []
        for _, job in df.iterrows():
            url = safe_str(job.get("job_url"))
            if not url: total_skipped += 1; continue
            rows.append({
                "external_id":     make_id(url),
                "title":           safe_str(job.get("title")) or "Untitled",
                "company":         safe_str(job.get("company")),
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
        if not rows: continue
        try:
            r = supabase.table("job_postings").upsert(rows, on_conflict="external_id").execute()
            n = len(r.data) if r.data else len(rows)
            total_upserted += n
            log.info(f"  Upserted {n}")
        except Exception as e:
            log.error(f"  Upsert failed: {e}"); total_errors += 1

    log.info("=" * 50)
    log.info(f"Done. Upserted: {total_upserted} | Skipped: {total_skipped} | Errors: {total_errors}")
    if total_errors > 0 and total_upserted == 0:
        log.error("All attempts failed"); sys.exit(1)

if __name__ == "__main__":
    run()
