import { brand } from "@/config/brand";
import { decodeEntities, htmlToText } from "@/lib/ingest/html";
import type { FetchContext, RawJob, SourceAdapter } from "@/lib/ingest/types";
import { loadFeeds, type FeedDefinition } from "@/lib/ingest/feeds";

/**
 * Generic RSS/Atom reader, driven by data/feeds.yml.
 *
 * This is the extensible answer to "add another board". A site that
 * publishes an RSS feed is explicitly offering it for syndication, which
 * makes consuming it both lawful and stable — unlike scraping a site that
 * publishes no feed and forbids automated access. Adding a board is a line
 * of YAML, not a new adapter.
 */

/** Minimal feed parsing: a dependency-free reader for a well-formed document. */
function extractTag(block: string, tag: string): string | undefined {
  const match =
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i").exec(block) ??
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return match ? decodeEntities(match[1]!.trim()) : undefined;
}

function extractLink(block: string): string | undefined {
  const plain = extractTag(block, "link");
  if (plain && /^https?:/i.test(plain)) return plain;
  // Atom puts the URL in an attribute rather than the element body.
  const href = /<link[^>]*\shref=["']([^"']+)["']/i.exec(block);
  return href?.[1];
}

function parseItems(xml: string): string[] {
  const items = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi);
  return items ?? [];
}

async function readFeed(feed: FeedDefinition, log: (msg: string) => void): Promise<RawJob[]> {
  let xml: string;
  try {
    const response = await fetch(feed.url, {
      headers: { "User-Agent": brand.userAgent, Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    xml = await response.text();
  } catch (err) {
    log(`rss ${feed.name}: ${String(err)}`);
    return [];
  }

  return parseItems(xml).map((block, index) => {
    const title = extractTag(block, "title") ?? "";
    const link = extractLink(block) ?? "";
    const description = extractTag(block, "description") ?? extractTag(block, "summary") ?? extractTag(block, "content");
    const date = extractTag(block, "pubDate") ?? extractTag(block, "published") ?? extractTag(block, "updated");

    // Many job feeds encode the employer as "Role at Company" in the title
    // and provide no separate field.
    const split = /^(.*?)\s+(?:at|@|-)\s+(.+)$/.exec(title);

    return {
      source: "rss",
      sourceJobId: extractTag(block, "guid") ?? `${feed.name}:${index}:${link}`,
      url: link,
      title: split?.[1]?.trim() || title,
      companyName: feed.company ?? split?.[2]?.trim() ?? feed.name,
      locationsRaw: [
        extractTag(block, "location"),
        extractTag(block, "job:location"),
        feed.defaultLocation,
      ].filter((v): v is string => Boolean(v)),
      isRemoteHint: feed.remote,
      descriptionText: htmlToText(description),
      tags: [feed.name],
      postedAt: date ? new Date(date) : undefined,
    } satisfies RawJob;
  }).filter((job) => job.title && job.url);
}

export const rss: SourceAdapter = {
  name: "rss",
  kind: "feed",

  async fetch({ limit, query, log }: FetchContext): Promise<RawJob[]> {
    const feeds = await loadFeeds();
    const relevant = feeds.filter(
      (feed) => !feed.countries || !query?.country || feed.countries.includes(query.country),
    );
    if (relevant.length === 0) return [];

    const batches = await Promise.all(relevant.map((feed) => readFeed(feed, log)));
    const out = batches.flat();
    return limit ? out.slice(0, limit) : out;
  },
};
