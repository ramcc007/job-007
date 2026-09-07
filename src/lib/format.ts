const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", CNY: "¥",
  CAD: "CA$", AUD: "A$", SGD: "S$", NZD: "NZ$", CHF: "CHF ", SEK: "kr ",
  NOK: "kr ", DKK: "kr ", PLN: "zł ", BRL: "R$", MXN: "MX$", ZAR: "R",
  AED: "AED ", ILS: "₪", TRY: "₺", KRW: "₩", HKD: "HK$",
};

const PERIOD_SUFFIX: Record<string, string> = {
  year: "/yr", month: "/mo", week: "/wk", day: "/day", hour: "/hr",
};

/** 1_500_000 -> "1.5M", 85_000 -> "85K". Indian amounts stay readable
 *  because lakh/crore figures are large and compress the same way. */
function compact(value: number): string {
  if (value >= 10_000_000) return `${trimZero(value / 1_000_000)}M`;
  if (value >= 1_000_000) return `${trimZero(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trimZero(value / 1_000)}K`;
  return String(Math.round(value));
}

const trimZero = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

export function formatSalary(job: {
  salaryMin: string | number | null;
  salaryMax: string | number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}): string | null {
  const min = job.salaryMin == null ? null : Number(job.salaryMin);
  const max = job.salaryMax == null ? null : Number(job.salaryMax);
  if (min == null && max == null) return null;

  const symbol = CURRENCY_SYMBOLS[job.salaryCurrency ?? ""] ?? (job.salaryCurrency ? `${job.salaryCurrency} ` : "");
  const suffix = PERIOD_SUFFIX[job.salaryPeriod ?? "year"] ?? "";

  // Hourly and daily figures are small enough to show in full.
  const render = (n: number) => (n < 1000 ? String(Math.round(n)) : compact(n));

  if (min != null && max != null && min !== max) return `${symbol}${render(min)}–${symbol}${render(max)}${suffix}`;
  return `${symbol}${render((min ?? max)!)}${suffix}`;
}

export function relativeDate(date: Date | string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function isoDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  try {
    return REGION_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}
