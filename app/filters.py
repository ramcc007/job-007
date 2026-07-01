"""
Filter engine: decides whether a scraped raw job listing matches the
search criteria, and normalizes work-mode/employment-type into the fields
stored on the Job model.

Design note on "Unspecified" work mode: title, location and employment
type are hard filters (reject on no match). Work mode is a soft filter —
if we can't tell from the listing text whether it's remote/hybrid<=N/onsite,
we keep the job and label it "Unspecified" rather than silently dropping a
possible match. The dashboard surfaces that bucket separately so nothing
gets lost to a parsing gap.
"""
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app import config


@dataclass
class RawJob:
    source: str
    source_job_id: str
    url: str
    title: str
    company: str
    location_raw: str
    posted_date: datetime
    description_text: str = ""      # full JD text if available, used to parse work mode
    work_mode_hint: str = ""        # explicit "Remote"/"Hybrid"/"On-site" field if the board provides one
    employment_type_raw: str = ""   # explicit "Full-time"/"Contract" field if provided
    salary_raw: str = ""
    summary: str = ""


def _any_match(patterns, text: str) -> bool:
    text = text or ""
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def title_matches(title: str) -> bool:
    if _any_match(config.TITLE_EXCLUDE_PATTERNS, title):
        return False
    return _any_match(config.TITLE_INCLUDE_PATTERNS, title)


def location_matches(location_raw: str) -> bool:
    location_raw = location_raw or ""
    if _any_match(config.LOCATION_INCLUDE, location_raw):
        return True
    return False


HYBRID_DAY_PATTERNS = [
    re.compile(r"(\d)\s*(?:days?|dys?)\s*(?:a|per)?\s*week.{0,20}?(?:office|onsite|on-site|in office)", re.I),
    re.compile(r"(?:office|onsite|on-site|in office).{0,20}?(\d)\s*(?:days?)\s*(?:a|per)?\s*week", re.I),
    re.compile(r"hybrid\s*[\(\-:]?\s*(\d)\s*(?:days?)", re.I),
    re.compile(r"(\d)\s*(?:days?)\s*hybrid", re.I),
]

WORD_TO_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}


def _parse_hybrid_days(text: str) -> Optional[int]:
    text = text or ""
    for pattern in HYBRID_DAY_PATTERNS:
        m = pattern.search(text)
        if m:
            return int(m.group(1))
    for word, num in WORD_TO_NUM.items():
        if re.search(rf"\b{word}\s*(?:days?)\s*(?:a|per)?\s*week.{{0,20}}?(?:office|onsite|on-site)", text, re.I):
            return num
    return None


def parse_work_mode(work_mode_hint: str, description_text: str):
    """Returns (work_mode, hybrid_office_days)."""
    combined = f"{work_mode_hint}\n{description_text}"

    if re.search(r"\bremote\b|\bwork\s*from\s*home\b|\bwfh\b", combined, re.I) and not re.search(
        r"\bhybrid\b", combined, re.I
    ):
        return "Remote", None

    if re.search(r"\bhybrid\b", combined, re.I):
        days = _parse_hybrid_days(combined)
        return "Hybrid", days

    if re.search(r"\bon[-\s]?site\b|\bwork\s*from\s*office\b|\bin[-\s]?office\b|\b5\s*days.{0,15}office\b", combined, re.I):
        days = _parse_hybrid_days(combined)
        return "Onsite", days

    return "Unspecified", None


def work_mode_ok(work_mode: str, hybrid_office_days: Optional[int]) -> bool:
    if work_mode == "Remote":
        return True
    if work_mode == "Hybrid":
        if hybrid_office_days is None:
            return True  # can't confirm day count -> don't drop, dashboard flags it
        return hybrid_office_days <= config.MAX_HYBRID_OFFICE_DAYS
    if work_mode == "Onsite":
        # Only acceptable if it's really a hybrid arrangement described loosely
        # as "work from office N days" with N <= threshold.
        if hybrid_office_days is not None and hybrid_office_days <= config.MAX_HYBRID_OFFICE_DAYS:
            return True
        return False
    return True  # Unspecified: keep, flagged separately


def employment_type_ok(employment_type_raw: str, description_text: str) -> bool:
    combined = f"{employment_type_raw}\n{description_text}"
    return not _any_match(config.EMPLOYMENT_TYPE_REJECT_PATTERNS, combined)


def recency_bucket(posted_date: datetime, now: datetime) -> Optional[str]:
    age_days = (now - posted_date).days
    if age_days < 0:
        age_days = 0
    if age_days <= config.RECENT_WINDOW_DAYS:
        return "recent"
    if age_days <= config.EXTENDED_WINDOW_DAYS:
        return "extended"
    return None  # older than EXTENDED_WINDOW_DAYS -> drop entirely


def evaluate(raw: RawJob, now: Optional[datetime] = None):
    """Returns (passes: bool, reason: str, work_mode: str, hybrid_days: int|None)."""
    now = now or datetime.utcnow()

    if not title_matches(raw.title):
        return False, "title_mismatch", None, None

    if not location_matches(raw.location_raw):
        return False, "location_mismatch", None, None

    if not employment_type_ok(raw.employment_type_raw, raw.description_text):
        return False, "employment_type_excluded", None, None

    work_mode, hybrid_days = parse_work_mode(raw.work_mode_hint, raw.description_text)
    if not work_mode_ok(work_mode, hybrid_days):
        return False, "work_mode_excluded", work_mode, hybrid_days

    if recency_bucket(raw.posted_date, now) is None:
        return False, "too_old", work_mode, hybrid_days

    return True, "ok", work_mode, hybrid_days
