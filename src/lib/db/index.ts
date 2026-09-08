import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DEFAULT_URL = "postgresql://jobrail:jobrail@localhost:5432/jobrail";

/**
 * Supabase's shared connection pooler is sharded across regional endpoints
 * named `aws-0-<region>` and `aws-1-<region>`, and a project lives on
 * exactly one of them. Connecting to the wrong shard fails with
 *
 *     Tenant or user not found
 *
 * which is indistinguishable from a bad username, and the shard number is
 * not derivable from the project ref or region — it only appears in the
 * dashboard's copyable connection string.
 *
 * Rather than depend on whoever pasted the URL having picked the right one,
 * the sibling shard is treated as a fallback: if the configured host reports
 * the tenant missing, the same credentials are retried against the other.
 * Everything else about the URL, including the password, is left untouched.
 */
function candidateUrls(url: string): string[] {
  const match = /^(.*@)aws-([01])-([a-z0-9-]+\.pooler\.supabase\.com)(.*)$/.exec(url);
  if (!match) return [url];
  const [, prefix, shard, suffix, tail] = match;
  const sibling = shard === "0" ? "1" : "0";
  return [url, `${prefix}aws-${sibling}-${suffix}${tail}`];
}

const TENANT_NOT_FOUND = /tenant or user not found/i;

function createClient(url: string) {
  return postgres(url, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
  });
}

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Next dev reloads modules on every edit, and serverless functions reuse the
 * module across invocations; caching on globalThis keeps one pool per process
 * instead of leaking a new one each time.
 */
const globalForDb = globalThis as unknown as {
  _dbPromise?: Promise<{ db: Db; client: ReturnType<typeof postgres> }>;
};

async function connect(): Promise<{ db: Db; client: ReturnType<typeof postgres> }> {
  const configured = process.env.DATABASE_URL ?? DEFAULT_URL;
  const candidates = candidateUrls(configured);
  let lastError: unknown;

  for (const [index, url] of candidates.entries()) {
    const client = createClient(url);
    try {
      await client`select 1`;
      if (index > 0) {
        console.warn(
          "DATABASE_URL points at the wrong Supabase pooler shard; " +
            "connected via the sibling endpoint instead. Update the variable to silence this.",
        );
      }
      return { db: drizzle(client, { schema }), client };
    } catch (err) {
      lastError = err;
      await client.end({ timeout: 5 }).catch(() => {});
      // Only a missing tenant is worth retrying elsewhere. A bad password or
      // an unreachable network means the sibling shard would fail identically.
      if (!TENANT_NOT_FOUND.test(String((err as Error)?.message ?? err))) throw err;
    }
  }

  throw lastError ?? new Error("could not connect to the database");
}

function connection() {
  globalForDb._dbPromise ??= connect().catch((err) => {
    // Don't cache a failed attempt: a cold start during a database blip
    // would otherwise poison every later request in that process.
    globalForDb._dbPromise = undefined;
    throw err;
  });
  return globalForDb._dbPromise;
}

/** The database handle. Async because the working endpoint is resolved once, lazily. */
export async function getDb(): Promise<Db> {
  return (await connection()).db;
}

/** Closes the pool. Used by the CLI so a crawl exits instead of hanging. */
export async function closeDb(): Promise<void> {
  const existing = globalForDb._dbPromise;
  if (!existing) return;
  globalForDb._dbPromise = undefined;
  await existing.then(({ client }) => client.end({ timeout: 5 })).catch(() => {});
}

export { schema, candidateUrls };
