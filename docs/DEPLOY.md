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
