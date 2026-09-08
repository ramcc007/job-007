import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/ingest/auth";
import { loadSeeds } from "@/lib/ingest/seeds";
import { runIngest } from "@/lib/ingest/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel's scheduler calls crons over GET. It strips client-supplied
 * `x-vercel-*` headers from inbound requests, so the header's presence is a
 * trustworthy signal that the call came from the platform rather than the
 * open internet. When CRON_SECRET is configured, Vercel also sends it as a
 * bearer token and that is checked too.
 */
export async function GET(request: Request) {
  const isCron = request.headers.get("x-vercel-cron") !== null;
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!isCron || (cronSecret && bearer !== cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runCrawl(request);
}

/**
 * Manual and CI-driven crawl trigger.
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

  return runCrawl(request);
}

async function runCrawl(request: Request) {
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
