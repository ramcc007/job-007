import { CA_PROVINCES, CITY_TO_COUNTRY, COUNTRIES, US_STATES } from "./geo-data";

export interface ParsedLocation {
  raw: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  isRemote: boolean;
}

const REMOTE_MARKERS = /\b(remote|anywhere|worldwide|work from home|wfh|distributed|virtual)\b/i;
/** "Remote - US", "Remote (EMEA)", "Remote, India" all carry a real region. */
const REMOTE_PREFIX = /^\s*(?:fully\s+)?remote\s*(?:[-–—:,/|]|\()\s*/i;

const byAlias = new Map<string, { code: string; name: string }>();
for (const country of COUNTRIES) {
  byAlias.set(country.name.toLowerCase(), country);
  byAlias.set(country.code.toLowerCase(), country);
  for (const alias of country.aliases) byAlias.set(alias, country);
}

const strip = (s: string) => s.trim().replace(/[.]$/, "").trim();
const lower = (s: string) => strip(s).toLowerCase();

function countryFor(code: string | null): string | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.name ?? null;
}

/**
 * Parses one location string into city / region / country.
 *
 * Sources are wildly inconsistent here — "Remote", "London, UK",
 * "Austin, TX", "Bengaluru", "Remote - EMEA", "Worldwide" all appear. The
 * strategy is: pull the remote signal out first, then read the remaining
 * comma-separated parts right to left, since the most general component
 * (country) is conventionally last.
 */
export function parseLocation(input: string): ParsedLocation {
  const raw = strip(input);
  if (!raw) {
    return { raw: input, city: null, region: null, country: null, countryCode: null, isRemote: false };
  }

  const isRemote = REMOTE_MARKERS.test(raw);

  // "Remote - United States" -> reparse "United States", keeping the flag.
  let working = raw.replace(REMOTE_PREFIX, "").replace(/\)$/, "").trim();
  if (/^(remote|anywhere|worldwide|global|distributed)$/i.test(working) || !working) {
    return { raw, city: null, region: null, country: null, countryCode: null, isRemote: true };
  }
  // Drop a trailing standalone "(Remote)" / ", Remote".
  working = working.replace(/[,(\-–—/|]\s*(?:fully\s+)?remote\s*\)?\s*$/i, "").trim();

  const parts = working.split(/\s*[,/|]\s*/).map(strip).filter(Boolean);
  if (parts.length === 0) {
    return { raw, city: null, region: null, country: null, countryCode: null, isRemote };
  }

  let countryCode: string | null = null;
  let region: string | null = null;
  let city: string | null = null;

  // Right-most part that names a country wins.
  for (let i = parts.length - 1; i >= 0; i--) {
    const token = lower(parts[i]!);
    const hit = byAlias.get(token);
    if (!hit) continue;

    // Several US state and Canadian province codes collide with ISO country
    // codes — CA, IN, DE, MA, ME, PA. With a city in front, "San Francisco,
    // CA" means California far more often than Canada, so the city decides.
    if (i > 0 && token.length === 2 && (US_STATES.has(token) || CA_PROVINCES.has(token))) {
      const cityCountry = CITY_TO_COUNTRY[lower(parts[0]!)];
      if (cityCountry !== hit.code) {
        countryCode = cityCountry ?? (US_STATES.has(token) ? "US" : "CA");
        region = parts[i]!.toUpperCase();
        city = parts[0]!;
        break;
      }
      // The city agrees with the country reading ("Berlin, DE") — fall through.
    }

    countryCode = hit.code;
    const rest = parts.slice(0, i);
    if (rest.length >= 2) {
      city = rest[0]!;
      region = rest[rest.length - 1]!;
    } else if (rest.length === 1) {
      city = rest[0]!;
    }
    break;
  }

  if (!countryCode) {
    // No country named. Try a state/province code, then the city table.
    const last = lower(parts[parts.length - 1]!);
    if (US_STATES.has(last) && parts.length >= 2) {
      countryCode = "US";
      region = parts[parts.length - 1]!.toUpperCase();
      city = parts[0]!;
    } else if (CA_PROVINCES.has(last) && parts.length >= 2) {
      countryCode = "CA";
      region = parts[parts.length - 1]!.toUpperCase();
      city = parts[0]!;
    } else {
      city = parts[0]!;
      if (parts.length > 1) region = parts[parts.length - 1]!;
      countryCode = CITY_TO_COUNTRY[lower(city)] ?? null;
    }
  }

  if (!city && parts.length === 1 && !byAlias.get(lower(parts[0]!))) city = parts[0]!;
  if (city && CITY_TO_COUNTRY[lower(city)] && !countryCode) countryCode = CITY_TO_COUNTRY[lower(city)]!;
  if (city && region && lower(city) === lower(region)) region = null;

  return { raw, city, region, country: countryFor(countryCode), countryCode, isRemote };
}

/** Parses every location a posting listed, de-duplicating identical results. */
export function parseLocations(inputs: readonly string[], remoteHint?: boolean): ParsedLocation[] {
  const seen = new Set<string>();
  const out: ParsedLocation[] = [];

  for (const input of inputs) {
    const parsed = parseLocation(input);
    if (remoteHint) parsed.isRemote = true;
    const key = `${parsed.city ?? ""}|${parsed.region ?? ""}|${parsed.countryCode ?? ""}|${parsed.isRemote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }

  if (out.length === 0 && remoteHint) {
    out.push({ raw: "Remote", city: null, region: null, country: null, countryCode: null, isRemote: true });
  }
  return out;
}
