# Digital Marketing Director – Gurgaon Job Radar

A local dashboard that continuously scrapes public job-board search
results and shows only postings matching a narrow profile: senior
Digital-Marketing-Director-level roles, based in Gurgaon, permanent,
Hybrid (≤3 days in office) or Remote, posted in the last 15/30 days.

## How it works

1. **Scrapers** (`app/scrapers/`) pull listings from Naukri, LinkedIn
   (guest/public search), Instahyre, Indeed and Foundit — all via public,
   non-login-walled endpoints. Each source is isolated: if one board
   changes its markup/API and breaks, the others keep working.
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

- **Scraper fragility**: Naukri/LinkedIn/Instahyre/Indeed/Foundit are all
  scraped via public but *unofficial* endpoints (no ToS-violating
  login-walled scraping is used). Job-board frontends change their
  markup/APIs periodically; each scraper file has a comment explaining
  how to re-verify/update it if it starts returning 0 results. Wrap
  requests in a network debugger (browser DevTools → Network tab) on the
  live site to diff against the parsing code.
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
