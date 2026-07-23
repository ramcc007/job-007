# Job search tracking — Ram Chandra Chaturvedi

Target roles: Director Digital Marketing / Head of Digital Marketing / Head of
Demand Gen, Gurgaon/Gurugram only, 12+ years experience.

**Recency window: last 3 weeks (21 days)** as of 2026-07-23 (was 7 days on
day 1, briefly considered 14 days, settled on 21 per user request). Since
`WebFetch` can't verify exact posted dates this session (see below), this
window is applied loosely as an inclusion threshold on `WebSearch`'s own
"posted X days/weeks ago" text where present, not as a hard filter.

**Company-size criterion (updated 2026-07-23, supersedes the Freshworks bar
above)**: target any Forbes-1000-caliber company with 500+ employees
worldwide and a genuine Gurgaon marketing presence. Real Director/Head-level
Gurgaon leads at smaller companies are still logged (useful fallback
options) but flagged as not meeting this bar.

## Live site + automation

- Deployed to Vercel project `rcc-job-search-tracker`
  (https://rcc-job-search-tracker.vercel.app), same project reused on every
  redeploy so the URL never changes.
- Canonical source for the deployed site lives at `site/index.html`,
  `site/robots.txt`, `site/vercel.json` in this repo — every automated
  refresh edits these files, commits them, then redeploys via the Vercel
  `deploy_to_vercel` MCP tool (target=production, name=rcc-job-search-tracker,
  teamId=team_7iVa6Hm7WfmystDTDEfUWd7k).
- The page carries `<meta name="robots" content="noindex,...">` plus an
  `X-Robots-Tag` response header (via `vercel.json`) and a blanket
  `robots.txt` disallow — it's deliberately kept out of search engines.
- A recurring Routine (scheduled trigger, cron `0 */2 * * *`,
  fresh session per firing) re-runs the search, cross-validates each
  candidate with a second independent `WebSearch` pass (since `WebFetch`
  can't reach any job board or career site this session — see below),
  drops anything that fails that check, updates `seen_links.csv` and
  `site/index.html` with a new "Last refreshed" timestamp, commits, and
  redeploys. See the trigger's stored prompt for the exact instructions
  given to each fresh run.

## Files

- `seen_links.csv` — master de-dup log. Every job link ever surfaced to the
  user, with the date it was first shown. On each daily refresh, new search
  results are checked against this file: links already listed here are
  **not** repeated in the daily summary (unless something material changed,
  e.g. re-opened after being marked closed).
- `YYYY-MM-DD.md` — the dated report handed to the user on that day, listing
  only what was **new** that day.

## Known tooling constraint (read before re-running)

From this sandboxed session, `WebFetch` returns HTTP 403 on **every** URL
tested — not just job boards. That includes LinkedIn, Naukri, Indeed,
Glassdoor, Instahyre, foundit.in, Coca-Cola's own Workday career site,
Coca-Cola's own Phenom career site, WNS's SmartRecruiters page, Samsung's
own careers page, a Greenhouse-hosted board, and even **plain
en.wikipedia.org** — a page with no bot-defense at all. That last one
confirms this isn't individual sites blocking a scraper; `WebFetch` itself
is non-functional for outbound fetches in this session (100% failure rate
across 13+ distinct hosts tried). Going to company-owned career sites does
**not** route around this — don't spend calls re-testing it session to
session without checking first with one throwaway fetch (e.g. Wikipedia).
Consequence:
- Individual job links come from `WebSearch` result snippets only; they
  cannot be opened here to confirm the posting is still live or to read its
  exact "posted on" date.
- `WebSearch`'s own "posted X days/weeks ago" phrasing has been observed to
  be **inconsistent for the same URL across two separate searches** — treat
  it as a rough hint, not a verified fact. Every link handed to the user
  should be labeled with a confidence note, and the user should confirm the
  actual posted date themselves when they open it.
- This repo already contains a scraper app (`app/`, see root `README.md`)
  built for this exact brief. It gets past the LinkedIn guest-endpoint block
  because it runs from a normal residential/user network rather than this
  session's egress-policy proxy, and it gets past Naukri's Akamai bot-defense
  by driving a real logged-in browser session. **Running that app locally is
  the more reliable long-term solution** — this `results/` log is a
  best-effort manual supplement for inside-this-session searches only.

## Realistic volume

Director/Head-level Digital Marketing or Demand Gen roles that are (a)
explicitly anchored to Gurgaon/Gurugram (not generic NCR/Delhi) and (b)
posted within the last 7 days is a narrow niche. Expect single digits of
genuinely new, on-target postings per week, not 50 — confirmed independently
by live search results and by this repo's own scraper-app README ("expect a
handful of new postings per week").
