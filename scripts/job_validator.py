"""
iCareerOS — Job Validation Module
==================================
Shared by scrape_jobs.py (ingest-time validation) and validate_jobs.py
(daily re-validation schedule).

Three validation layers, applied in order of cost:

  Layer 1 — Heuristics (always runs, fast, free)
    Scam keywords, hidden company, missing required fields, suspicious URLs,
    stale job age.  Produces an initial trust score 0-100.

  Layer 2 — Live URL check (runs when trust score is non-zero AND url_valid is
    unknown, i.e. first validation or daily re-check)
    HEAD request to job_url with a short timeout.  Confirms the posting
    still exists.  Penalises 404/gone heavily.

  Layer 3 — AI check via Claude Haiku (runs on borderline jobs: score 30–70
    after layers 1+2, or when FORCE_AI_CHECK env var is set)
    Prompt asks Claude to assess the job for signs of fraud, ghost listings,
    or keyword stuffing.  Adds or removes up to ±20 points.

Output: ValidationResult dataclass with quality_score, is_flagged,
flag_reasons, url_valid.
"""

import os, re, time, logging
from dataclasses import dataclass, field
from typing import Optional

import requests

log = logging.getLogger("icareeros-validator")

# ── Configuration ─────────────────────────────────────────────────────────────
URL_CHECK_TIMEOUT  = int(os.environ.get("URL_CHECK_TIMEOUT_SECS", "5"))
AI_CHECK_ENABLED   = os.environ.get("DISABLE_AI_CHECK", "").lower() not in ("1","true","yes")
ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
AI_BORDERLINE_LOW  = 30   # run AI check when score falls in [low, high]
AI_BORDERLINE_HIGH = 70

# ── Heuristics ────────────────────────────────────────────────────────────────
SCAM_KEYWORDS = [
    "commission only", "unpaid training", "send money", "wire transfer",
    "western union", "personal bank account", "processing fee",
    "no experience needed", "unlimited earning potential",
    "be your own boss", "work from home guaranteed",
    "data entry clerk", "envelope stuffing", "mystery shopper",
    "earn $500 a day", "earn $1000 a day", "make money fast",
    "financial freedom from home", "pyramid", "mlm",
    "investment required", "pay to work", "registration fee",
]

SUSPICIOUS_URL_PATTERNS = [
    "bit.ly", "tinyurl", "goo.gl", "t.co", "rebrand.ly",
    "forms.gle", "docs.google.com/forms", "surveymonkey",
    "typeform.com", "wufoo.com", "jotform.com",
]

HIDDEN_COMPANY_PATTERNS = re.compile(
    r"^(unknown|confidential|n\/a|tbd|hiring|company|employer|private|undisclosed)$",
    re.IGNORECASE
)


@dataclass
class ValidationResult:
    quality_score:  int               = 50
    is_flagged:     bool              = False
    flag_reasons:   list[str]         = field(default_factory=list)
    url_valid:      Optional[bool]    = None   # None = unchecked

    def flag(self, reason: str, penalty: int) -> None:
        self.flag_reasons.append(reason)
        self.quality_score = max(0, self.quality_score - penalty)

    def boost(self, points: int) -> None:
        self.quality_score = min(100, self.quality_score + points)

    def finalise(self) -> None:
        self.is_flagged = self.quality_score < 40


# ── Layer 1: Heuristics ───────────────────────────────────────────────────────

def run_heuristics(
    title: str,
    company: str,
    description: str,
    job_url: str,
    job_age_days: Optional[int],
) -> ValidationResult:
    result = ValidationResult(quality_score=100)
    text = ((title or "") + " " + (description or "")).lower()

    # Scam keywords
    for kw in SCAM_KEYWORDS:
        if kw in text:
            result.flag(f"Scam indicator: \"{kw}\"", 40)
            break  # one is enough

    # Hidden / missing company
    company_clean = (company or "").strip()
    if not company_clean or HIDDEN_COMPANY_PATTERNS.match(company_clean):
        result.flag("Company name withheld or unknown", 20)

    # Missing required fields
    missing = []
    if not (description or "").strip() or len((description or "").strip()) < 50:
        missing.append("description")
    if not (title or "").strip() or len((title or "").strip()) < 3:
        missing.append("title")
    if missing:
        result.flag(f"Missing or thin content: {', '.join(missing)}", 20)

    # Suspicious application URL
    url_lower = (job_url or "").lower()
    for pattern in SUSPICIOUS_URL_PATTERNS:
        if pattern in url_lower:
            result.flag(f"Suspicious application link ({pattern})", 35)
            break

    # Stale posting
    if job_age_days is not None:
        if job_age_days > 60:
            result.flag(f"Posting is {job_age_days}d old — likely filled or ghost listing", 25)
        elif job_age_days > 45:
            result.flag(f"Posting is {job_age_days}d old — may be stale", 10)

    # Thin description without salary info (weak signal — small penalty)
    desc_words = len((description or "").split())
    if desc_words < 30:
        result.flag("Very short job description (< 30 words)", 15)

    return result


