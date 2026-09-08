# Project Plan — Global Job Aggregation Portal

Status: **approved and under construction** — Phases 0–2 built and running.

| Phase | State |
|---|---|
| 0 — Foundation | done |
| 1 — Ingestion engine | done (10 adapters, normalizer, classifier, dedupe) |
| 2 — Website | done (search, job pages, company pages, JSON-LD, sitemap) |
| Deployment | done — live at https://job-007.vercel.app with a daily refresh |
| 3 — Accounts, saved searches, email alerts | not started |
| 4 — Monetisation hooks (off by default) | not started |

Two decisions changed during the build, both for the better:

- **Single Next.js app, not a monorepo.** Same module boundaries, zero
  Vercel configuration. See the layout in `README.md`.
- **GitHub Actions runs the crawl schedule**, not Vercel Cron — Vercel's
  free tier caps cron at one run per day, GitHub Actions is free and
  minute-level. See `.github/workflows/ingest.yml`.
Branch: `claude/job-listings-aggregator-wsmaod`

---

## 1. Decisions locked in

| Decision | Choice |
|---|---|
| Market | **Global from day one** — location filter does the segmenting |
| Stack | **Next.js (App Router) + TypeScript + Postgres (Supabase) + Vercel** |
| Look | **Dark "control room"** — two-pane master/detail, light mode as toggle |
| Pricing | **Free**. Monetisation wired into the schema but switched off |
| Brand | **JobRail** (pending your confirmation — see §3) |

---

## 2. What happens to the current repo

The repo currently holds *Digital Marketing Director – Gurgaon Job Radar*: a
local-only FastAPI + SQLite + Playwright dashboard (~1,800 LOC) that scrapes
Naukri/LinkedIn/Indeed/Foundit/Instahyre through a real logged-in Chromium
session and filters for one job title in one city.

It is being replaced, not extended. Three reasons:

1. **Inverted purpose.** `app/filters.py` exists to *reject* everything that
   isn't a Digital Marketing Director in Gurgaon. The new product must accept
   everything and let the user slice it.
2. **The scraping approach cannot go public.** Naukri, LinkedIn and Indeed run
   active bot defence, forbid scraping in their terms of service, and the
   current Naukri scraper drives a real personal logged-in account. On a public
   website that is a legal and account-safety problem, not an engineering one.
3. **No web layer at all.** No SEO, no job pages, no accounts, no alerts,
   no deployment story.

**Nothing is lost.** The old code stays in git history and on branch
`claude/job-scraper-digital-marketing-tndpmw`. Step 1 of execution removes it
from the working tree on our branch only.

---

## 3. Brand and domain

Checked live against the registrar. Available right now:

| Name | .com | .io | .in |
|---|---|---|---|
| **JobRail** | **free** | **free** | **free** |
| Workvane | taken | free | free |
| Rolelight | taken | free | free |
| JobForge | free | taken | taken |
| JobKiln | free | — | — |
| JobVeyor | free | — | — |

**Recommendation: JobRail** — the only candidate with a clean sweep of all
three TLDs, short, pronounceable, and metaphorically about *infrastructure that
carries you somewhere* rather than anything to do with hunting or dogs, which
keeps it thematically clear of the reference site.

Branding lives in one config file (`config/brand.ts`), so a later rename is a
five-minute change, not a refactor.

---

## 4. Architecture

### 4.1 The core decision: pull from company career pages, not job boards

The reference site's real mechanic is that it pulls jobs **directly from
company career pages**, which is why it can claim no ghost jobs and
direct-to-company applications.

That works because nearly every company career page runs on a handful of
Applicant Tracking Systems, and those ATS platforms expose **free, public,
documented JSON APIs**:

| Platform | Public endpoint | Notes |
|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{co}/jobs?content=true` | full JD included |
| Lever | `api.lever.co/v0/postings/{co}?mode=json` | |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{co}` | |
| Workable | `apply.workable.com/api/v1/widget/accounts/{co}?details=true` | |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{co}/postings` | |
| Recruitee | `{co}.recruitee.com/api/offers/` | |
| Teamtailor / Personio | per-tenant JSON | |
| Workday | CxS search API | largest enterprises |

Plus openly licensed aggregator feeds, which give global breadth immediately:

- **Adzuna** — free API tier, 16 countries including India, UK, US, AU, DE
- **Remotive**, **RemoteOK**, **Arbeitnow**, **Himalayas** — remote roles
- **We Work Remotely** — RSS
- **Jooble**, **USAJobs** — free APIs

**Consequence: no Playwright, no headless browser, no bot-defence evasion, no
brittle CSS selectors, no ToS violation.** This is the single largest
difference from the code currently in the repo, and it is what makes a
24/7 public site viable.

### 4.2 Repo layout

```
apps/web/                  Next.js App Router site
  app/
    (marketing)/           landing, about, for-employers
    jobs/                  search UI + /jobs/[slug] detail
    companies/[slug]/      employer profile + open roles
    [function]-jobs-in-[city]/   generated SEO landing pages
    api/                   search, alerts, ingest trigger
  components/
  lib/

