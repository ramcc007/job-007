-- Fuzzy company/title matching ("gogle" -> "Google") and unaccented search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Weighted full-text vector, maintained by Postgres itself so it can never
-- drift from the row. A > title, B > company-ish text, C > excerpt.
ALTER TABLE jobs DROP COLUMN IF EXISTS search_vector;
ALTER TABLE jobs ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title_normalized, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description_excerpt, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS jobs_search_idx ON jobs USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS jobs_title_trgm_idx ON jobs USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS companies_name_trgm_idx ON companies USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS job_locations_city_trgm_idx ON job_locations USING GIN (city gin_trgm_ops);
