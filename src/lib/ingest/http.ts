import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { brand } from "@/config/brand";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
    /** Start of the response body — APIs explain a rejection there. */
    readonly body?: string,
  ) {
    super(message ?? `HTTP ${status} for ${url}${body ? ` — ${body}` : ""}`);
    this.name = "HttpError";
  }
}

/** Enough of a body to carry an API's explanation, not enough to spam logs. */
const ERROR_BODY_CHARS = 300;

async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const text = (await response.text()).replace(/\s+/g, " ").trim();
    return text ? text.slice(0, ERROR_BODY_CHARS) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * When JOBRAIL_FIXTURES_DIR is set, requests are served from recorded JSON
 * on disk instead of the network. The adapters still run their real parsing
 * and mapping code — only the transport is swapped — so the pipeline can be
 * exercised end to end in CI, or anywhere outbound access is unavailable.
 *
 * A URL maps to a filename by host + path, with the query string ignored.
 */
export function fixtureNameFor(url: string): string {
  const parsed = new URL(url);
  return `${parsed.host}${parsed.pathname}`.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") + ".json";
}

async function readFixture<T>(url: string, dir: string): Promise<T> {
  const path = join(dir, fixtureNameFor(url));
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new HttpError(404, url, `no fixture at ${path}`);
    throw err;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET returning parsed JSON, with a timeout and bounded retries.
 *
 * Retries only on 429 and 5xx — a 404 means the company slug is wrong and
 * retrying just wastes the source's capacity. Honours Retry-After when the
 * server sends one, otherwise backs off exponentially.
 */
export async function getJson<T>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const fixturesDir = process.env.JOBRAIL_FIXTURES_DIR;
  if (fixturesDir) return readFixture<T>(url, fixturesDir);

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": brand.userAgent,
          Accept: "application/json",
          "Accept-Language": "en",
          ...opts.headers,
        },
      });

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2 ** attempt * 500;
        lastError = new HttpError(res.status, url, undefined, await readErrorBody(res));
        if (attempt < MAX_ATTEMPTS) {
          await sleep(waitMs);
          continue;
        }
        throw lastError;
      }

      if (!res.ok) throw new HttpError(res.status, url, undefined, await readErrorBody(res));
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isNetwork = err instanceof TypeError;
      if (attempt < MAX_ATTEMPTS && (isAbort || isNetwork)) {
        await sleep(2 ** attempt * 500);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`failed to fetch ${url}`);
}

/**
 * Runs tasks with bounded concurrency. Crawling a few hundred company
 * boards serially is slow, all at once is rude — this keeps a steady,
 * polite number of connections open per source.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]!, index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });

  await Promise.all(runners);
  return results;
}