packages/ingest/           the engine
  sources/
    ats/                   greenhouse, lever, ashby, workable,
                           smartrecruiters, recruitee, workday
    feeds/                 adzuna, remotive, remoteok, arbeitnow,
                           himalayas, wwr, jooble
  normalize/               title, location, salary, work-mode, dates
  classify/                vertical / function / seniority taxonomy
  dedupe/
  runner.ts

packages/db/               schema, migrations, typed client
config/
  brand.ts                 name, palette, copy — single source of truth
  companies.yml            seed list of ATS company slugs to crawl
.github/workflows/ingest.yml   the scheduler
```

### 4.3 Data model (essentials)

```
companies      id, name, slug, website, logo_url, ats_platform, ats_slug,
               size_bucket, hq_location, description

jobs           id, company_id, source, source_job_id, external_url,
               title, title_normalized, description_excerpt,
               employment_type, work_mode, seniority, function, vertical,
               salary_min, salary_max, salary_currency, salary_period,
               posted_at, first_seen_at, last_seen_at, expires_at,
               is_active, dedup_hash, search_vector (tsvector)

job_locations  job_id, city, region, country, country_code, lat, lng, is_remote
job_tags       job_id, tag            -- skills, tech, certifications
sources        name, kind, last_run_at, status, fetched, matched, error

