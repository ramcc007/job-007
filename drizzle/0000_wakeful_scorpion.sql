CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"logo_url" text,
	"ats_platform" text,
	"ats_slug" text,
	"size_bucket" text,
	"hq_location" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "job_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"raw" text,
	"city" text,
	"region" text,
	"country" text,
	"country_code" text,
	"lat" numeric,
	"lng" numeric,
	"is_remote" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"tag" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"source" text NOT NULL,
	"source_job_id" text NOT NULL,
	"external_url" text NOT NULL,
	"apply_url" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"title_normalized" text NOT NULL,
	"description_excerpt" text,
	"employment_type" text,
	"work_mode" text,
	"seniority" text,
	"job_function" text,
	"vertical" text,
	"salary_min" numeric,
	"salary_max" numeric,
	"salary_currency" text,
	"salary_period" text,
	"posted_at" timestamp with time zone NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"dedup_hash" text NOT NULL,
	CONSTRAINT "jobs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"last_fetched" integer DEFAULT 0 NOT NULL,
	"last_accepted" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "job_locations" ADD CONSTRAINT "job_locations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_ats_idx" ON "companies" USING btree ("ats_platform","ats_slug");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "job_locations_job_idx" ON "job_locations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_locations_city_idx" ON "job_locations" USING btree ("city");--> statement-breakpoint
CREATE INDEX "job_locations_country_idx" ON "job_locations" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "job_tags_unique_idx" ON "job_tags" USING btree ("job_id","tag");--> statement-breakpoint
CREATE INDEX "job_tags_tag_idx" ON "job_tags" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_id_idx" ON "jobs" USING btree ("source","source_job_id");--> statement-breakpoint
CREATE INDEX "jobs_dedup_idx" ON "jobs" USING btree ("dedup_hash");--> statement-breakpoint
CREATE INDEX "jobs_posted_idx" ON "jobs" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "jobs_company_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobs_facets_idx" ON "jobs" USING btree ("vertical","job_function","seniority");--> statement-breakpoint
CREATE INDEX "jobs_active_idx" ON "jobs" USING btree ("is_active","posted_at");