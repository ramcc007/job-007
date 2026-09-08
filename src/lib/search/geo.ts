import { CITIES } from "./catalogue";
import { parseLocation } from "@/lib/ingest/normalize/location";

/**
 * Works out which country a typed location refers to, so a search can be
 * routed to the sources that actually cover that market.
 *
 * "Gurugram" -> IN, "Gurgaon, India" -> IN, "Remote" -> null (no country,
 * meaning the search is not geographically constrained).
 */
export function resolveCountry(location: string | undefined): string | null {
  const text = location?.trim();
  if (!text) return null;

  const parsed = parseLocation(text);
  if (parsed.countryCode) return parsed.countryCode;

  // The gazetteer used by the parser is deliberately small; the suggestion
  // catalogue is far broader, so fall back to it before giving up.
  const needle = text.toLowerCase();
  const exact = CITIES.find((c) => c.city.toLowerCase() === needle);
  if (exact) return exact.country;

  const partial = CITIES.find((c) => c.city.toLowerCase().startsWith(needle));
  return partial?.country ?? null;
}

/** True when the location query means "anywhere" rather than a place. */
export function isAnywhere(location: string | undefined): boolean {
  return /^\s*(remote|anywhere|worldwide|global)\s*$/i.test(location ?? "");
}
