# Digital Marketing Director – Gurgaon Job Radar

A local dashboard that continuously scrapes public job-board search
results and shows only postings matching a narrow profile: senior
Digital-Marketing-Director-level roles, based in Gurgaon, permanent,
Hybrid (≤3 days in office) or Remote, posted in the last 15/30 days.

## How it works

1. **Scrapers** (`app/scrapers/`) pull listings from Naukri, LinkedIn
   (guest/public search), Instahyre, Indeed and Foundit. Each source is
   isolated: if one board changes its markup/API and breaks, the others
   keep working. Naukri is the exception to "non-login" — it runs Akamai
   bot-defense and per-request signed tokens that block plain HTTP
   requests entirely, so it's scraped via a real, persistent, logged-in
   Chromium session (Playwright) instead — see **Naukri setup** below.
2. **Filter engine** (`app/filters.py`) applies, in order:
   - Title whitelist (Digital Marketing Director / Head of Digital
     Marketing / Growth or Demand Gen Director) minus VP/Senior
     Director/CMO/Manager-level titles.
   - Location: must explicitly say Gurgaon/Gurugram (generic "NCR"/"Delhi
     NCR" tags are rejected so Noida/Faridabad/Delhi postings don't leak
     in).
   - Employment type: permanent only (contract/freelance/temp/internship
     rejected).
   - Work mode: Remote always passes; Hybrid passes only if the parsed
     in-office day count is ≤3 (configurable); fully onsite is rejected;
     if work mode can't be determined from the listing text it's kept and
     labeled "Unspecified" rather than silently dropped.
   - Recency: 0–15 days old = "recent" bucket (default view), 16–30 days
     = "extended" bucket (toggle in the UI), older is purged.
3. **Scheduler** (`app/scheduler.py`, APScheduler) re-runs each scraper on
   its own interval (default every 5 min; LinkedIn every 15 min since its
   guest endpoint throttles aggressive polling) and upserts matches into
   a local SQLite DB (`job_radar.db`).
4. **Dashboard** (`app/static/`) polls `/api/jobs` every 5 minutes,
   sorted newest → oldest, with filters for source, work mode and
   recency bucket, plus a free-text search box.

## Setup

```bash
pip install -r requirements.txt
playwright install chromium
```

### Naukri setup (one-time)

Naukri can't be scraped with plain HTTP — it needs a real logged-in
browser session:

```bash
python scripts/setup_naukri_login.py
```

This opens a visible Chromium window. Log in to Naukri normally in that
window, then come back to the terminal and press Enter. Your session is
saved to `.naukri_browser_profile/` (gitignored, stays local to your
machine) and reused automatically on every future run — no need to log
in again or paste any cookies/tokens. Re-run this script only if Naukri
logs your saved session out (should be rare — weeks, not hours).

Naukri's automated poll interval is set conservatively (every 20 min, see
`SCRAPE_INTERVAL_MINUTES` in `app/config.py`) to look like normal manual
browsing on your account rather than aggressive bot polling. Don't lower
it without a reason — Akamai bot-defense is specifically designed to flag
unusually regular/frequent automated request patterns, and this uses your
real personal Naukri login.

### Run it

```bash
python run.py
```

Open http://localhost:8000 — the dashboard loads immediately and the
first scrape cycle fires on startup (no need to wait 5 minutes for the
first results).

## Tuning the search

Everything is centralized in `app/config.py`:
- `TITLE_INCLUDE_PATTERNS` / `TITLE_EXCLUDE_PATTERNS` — widen/narrow the
  title whitelist.
- `LOCATION_INCLUDE` — add more acceptable location strings.
- `MAX_HYBRID_OFFICE_DAYS` — currently 3.
- `EMPLOYMENT_TYPE_REJECT_PATTERNS` — currently rejects contract,
  freelance, temp, internship, part-time.
- `RECENT_WINDOW_DAYS` / `EXTENDED_WINDOW_DAYS` — currently 15 / 30.
- `SCRAPE_INTERVAL_MINUTES` — per-source polling cadence.

## Known limitations

- **Scraper fragility**: LinkedIn/Instahyre/Indeed/Foundit are scraped
  via public, non-login HTTP endpoints; job-board frontends change their
  markup/APIs periodically. Each scraper file has a comment explaining
  how to re-verify/update it if it starts returning 0 results — open the
  live site, browser DevTools → Network tab, and diff the real request
  against the parsing code.
- **Indeed specifically** returns 403 (bot-fingerprint block) even with
  correct headers, since it does more than header-checking. This may
  need to stay broken/dropped rather than chased further — Naukri and
  LinkedIn already cover Gurgaon senior-marketing listings well.
- **Naukri account risk**: the Naukri scraper drives your real logged-in
  browser session. It's built to look as close to normal manual browsing
  as reasonably possible (real browser, infrequent polling, no headless
  fingerprint), but any automation against a site with active bot-defense
  carries some inherent risk of the account being flagged. If you'd
  rather avoid that entirely, disable it in `app/scrapers/__init__.py`
  and instead use Naukri's own built-in "Create a job alert" feature on
  the search results page — same coverage, zero automation risk, just
  arrives by email instead of in this dashboard.
- **Rate limiting**: aggressive polling (especially LinkedIn) can trigger
  temporary blocks. Back off the interval in `config.py` if a source
  starts erroring consistently.
- **Low volume expected**: this is a narrow niche (Director-level Digital
  Marketing, Gurgaon-only, Hybrid/Remote, permanent). Expect a handful of
  new postings per week, not per 5-minute cycle — "0 new jobs" between
  refreshes is normal, not a bug.
- **Salary data**: rarely published on Indian job boards; most rows will
  show "N/A".
- **LinkedIn summaries**: the guest search endpoint doesn't expose full
  job descriptions, so LinkedIn-sourced rows often land in the
  "Unspecified" work-mode bucket and have no summary text — this is a
  platform limitation, not a bug in the scraper.
