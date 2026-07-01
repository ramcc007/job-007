"""
All tunable settings for the job radar live here. Edit this file to change
the search criteria without touching scraper/filter code.
"""

# --- Title matching -------------------------------------------------------
# A job passes if its title matches ANY of these (case-insensitive, regex).
TITLE_INCLUDE_PATTERNS = [
    r"\bdigital\s*marketing\s*director\b",
    r"\bdirector\s*[-–—,]?\s*digital\s*marketing\b",
    r"\bhead\s*of\s*digital\s*marketing\b",
    r"\bdigital\s*marketing\s*head\b",
    r"\bgrowth\s*marketing\s*director\b",
    r"\bdirector\s*[-–—,]?\s*growth\s*marketing\b",
    r"\bdemand\s*generation\s*director\b",
    r"\bdirector\s*[-–—,]?\s*demand\s*generation\b",
]

# A job is rejected if its title matches ANY of these, even if it also
# matched an include pattern above (guards against over/under-shoot titles).
TITLE_EXCLUDE_PATTERNS = [
    r"\bvice\s*president\b",
    r"\bvp\b",
    r"\bsvp\b",
    r"\bsenior\s*director\b",
    r"\bgroup\s*director\b",
    r"\bchief\s*marketing\s*officer\b",
    r"\bcmo\b",
    r"\bmanager\b",
    r"\bexecutive\b",
    r"\bassociate\b",
    r"\bintern(ship)?\b",
    r"\bexecutive\s*assistant\b",
]

# --- Location ---------------------------------------------------------
# Job must explicitly mention one of these cities. Generic regional tags
# ("NCR", "Delhi NCR") are intentionally NOT matched, since those pull in
# Noida/Faridabad/Delhi postings we don't want.
LOCATION_INCLUDE = [r"\bgurgaon\b", r"\bgurugram\b"]

# If a location string mentions ANY of these cities as the primary/only
# location (without Gurgaon/Gurugram also present), reject it.
LOCATION_REJECT_IF_ONLY = [r"\bnoida\b", r"\bfaridabad\b", r"\bdelhi\b", r"\bnew delhi\b"]

# --- Work mode ----------------------------------------------------------
# Remote -> always accepted.
# Hybrid -> accepted only if in-office days parsed from text is <= this value.
#           If hybrid but day count can't be parsed, it lands in "Unspecified"
#           (shown, not auto-rejected) so nothing is silently lost.
# Onsite/"work from office" full time -> rejected.
MAX_HYBRID_OFFICE_DAYS = 3

# --- Employment type ------------------------------------------------------
# Only permanent roles. Reject postings explicitly tagged as contract,
# freelance, internship, or temporary.
EMPLOYMENT_TYPE_REJECT_PATTERNS = [
    r"\bcontract\b",
    r"\bfreelance\b",
    r"\btemporary\b",
    r"\btemp\b",
    r"\binternship\b",
    r"\bpart[-\s]?time\b",
]

# --- Recency buckets ------------------------------------------------------
RECENT_WINDOW_DAYS = 15   # primary bucket: 0-15 days old
EXTENDED_WINDOW_DAYS = 30  # secondary bucket: 16-30 days old, then dropped

# --- Refresh schedule -------------------------------------------------
# Per-source polling interval, in minutes. LinkedIn's guest endpoints get
# rate-limited/blocked fast under aggressive polling, so it defaults slower
# than the rest. Adjust freely; the dashboard still shows a unified,
# continuously-updating list regardless of per-source cadence.
SCRAPE_INTERVAL_MINUTES = {
    "naukri": 5,
    "instahyre": 5,
    "indeed": 5,
    "foundit": 5,
    "linkedin": 15,
}

# --- Search query -------------------------------------------------------
SEARCH_KEYWORDS = "Digital Marketing Director"
SEARCH_LOCATION = "Gurgaon"

DB_PATH = "job_radar.db"
HTTP_TIMEOUT_SECONDS = 15
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