users, saved_jobs, saved_searches, alerts, applications
```

Search runs on **Postgres full-text search** (`tsvector` + GIN index) plus
trigram indexes for fuzzy company/title matching. Free, no extra service.
A dedicated search engine (Typesense/Meilisearch) only if volume demands it.

### 4.4 Classification — the "across verticals, across functions" requirement

A rule-based classifier: weighted keyword and regex rules over title +
description. Deterministic, free, debuggable, no LLM cost per job. Three
independent axes:

- **Vertical** — Technology, Healthcare, Finance/Banking, Manufacturing,
  Retail/E-commerce, Energy/Utilities, Education, Government/Public,
  Logistics/Transport, Media/Entertainment, Real Estate, Hospitality,
  Professional Services, Non-profit
- **Function** — Software Engineering, Data/AI, Infrastructure/DevOps,
  Security, Product, Design, Mechanical/Civil/Electrical Engineering,
  Sales, Marketing, Finance/Accounting, HR/Recruiting, Legal, Operations,
  Supply Chain, Customer Support, Clinical/Healthcare, Skilled Trades,
  Administration, Research
- **Seniority** — Intern, Entry, Mid, Senior, Lead/Principal, Manager,
  Director, VP, C-level

Every rule is a table row, so widening coverage is data entry, not code
changes. An LLM pass can be layered on later for the residual "Other" bucket.

### 4.5 Scheduler

**GitHub Actions scheduled workflow** hitting an authenticated ingest
endpoint. Reason: Vercel's free tier caps cron at one run per day, whereas
GitHub Actions gives free minute-level scheduling and this repo is already
on GitHub. Per-source cadence, incremental fetch, dead-link detection,
automatic expiry of stale postings.

---

## 5. Build phases

### Phase 0 — Foundation
- Remove the old app from the working tree on this branch
- Scaffold Next.js + TypeScript + Tailwind monorepo
- Provision Supabase Postgres, apply schema, wire typed client
- Land `config/brand.ts` with the design tokens in §6

### Phase 1 — Ingestion engine
- Source adapter interface + the ATS adapters
- Feed adapters (Adzuna first — it alone unlocks global coverage)
- Normalizer: title cleanup, location geocoding, salary parsing
  (multi-currency, hourly/monthly/annual), work-mode inference, date parsing
- Deduplication: same role on multiple sources collapses to one row, with
  every source retained as an alternate link
- Classifier + taxonomy tables
- `companies.yml` seeded with a few hundred ATS slugs
- Ingest run reporting: per-source fetched / accepted / rejected / errors

### Phase 2 — The website
- **Search page** — the core surface. Facets: keyword, location + radius,
  remote/hybrid/onsite, vertical, function, seniority, employment type,
  salary band, date posted, company, source. URL-driven state so every
  filter combination is shareable and indexable.
- **Job detail** — key facts, excerpt, "Apply on company site" outbound link
- **Company profiles** — all open roles per employer
- **SEO landing pages** — generated `/{function}-jobs-in-{city}` routes
- **`JobPosting` JSON-LD on every job page** → free inclusion in Google for
  Jobs. This is how job boards actually acquire traffic; it is not optional.
- Sitemap, RSS, Open Graph cards

### Phase 3 — Retention, all free
Accounts, saved jobs, saved searches, email alerts (daily/weekly digest),
lightweight application tracker.

### Phase 4 — Monetisation hooks, built but disabled
Employer direct-post, featured/promoted listings, subscription tiers.
Schema and feature flags land now so switching pricing on later is a config
change, not a rewrite.

---

## 6. Design system — deliberately unlike the reference site

You asked specifically that the result not be traceable to the site you
linked. Handled on two fronts.

### 6.1 Legal separation

- **Facts versus expression.** Job title, company, location, salary and dates
  are *facts* and are not copyrightable. The job description *text* is
  copyrightable. So: store a short auto-generated excerpt only, never the
  full copied description, and always link out to the original posting. This
  is the standard, defensible pattern used across the industry.
- **Zero contact with that site.** We never fetch, scrape, or reference it.
  No copied markup, styles, class names, component structure, or marketing
  copy. Nothing in the repository, commit history, code comments, or page
  metadata names it. There is no technical trail back to that domain.
- Respect `robots.txt`, rate-limit politely, identify our crawler honestly in
  the User-Agent, honour source attribution requirements.

### 6.2 Visual separation, by construction

| | Reference site | JobRail |
|---|---|---|
| Layout | single-column card list, modal on click | **two-pane master/detail** — persistent left facet rail, centre result list, live right-hand detail panel |
| Theme | light, minimal | **dark-first**, light mode as toggle |
| Palette | blue / neutral | **deep ink + copper-amber + teal** |
| Type | standard UI sans | **geometric display + Plex Sans body + Plex Mono for data** |
| Density | airy | dense, scannable, keyboard-navigable |
| Scope | remote-only, US/Canada | all verticals, all functions, worldwide |
| Price | paid | free |

### 6.3 Tokens

```
ink            #0B0E14    page ground
surface        #12161F    panels
elevated       #1A1F2B    cards, hover
border         #252B38
text           #E6E9EF    primary
muted          #8A93A6    secondary
accent         #E8894A    copper-amber — primary actions
accent-hover   #F59B5E
secondary      #3FBFA8    teal — remote badges, success
warn           #E5B84B

display  Space Grotesk
body     IBM Plex Sans
mono     IBM Plex Mono   (salary, dates, IDs)
```

Semantic colour: remote = teal, hybrid = amber, onsite = slate.

---

## 7. What I need from you

| # | Item | Blocking? | Notes |
|---|---|---|---|
| 1 | Confirm **JobRail** + which TLD to buy | Yes, for branding | Or name it yourself. I can register the domain through the registrar tooling in this session |
| 2 | **Supabase** access | Yes, before deploy | I have Supabase tooling here and can create the project — just confirm you want me to |
| 3 | **Vercel** access | Yes, before deploy | Same — I can create and deploy the project directly |
| 4 | **Adzuna API key** | No, but high value | Free tier, self-serve at developer.adzuna.com. Unlocks 16 countries immediately |
| 5 | **Resend** (email alerts) | No, Phase 3 only | Free tier covers early volume; I have tooling for it here |
| 6 | Any **must-have companies** to seed | No | Employers you want covered from day one |
| 7 | Priority countries/cities for the first SEO landing pages | No | Defaults to top global metros otherwise |

Items 4–7 are not blockers. I can build and demo the entire thing locally
against the free no-key sources first, and you can review it working before
anything is deployed or paid for.

---

## 8. Open questions for later

- Whether to add an LLM enrichment pass for job summaries and skill
  extraction (small per-job cost, meaningfully better search quality)
- Whether to geocode via a free provider (Nominatim) or a paid one at scale
- Whether employer direct-post should be moderated manually at launch
