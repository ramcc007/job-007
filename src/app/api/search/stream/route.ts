import { liveSearch, type SearchEvent } from "@/lib/search/live";
import { loadSeeds } from "@/lib/ingest/seeds";

export const dynamic = "force-dynamic";
/** Vercel's Hobby ceiling. The search budget stays comfortably inside it. */
export const maxDuration = 60;

const SEARCH_BUDGET_MS = 45_000;

/**
 * Streams an on-demand search as Server-Sent Events.
 *
 * Nothing is stored, so the page cannot render a result set in one shot;
 * instead each source reports as it finishes and matches are pushed to the
 * browser immediately. That keeps a 20-30 second search legible rather than
 * looking like a hang.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = {
    text: params.get("q")?.slice(0, 120) || undefined,
    location: params.get("l")?.slice(0, 80) || undefined,
  };

  if (!query.text && !query.location) {
    return Response.json({ error: "provide q and/or l" }, { status: 400 });
  }

  const seeds = await loadSeeds();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SearchEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of liveSearch({
          query,
          seeds,
          budgetMs: SEARCH_BUDGET_MS,
          signal: request.signal,
        })) {
          if (request.signal.aborted) break;
          send(event);
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Without this some proxies buffer the whole stream and the progress
      // updates arrive all at once at the end, defeating the point.
      "X-Accel-Buffering": "no",
    },
  });
}
