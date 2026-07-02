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
    # Widened: Indian listings often title senior marketing roles just
    # "Marketing Director" / "Director, Marketing" without the word
    # "digital", even when the role itself is digital-heavy.
    r"\bmarketing\s*director\b",
    r"\bdirector\s*[-–—,]?\s*marketing\b",
    r"\bhead\s*of\s*marketing\b",
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
    # Adjacent functions that carry "marketing"/"director" wording but
    # aren't digital-marketing-director-equivalent roles.
    r"\bbrand\s*director\b",
    r"\bpublic\s*relations\b",
    r"\bcommunications?\s*director\b",
    r"\bsales\s*director\b",
    r"\bproduct\s*marketing\s*director\b",
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
    # Naukri is scraped via a real logged-in browser session (see
    # app/scrapers/naukri.py) rather than raw HTTP. Kept deliberately
    # infrequent to look like normal manual browsing on your account, not
    # automated polling -- do not lower this without a reason.
    "naukri": 20,
    # Indeed/Foundit/Instahyre also go through a real (anonymous) browser
    # since their HTTP endpoints block or don't exist; browser launches
    # are heavy, so these run less often than the old 5-min HTTP polls.
    "indeed": 15,
    "foundit": 15,
    "instahyre": 30,
    "linkedin": 15,
}

# --- Search queries -------------------------------------------------------
# Every scraper runs one search per keyword below. More keywords = broader
# coverage but more requests per cycle; keep the list focused on title
# variants that actually appear on Indian boards for this level.
SEARCH_KEYWORDS_LIST = [
    "digital marketing director",
    "marketing director",
    "head of digital marketing",
    "head of marketing",
    "growth marketing director",
]
SEARCH_LOCATION = "Gurgaon"

# --- LinkedIn depth ------------------------------------------------------
LINKEDIN_PAGES_PER_KEYWORD = 3       # guest API returns ~10 listings per page
LINKEDIN_PAGE_SIZE = 10
LINKEDIN_POSTED_WITHIN_SECONDS = 30 * 24 * 3600  # 30d, to fill the extended bucket too
LINKEDIN_REQUEST_DELAY_SECONDS = 1.5  # be gentle; the guest API 429s fast
# After searching, fetch the full JD (guest endpoint, no login) for up to
# this many title/location-matching jobs per cycle, so work mode and
# summary can actually be parsed instead of landing in "Unspecified".
LINKEDIN_MAX_DESCRIPTION_FETCHES = 8

DB_PATH = "job_radar.db"
HTTP_TIMEOUT_SECONDS = 15
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# --- Browser automation ---------------------------------------------------
# Naukri sits behind Akamai Bot Manager and per-request signed tokens, so
# it can't be scraped with plain HTTP requests -- app/scrapers/naukri.py
# drives a real Chromium instance instead, reusing a persistent login
# profile saved by scripts/setup_naukri_login.py (run that once first).
NAUKRI_PROFILE_DIR = ".naukri_browser_profile"
# Indeed/Foundit/Instahyre share a separate anonymous browser profile (no
# login involved); it's created automatically on first run.
GENERIC_BROWSER_PROFILE_DIR = ".browser_profile"
BROWSER_HEADLESS = True
BROWSER_PAGE_TIMEOUT_MS = 30000
