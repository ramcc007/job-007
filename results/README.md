# Job search tracking — Ram Chandra Chaturvedi

Target roles: Director Digital Marketing / Head of Digital Marketing / Head of
Demand Gen, Gurgaon/Gurugram only, 12+ years experience.

## Files

- `seen_links.csv` — master de-dup log. Every job link ever surfaced to the
  user, with the date it was first shown. On each daily refresh, new search
  results are checked against this file: links already listed here are
  **not** repeated in the daily summary (unless something material changed,
  e.g. re-opened after being marked closed).
- `YYYY-MM-DD.md` — the dated report handed to the user on that day, listing
  only what was **new** that day.

## Known tooling constraint (read before re-running)

From this sandboxed session, `WebFetch` gets HTTP 403 from LinkedIn, Naukri,
Indeed, Glassdoor, Instahyre and Foundit — they all block the fetcher's
requests (standard bot-defense). That means:
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
