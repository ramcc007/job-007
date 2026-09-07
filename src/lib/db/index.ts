import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ?? "postgresql://jobrail:jobrail@localhost:5432/jobrail";

/**
 * Next dev reloads modules on every edit; without caching the client on
 * globalThis each reload leaks a fresh connection pool until Postgres
 * refuses new connections.
 */
const globalForDb = globalThis as unknown as { _sql?: ReturnType<typeof postgres> };

const client =
  globalForDb._sql ??
  postgres(url, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    // Supabase's pooler doesn't support prepared statements.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalForDb._sql = client;

export const db = drizzle(client, { schema });
export { schema, client as sql };
