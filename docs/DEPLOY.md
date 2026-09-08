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

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Supabase transaction pooler) |
| `INGEST_SECRET` | yes | Shared secret guarding `POST /api/ingest` |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical origin; falls back to Vercel's own URL |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | no | Free key unlocking 16 more countries |

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
