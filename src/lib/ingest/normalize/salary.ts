export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: string | null;
}

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "$": "USD", "£": "GBP", "€": "EUR", "₹": "INR", "¥": "JPY",
  "₽": "RUB", "R$": "BRL", "C$": "CAD", "A$": "AUD", "S$": "SGD", "₩": "KRW",
  "CHF": "CHF", "kr": "SEK", "zł": "PLN", "₺": "TRY", "R": "ZAR",
};

const CURRENCY_CODES = new Set([
  "USD","EUR","GBP","INR","CAD","AUD","SGD","CHF","SEK","NOK","DKK","PLN","JPY",
  "CNY","HKD","NZD","ZAR","BRL","MXN","AED","ILS","TRY","RON","CZK","HUF","KRW",
]);

const PERIOD_PATTERNS: [RegExp, string][] = [
  [/\b(per\s+hour|hourly|\/\s*hr|\/\s*hour|an hour|p\/h)\b/i, "hour"],
  [/\b(per\s+day|daily|\/\s*day|day rate)\b/i, "day"],
  [/\b(per\s+week|weekly|\/\s*week)\b/i, "week"],
  [/\b(per\s+month|monthly|\/\s*mo(nth)?|pm)\b/i, "month"],
  [/\b(per\s+annum|per\s+year|annually|annual|yearly|\/\s*yr|\/\s*year|pa|p\.a\.)\b/i, "year"],
];

/** Amount tokens: 120k, 1.2m, 15 lakh/lakhs/lac, 1.5 crore, or plain digits. */
const AMOUNT = /(\d[\d,.\s]*)\s*(k|m|mn|lakhs?|lacs?|crores?|cr)?\b/gi;

function scaleFor(suffix: string | undefined): number {
  switch ((suffix ?? "").toLowerCase()) {
    case "k": return 1_000;
    case "m":
    case "mn": return 1_000_000;
    case "lakh": case "lakhs": case "lac": case "lacs": return 100_000;
    case "crore": case "crores": case "cr": return 10_000_000;
    default: return 1;
  }
}

function toNumber(digits: string, suffix?: string): number | null {
  // Indian grouping ("15,00,000") and Western ("1,500,000") both reduce to
  // the same thing once separators are dropped; a lone dot stays decimal.
  const cleaned = digits.replace(/[,\s]/g, "");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return value * scaleFor(suffix);
}

function detectCurrency(text: string): string | null {
  const code = /\b(USD|EUR|GBP|INR|CAD|AUD|SGD|CHF|SEK|NOK|DKK|PLN|JPY|CNY|HKD|NZD|ZAR|BRL|MXN|AED|ILS|TRY|RON|CZK|HUF|KRW)\b/i.exec(text);
  if (code && CURRENCY_CODES.has(code[1]!.toUpperCase())) return code[1]!.toUpperCase();

  for (const symbol of ["R$", "C$", "A$", "S$", "₹", "£", "€", "¥", "₩", "₺", "zł", "$"]) {
    if (text.includes(symbol)) return SYMBOL_TO_CURRENCY[symbol]!;
  }
  if (/\brs\.?\b/i.test(text)) return "INR";
  return null;
}

function detectPeriod(text: string): string | null {
  for (const [pattern, period] of PERIOD_PATTERNS) {
    if (pattern.test(text)) return period;
  }
  return null;
}

/**
 * Best-effort parse of a free-text pay string such as
 * "$120,000 - $150,000 a year" or "₹15,00,000 – ₹25,00,000 per annum".
 *
 * Returns nulls rather than guessing when the text has no numbers — an
 * absent salary is honest, a fabricated one is not.
 */
export function parseSalaryText(input: string | null | undefined): ParsedSalary {
  const empty: ParsedSalary = { min: null, max: null, currency: null, period: null };
  if (!input) return empty;

  const text = input.replace(/ /g, " ").trim();
  if (!text) return empty;

  const amounts: number[] = [];
  AMOUNT.lastIndex = 0;
  for (const match of text.matchAll(AMOUNT)) {
    // Skip bare years ("2025") and other non-money integers.
    const value = toNumber(match[1]!, match[2]);
    if (value === null) continue;
    if (!match[2] && value >= 1900 && value <= 2100 && !/[.,]/.test(match[1]!)) continue;
    amounts.push(value);
  }
  if (amounts.length === 0) return empty;

  const currency = detectCurrency(text);
  let period = detectPeriod(text);

  let min = amounts[0]!;
  let max = amounts.length > 1 ? amounts[1]! : amounts[0]!;
  if (min > max) [min, max] = [max, min];

  // Infer the period from magnitude when the text didn't say. An annual
  // figure below ~2,000 in any major currency is really an hourly rate.
  if (!period) {
    if (max < 500) period = "hour";
    else if (max < 5_000) period = "month";
    else period = "year";
  }

  return { min, max, currency, period };
}

/**
 * Reconciles structured numbers from an adapter with anything parseable
 * out of the free-text field. Structured values always win.
 */
export function resolveSalary(job: {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  salaryRaw?: string;
}): ParsedSalary {
  const fromText = parseSalaryText(job.salaryRaw);

  const min = job.salaryMin ?? fromText.min;
  const max = job.salaryMax ?? fromText.max;
  if (min == null && max == null) {
    return { min: null, max: null, currency: null, period: null };
  }

  return {
    min: min ?? null,
    max: max ?? min ?? null,
    currency: (job.salaryCurrency ?? fromText.currency ?? null)?.toUpperCase() ?? null,
    period: job.salaryPeriod ?? fromText.period ?? "year",
  };
}
