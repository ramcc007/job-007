import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Registry of ingestion sources plus the outcome of their last run, so the
 * admin view can show "greenhouse fetched 4,102, accepted 3,988" without
 * trawling logs.
 */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  kind: text("kind").notNull(), // 'ats' | 'feed'
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: text("last_status"), // 'ok' | 'error'
  lastError: text("last_error"),
  lastFetched: integer("last_fetched").notNull().default(0),
  lastAccepted: integer("last_accepted").notNull().default(0),
});

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    website: text("website"),
    logoUrl: text("logo_url"),
    /** Which ATS this employer's careers page runs on, when known. */
    atsPlatform: text("ats_platform"),
    atsSlug: text("ats_slug"),
    sizeBucket: text("size_bucket"),
    hqLocation: text("hq_location"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("companies_ats_idx").on(t.atsPlatform, t.atsSlug),
    index("companies_name_idx").on(t.name),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    source: text("source").notNull(),
    sourceJobId: text("source_job_id").notNull(),
    /** Canonical posting on the employer's own site. */
    externalUrl: text("external_url").notNull(),
    applyUrl: text("apply_url"),
    slug: text("slug").notNull().unique(),

    title: text("title").notNull(),
    titleNormalized: text("title_normalized").notNull(),
    /**
     * A short plain-text excerpt only. The full description is the
     * employer's copyrighted text, so we never store or republish it —
     * readers follow externalUrl for the real posting.
     */
    descriptionExcerpt: text("description_excerpt"),

    employmentType: text("employment_type"), // full_time | part_time | contract | internship | temporary
    workMode: text("work_mode"), // remote | hybrid | onsite | unspecified
    seniority: text("seniority"),
    jobFunction: text("job_function"),
    vertical: text("vertical"),

    salaryMin: numeric("salary_min"),
    salaryMax: numeric("salary_max"),
    salaryCurrency: text("salary_currency"),
    salaryPeriod: text("salary_period"), // year | month | day | hour

    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),

    /** Same role posted on several sources collapses to one dedup hash. */
    dedupHash: text("dedup_hash").notNull(),
  },
  (t) => [
    uniqueIndex("jobs_source_id_idx").on(t.source, t.sourceJobId),
    index("jobs_dedup_idx").on(t.dedupHash),
    index("jobs_posted_idx").on(t.postedAt),
    index("jobs_company_idx").on(t.companyId),
    index("jobs_facets_idx").on(t.vertical, t.jobFunction, t.seniority),
    index("jobs_active_idx").on(t.isActive, t.postedAt),
  ],
);

export const jobLocations = pgTable(
  "job_locations",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    raw: text("raw"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    countryCode: text("country_code"),
    lat: numeric("lat"),
    lng: numeric("lng"),
    isRemote: boolean("is_remote").notNull().default(false),
  },
  (t) => [
    index("job_locations_job_idx").on(t.jobId),
    index("job_locations_city_idx").on(t.city),
    index("job_locations_country_idx").on(t.countryCode),
  ],
);

export const jobTags = pgTable(
  "job_tags",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [uniqueIndex("job_tags_unique_idx").on(t.jobId, t.tag), index("job_tags_tag_idx").on(t.tag)],
);

export type Company = typeof companies.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobLocation = typeof jobLocations.$inferSelect;
export type SourceRow = typeof sources.$inferSelect;
