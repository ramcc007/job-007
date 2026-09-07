/**
 * Offline gazetteer. Deliberately not a geocoding API call: ingestion runs
 * over tens of thousands of rows, and a network round trip per row would
 * dominate crawl time and cost. This resolves the common cases; anything
 * unmatched keeps its raw string and is still searchable by text.
 */

/** ISO-3166 alpha-2 -> display name, plus the aliases sources actually use. */
export const COUNTRIES: { code: string; name: string; aliases: string[] }[] = [
  { code: "US", name: "United States", aliases: ["usa", "u.s.", "u.s.a.", "united states of america", "america"] },
  { code: "GB", name: "United Kingdom", aliases: ["uk", "u.k.", "england", "scotland", "wales", "northern ireland", "great britain", "britain"] },
  { code: "IN", name: "India", aliases: ["bharat"] },
  { code: "CA", name: "Canada", aliases: [] },
  { code: "AU", name: "Australia", aliases: [] },
  { code: "DE", name: "Germany", aliases: ["deutschland"] },
  { code: "FR", name: "France", aliases: [] },
  { code: "NL", name: "Netherlands", aliases: ["holland", "the netherlands"] },
  { code: "IE", name: "Ireland", aliases: [] },
  { code: "ES", name: "Spain", aliases: ["españa"] },
  { code: "IT", name: "Italy", aliases: ["italia"] },
  { code: "PT", name: "Portugal", aliases: [] },
  { code: "PL", name: "Poland", aliases: ["polska"] },
  { code: "SE", name: "Sweden", aliases: [] },
  { code: "NO", name: "Norway", aliases: [] },
  { code: "DK", name: "Denmark", aliases: [] },
  { code: "FI", name: "Finland", aliases: [] },
  { code: "CH", name: "Switzerland", aliases: [] },
  { code: "AT", name: "Austria", aliases: [] },
  { code: "BE", name: "Belgium", aliases: [] },
  { code: "CZ", name: "Czechia", aliases: ["czech republic"] },
  { code: "RO", name: "Romania", aliases: [] },
  { code: "GR", name: "Greece", aliases: [] },
  { code: "SG", name: "Singapore", aliases: [] },
  { code: "JP", name: "Japan", aliases: [] },
  { code: "CN", name: "China", aliases: [] },
  { code: "HK", name: "Hong Kong", aliases: [] },
  { code: "KR", name: "South Korea", aliases: ["korea"] },
  { code: "AE", name: "United Arab Emirates", aliases: ["uae"] },
  { code: "SA", name: "Saudi Arabia", aliases: [] },
  { code: "IL", name: "Israel", aliases: [] },
  { code: "ZA", name: "South Africa", aliases: [] },
  { code: "NG", name: "Nigeria", aliases: [] },
  { code: "KE", name: "Kenya", aliases: [] },
  { code: "EG", name: "Egypt", aliases: [] },
  { code: "BR", name: "Brazil", aliases: ["brasil"] },
  { code: "MX", name: "Mexico", aliases: [] },
  { code: "AR", name: "Argentina", aliases: [] },
  { code: "CL", name: "Chile", aliases: [] },
  { code: "CO", name: "Colombia", aliases: [] },
  { code: "NZ", name: "New Zealand", aliases: [] },
  { code: "PH", name: "Philippines", aliases: [] },
  { code: "ID", name: "Indonesia", aliases: [] },
  { code: "MY", name: "Malaysia", aliases: [] },
  { code: "TH", name: "Thailand", aliases: [] },
  { code: "VN", name: "Vietnam", aliases: [] },
  { code: "PK", name: "Pakistan", aliases: [] },
  { code: "BD", name: "Bangladesh", aliases: [] },
  { code: "LK", name: "Sri Lanka", aliases: [] },
  { code: "TR", name: "Turkey", aliases: ["türkiye"] },
  { code: "UA", name: "Ukraine", aliases: [] },
  { code: "HU", name: "Hungary", aliases: [] },
  { code: "BG", name: "Bulgaria", aliases: [] },
  { code: "HR", name: "Croatia", aliases: [] },
  { code: "RS", name: "Serbia", aliases: [] },
  { code: "EE", name: "Estonia", aliases: [] },
  { code: "LV", name: "Latvia", aliases: [] },
  { code: "LT", name: "Lithuania", aliases: [] },
];

