import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/ingest/auth";
import { loadSeeds } from "@/lib/ingest/seeds";
import { runIngest } from "@/lib/ingest/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Crawl trigger for the scheduled workflow.
 *
 * Guarded so a crawl can't be started by anyone who finds the URL —
 * ingestion is expensive and hits third-party APIs under our name. Accepts
 * either the long-lived INGEST_SECRET or a short-lived signed token; see
 * lib/ingest/auth.ts.
 */
export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "INGEST_SECRET is not configured" }, { status: 503 });
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const only = url.searchParams.get("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const summary = await runIngest({
      only,
      seeds: await loadSeeds(),
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json({
      ok: true,
      durationMs: summary.durationMs,
      expired: summary.expired,
      sources: summary.reports.map((r) => ({
        source: r.source, status: r.status, fetched: r.fetched, accepted: r.accepted,
        inserted: r.inserted, updated: r.updated, deactivated: r.deactivated,
        ...(r.message ? { message: r.message } : {}),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