# ── Layer 2: Live URL check ───────────────────────────────────────────────────

def check_url(job_url: str) -> Optional[bool]:
    """
    Returns True if the URL responds with a success status (2xx/3xx),
    False if it's gone (404/410/gone), None if the check failed/timed out.
    """
    if not job_url or not job_url.startswith("http"):
        return None
    try:
        resp = requests.head(
            job_url,
            timeout=URL_CHECK_TIMEOUT,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; iCareerOS-validator/1.0)"},
        )
        if resp.status_code in (404, 410):
            return False
        if resp.status_code < 400:
            return True
        # 5xx or unexpected — don't penalise (site might be temporarily down)
        return None
    except requests.exceptions.Timeout:
        log.debug("URL check timeout: %s", job_url)
        return None
    except Exception as e:
        log.debug("URL check error for %s: %s", job_url, e)
        return None


# ── Layer 3: AI check (Claude Haiku) ─────────────────────────────────────────

_AI_PROMPT_TEMPLATE = """\
You are a job posting authenticity expert. Evaluate whether this job posting appears legitimate or fraudulent.

JOB TITLE: {title}
COMPANY: {company}
LOCATION: {location}
DESCRIPTION (first 800 chars): {description}

Respond in this exact JSON format (no markdown, no explanation):
{{
  "verdict": "legitimate" | "suspicious" | "likely_fake",
  "confidence": 0.0-1.0,
  "reason": "one sentence explanation"
}}

Signs of fake/fraudulent jobs: vague responsibilities, guaranteed income claims,
upfront fees, too-good-to-be-true salaries, generic company descriptions,
keyword stuffing with no real job duties, missing contact info.
"""


def run_ai_check(
    title: str,
    company: str,
    location: str,
    description: str,
) -> tuple[str, float, str]:
    """
    Returns (verdict, confidence, reason).
    verdict is one of: "legitimate", "suspicious", "likely_fake"
    Falls back to ("unknown", 0.0, "") if API call fails.
    """
    if not AI_CHECK_ENABLED or not ANTHROPIC_API_KEY:
        return ("unknown", 0.0, "AI check disabled or no API key")

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        desc_preview = (description or "")[:800]
        prompt = _AI_PROMPT_TEMPLATE.format(
            title=title or "N/A",
            company=company or "N/A",
            location=location or "N/A",
            description=desc_preview,
        )

        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        raw = msg.content[0].text.strip()
        # Strip markdown fences if present
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
        parsed = json.loads(raw)

        verdict    = parsed.get("verdict", "unknown")
        confidence = float(parsed.get("confidence", 0.0))
        reason     = parsed.get("reason", "")
        return (verdict, confidence, reason)

    except Exception as e:
        log.warning("AI check failed: %s", e)
        return ("unknown", 0.0, str(e))


# ── Main entry point ──────────────────────────────────────────────────────────

def validate_job(
    title:         str,
    company:       str,
    location:      str,
    description:   str,
    job_url:       str,
    job_age_days:  Optional[int] = None,
    skip_url_check: bool = False,
    force_ai_check: bool = False,
) -> ValidationResult:
    """
    Run all three validation layers and return a ValidationResult.

    Parameters
    ----------
    skip_url_check : skip the HEAD request (useful for bulk ingest where
                     latency matters; daily script enables it)
    force_ai_check : run AI check regardless of borderline score threshold
    """

    # Layer 1 — heuristics
    result = run_heuristics(title, company, description, job_url, job_age_days)

    # Layer 2 — URL liveness (skipped during bulk scrape to avoid latency)
    if not skip_url_check:
        url_valid = check_url(job_url)
        result.url_valid = url_valid
        if url_valid is False:
            result.flag("Job URL returns 404/410 — posting likely removed", 40)

    # Layer 3 — AI check on borderline jobs
    run_ai = force_ai_check or (AI_BORDERLINE_LOW <= result.quality_score <= AI_BORDERLINE_HIGH)
    if run_ai and AI_CHECK_ENABLED and ANTHROPIC_API_KEY:
        verdict, confidence, reason = run_ai_check(title, company, location, description)

        if verdict == "likely_fake" and confidence >= 0.7:
            result.flag(f"AI: likely fake ({reason})", 25)
        elif verdict == "likely_fake" and confidence >= 0.5:
            result.flag(f"AI: possibly fake ({reason})", 15)
        elif verdict == "suspicious" and confidence >= 0.7:
            result.flag(f"AI: suspicious ({reason})", 10)
        elif verdict == "legitimate" and confidence >= 0.8:
            result.boost(5)  # small confidence boost for clearly legitimate jobs

    result.finalise()
    return result
