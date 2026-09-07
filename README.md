# JobRail

A job search site that pulls listings **directly from company career pages**
and open job feeds, worldwide, across every industry and function.

Jobs come from public ATS APIs (Greenhouse, Lever, Ashby, Workable,
SmartRecruiters, Recruitee) and openly licensed feeds (Adzuna, Remotive,
RemoteOK, Arbeitnow). No headless-browser scraping of bot-defended job
boards — every source here publishes a documented public API.

## Quick start

```bash
npm install
./scripts/dev-db.sh                 # creates the local Postgres database
cp .env.example .env
npx drizzle-kit push                # create tables
psql "$DATABASE_URL" -f drizzle/custom/0001_search.sql   # search indexes
npm run ingest -- --fixtures        # populate from recorded payloads
npm run dev
```

Open http://localhost:3000.

## Layout

```
src/
  app/                 Next.js App Router pages and API routes
  components/          UI
  config/brand.ts      name, tagline, crawler user-agent — rename here only
  lib/
    db/                Drizzle schema + client
    ingest/
      sources/ats/     greenhouse, lever, ashby, workable,
                       smartrecruiters, recruitee
      sources/feeds/   remotive, remoteok, arbeitnow, adzuna
      normalize/       location, salary, work mode, employment type, titles
      classify/        vertical / function / seniority taxonomy
      dedupe.ts        collapses the same role found on several sources
      runner.ts        drives a crawl, isolating each source
    search/            faceted search query builder
data/companies.yml     company boards to crawl, grouped by ATS
fixtures/              recorded API payloads for offline runs
drizzle/custom/        SQL the ORM can't express (tsvector, GIN, trigram)
```

## Crawling

```bash
npm run ingest                   # all sources
npm run ingest -- --only lever   # one source
npm run ingest -- --limit 50     # cap listings per source
npm run ingest -- --dry-run      # fetch and map, write nothing
npm run ingest -- --fixtures     # read fixtures/ instead of the network
```

Each source is isolated: one board changing shape or going down never stops
the others. Per-run outcomes are recorded in the `sources` table.

### About the fixtures

`fixtures/` holds payloads shaped to each API's **documented** response
format. They were authored offline — the environment this was built in
blocks outbound access to the job APIs — so they exercise every adapter's
parsing and mapping code, but they are **not** captured live responses.
Before trusting a source in production, run it once against the real API
and confirm the field mapping:

```bash
npm run ingest -- --only greenhouse --limit 5 --dry-run
```

Company slugs in `data/companies.yml` are likewise a starting list and are
unverified. A wrong slug is a logged 404, not a crash.

## Copyright and source etiquette

- Only **facts** are stored — title, company, location, salary, dates.
  These are not copyrightable.
- Job description **text** is the employer's copyrighted work, so only a
  short excerpt is kept and every listing links out to the original
  posting. The full description is never republished.
- The crawler identifies itself honestly (`config/brand.ts`), rate-limits,
  retries only on 429/5xx, and honours `Retry-After`.
- RemoteOK's terms require a visible backlink to the original post; every
  job card and detail page provides one.

## Tests

```bash
npm test        # normalizer, classifier, location, salary, dedupe
npm run typecheck
```