/** Major cities -> country, for strings that omit the country entirely. */
export const CITY_TO_COUNTRY: Record<string, string> = {
  // India
  bengaluru: "IN", bangalore: "IN", mumbai: "IN", "navi mumbai": "IN", delhi: "IN",
  "new delhi": "IN", gurgaon: "IN", gurugram: "IN", noida: "IN", hyderabad: "IN",
  chennai: "IN", pune: "IN", kolkata: "IN", ahmedabad: "IN", jaipur: "IN",
  chandigarh: "IN", kochi: "IN", coimbatore: "IN", indore: "IN", nagpur: "IN",
  thiruvananthapuram: "IN", bhubaneswar: "IN", lucknow: "IN", vadodara: "IN", surat: "IN",
  // United States
  "san francisco": "US", "new york": "US", "new york city": "US", brooklyn: "US",
  seattle: "US", austin: "US", boston: "US", chicago: "US", denver: "US",
  "los angeles": "US", "san diego": "US", "san jose": "US", "palo alto": "US",
  "mountain view": "US", sunnyvale: "US", "menlo park": "US", cupertino: "US",
  atlanta: "US", miami: "US", dallas: "US", houston: "US", phoenix: "US",
  philadelphia: "US", portland: "US", "washington": "US", "washington dc": "US",
  "salt lake city": "US", nashville: "US", minneapolis: "US", detroit: "US",
  pittsburgh: "US", "san antonio": "US", charlotte: "US", raleigh: "US",
  // Canada
  toronto: "CA", vancouver: "CA", montreal: "CA", montréal: "CA", ottawa: "CA",
  calgary: "CA", edmonton: "CA", waterloo: "CA", "quebec city": "CA",
  // UK & Ireland
  london: "GB", manchester: "GB", birmingham: "GB", edinburgh: "GB", glasgow: "GB",
  bristol: "GB", leeds: "GB", cambridge: "GB", oxford: "GB", brighton: "GB",
  belfast: "GB", cardiff: "GB", dublin: "IE", cork: "IE",
  // Europe
  berlin: "DE", munich: "DE", münchen: "DE", hamburg: "DE", frankfurt: "DE",
  cologne: "DE", köln: "DE", stuttgart: "DE", düsseldorf: "DE", leipzig: "DE",
  paris: "FR", lyon: "FR", toulouse: "FR", marseille: "FR", bordeaux: "FR",
  amsterdam: "NL", rotterdam: "NL", utrecht: "NL", eindhoven: "NL",
  madrid: "ES", barcelona: "ES", valencia: "ES", málaga: "ES", malaga: "ES",
  lisbon: "PT", lisboa: "PT", porto: "PT",
  milan: "IT", milano: "IT", rome: "IT", roma: "IT", turin: "IT",
  warsaw: "PL", krakow: "PL", kraków: "PL", wrocław: "PL", wroclaw: "PL", gdansk: "PL",
  stockholm: "SE", gothenburg: "SE", oslo: "NO", copenhagen: "DK", helsinki: "FI",
  zurich: "CH", zürich: "CH", geneva: "CH", basel: "CH", lausanne: "CH",
  vienna: "AT", wien: "AT", brussels: "BE", antwerp: "BE",
  prague: "CZ", praha: "CZ", brno: "CZ", bucharest: "RO", "cluj-napoca": "RO",
  athens: "GR", budapest: "HU", sofia: "BG", zagreb: "HR", belgrade: "RS",
  tallinn: "EE", riga: "LV", vilnius: "LT", kyiv: "UA", kiev: "UA",
  // Asia-Pacific & Middle East
  singapore: "SG", tokyo: "JP", osaka: "JP", kyoto: "JP",
  beijing: "CN", shanghai: "CN", shenzhen: "CN", "hong kong": "HK",
  seoul: "KR", taipei: "TW", dubai: "AE", "abu dhabi": "AE", riyadh: "SA",
  "tel aviv": "IL", jerusalem: "IL", doha: "QA",
  sydney: "AU", melbourne: "AU", brisbane: "AU", perth: "AU", adelaide: "AU",
  auckland: "NZ", wellington: "NZ",
  manila: "PH", cebu: "PH", jakarta: "ID", "kuala lumpur": "MY", bangkok: "TH",
  "ho chi minh city": "VN", hanoi: "VN", karachi: "PK", lahore: "PK",
  dhaka: "BD", colombo: "LK",
  // Africa & Latin America
  "cape town": "ZA", johannesburg: "ZA", lagos: "NG", nairobi: "KE", cairo: "EG",
  "são paulo": "BR", "sao paulo": "BR", "rio de janeiro": "BR",
  "mexico city": "MX", guadalajara: "MX", "buenos aires": "AR",
  santiago: "CL", bogotá: "CO", bogota: "CO", lima: "PE",
  istanbul: "TR", ankara: "TR",
};

/** US state and Canadian province codes, to resolve "Austin, TX". */
export const US_STATES = new Set([
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia","ks",
  "ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj","nm","ny",
  "nc","nd","oh","ok","or","pa","ri","sc","sd","tn","tx","ut","vt","va","wa","wv",
  "wi","wy","dc",
]);

export const CA_PROVINCES = new Set(["on","qc","bc","ab","mb","sk","ns","nb","nl","pe","nt","yt","nu"]);
