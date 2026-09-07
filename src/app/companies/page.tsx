import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, jobs } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Companies hiring",
  description: "Employers with open roles, taken straight from their own careers pages.",
};

export default async function CompaniesPage() {
  const rows = await db
    .select({
      slug: companies.slug,
      name: companies.name,
      atsPlatform: companies.atsPlatform,
      openRoles: sql<number>`count(${jobs.id})::int`,
    })
    .from(companies)
    .innerJoin(jobs, eq(jobs.companyId, companies.id))
    .where(eq(jobs.isActive, true))
    .groupBy(companies.id, companies.slug, companies.name, companies.atsPlatform)
    .orderBy(desc(sql`count(${jobs.id})`))
    .limit(200);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-fg">
        Companies hiring
      </h1>
      <p className="mt-1.5 text-sm text-fg-muted">
        {rows.length} employers with open roles right now.
      </p>

      <ul className="mt-6 divide-y divide-line-soft overflow-hidden rounded-lg border border-line bg-surface">
        {rows.map((row) => (
          <li key={row.slug}>
            <Link
              href={`/companies/${row.slug}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-hover"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-fg">{row.name}</span>
                {row.atsPlatform ? (
                  <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-fg-faint">
                    {row.atsPlatform}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-[family-name:var(--font-mono)] text-[12px] text-fg-muted">
                {row.openRoles}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
