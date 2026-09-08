import { suggestCities, suggestTitles } from "@/lib/search/catalogue";

/**
 * Type-ahead for the two search fields.
 *
 * Suggestions are a convenience, never a constraint: anything typed is
 * searched whether or not it appears here, so an unusual job title or a town
 * missing from the catalogue still works.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("type");
  const q = params.get("q") ?? "";

  const suggestions = kind === "location" ? suggestCities(q) : suggestTitles(q);

  return Response.json(
    { suggestions },
    // Suggestions come from a static catalogue, so they cache well and cost
    // nothing to serve repeatedly.
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
