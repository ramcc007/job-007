# Deploying

## Why `vercel.json` pins the framework

The Vercel project was first imported while the repository's default branch
still held an old Python/FastAPI app, so Vercel saved **FastAPI** as the
project's framework preset. That preset outlives the code: later builds of
this Next.js app failed with

    Error: No FastAPI entrypoint found.

`vercel.json` sets `"framework": "nextjs"` explicitly, which takes precedence
over the saved dashboard preset. Don't delete it unless the project's preset
has been corrected in Vercel's settings first.

## Why the function region is pinned

`vercel.json` pins `regions: ["bom1"]` (Mumbai) to sit next to the Supabase
project, which is also in `ap-south-1`.

This matters more than it looks. Ingestion writes each listing with several
sequential statements, so every extra millisecond of round-trip latency is
paid hundreds of times over. Serving from Washington against a Mumbai
database added roughly 200 ms per statement and made a crawl time out;
co-located, the same work is a fraction of the time. Keep the two regions
together if either ever moves.

## Environment variables

None are required — every keyed source disables itself cleanly when
unconfigured, and the keyless ones keep working.

| Name | Unlocks |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin; falls back to Vercel's own URL |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | 19 national markets including India |
| `RAPIDAPI_KEY` | Indeed, LinkedIn, Glassdoor and ZipRecruiter listings via JSearch |
| `JOOBLE_KEY` | 60+ countries, indexing national boards |
| `CAREERJET_AFFID` | ~90 countries |

## On Indeed, Naukri, LinkedIn, iimjobs and Monster

None of these publishes an open API, and all forbid automated access in
their terms. Indeed retired its Publisher API to new applicants; Naukri
(and its sibling iimjobs) runs Akamai bot defence; LinkedIn gates jobs
behind partner-only Talent Solutions; Monster/Foundit exposes nothing for
job seekers.

Their listings are reachable anyway, through aggregators that license the
same inventory — JSearch for Indeed and LinkedIn, Jooble and Careerjet for
the national boards. Those are the adapters above. Scraping the sites
directly would breach their terms, risk the account used to do it, and
break whenever their defences change.

For anything else, `data/feeds.yml` reads any board that publishes RSS —
which is a feed offered for syndication, so consuming it is both lawful and
stable. Adding one takes no code.

## Filling the database

Crawls run wherever the deployment lives, because that host has open network
access to the job APIs:

```bash
curl -X POST "$SITE_URL/api/ingest" -H "Authorization: Bearer $INGEST_SECRET"
```

`.github/workflows/ingest.yml` does this on a schedule; it needs the
`SITE_URL` and `INGEST_SECRET` repository secrets.

`.github/workflows/verify-sources.yml` separately dry-runs every source
weekly and needs no secrets — it is the early warning for a job board
changing its API or a company slug going stale.
