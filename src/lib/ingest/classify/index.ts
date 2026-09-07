import { FUNCTIONS, SENIORITY, VERTICALS, type Category } from "./taxonomy";

export interface ClassifierInput {
  title: string;
  department?: string;
  description?: string;
  tags?: string[];
  companyName?: string;
}

export interface Classification {
  jobFunction: string | null;
  vertical: string | null;
  seniority: string;
}

/**
 * Field weights. The title is the single most reliable signal, so a match
 * there counts for far more than the same word buried in a description —
 * "we're a fast-growing sales-led company" should not make an engineering
 * role look like a sales role.
 */
const TITLE_MULTIPLIER = 6;
const DEPARTMENT_MULTIPLIER = 3;
const TAG_MULTIPLIER = 2;
const DESCRIPTION_MULTIPLIER = 1;

/** Below this, the evidence is too thin to claim a category. */
const MIN_CONFIDENT_SCORE = 4;

/** Only the opening of a description is scanned: it carries the role
 *  summary, while the tail is boilerplate about benefits and EEO. */
const DESCRIPTION_WINDOW = 2500;

function scoreCategory(category: Category, fields: [string, number][]): number {
  let total = 0;
  for (const rule of category.rules) {
    for (const [text, multiplier] of fields) {
      if (text && rule.re.test(text)) {
        total += rule.weight * multiplier;
        break; // one hit per rule; repetition isn't extra evidence
      }
    }
  }
  return total;
}

function bestMatch(
  categories: Category[],
  fields: [string, number][],
  minScore: number,
): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;

  for (const category of categories) {
    const score = scoreCategory(category, fields);
    if (score > 0 && (!best || score > best.score)) best = { id: category.id, score };
  }

  return best && best.score >= minScore ? best : null;
}

export function classify(input: ClassifierInput): Classification {
  const title = input.title ?? "";
  const department = input.department ?? "";
  const tags = (input.tags ?? []).join(" ");
  const description = (input.description ?? "").slice(0, DESCRIPTION_WINDOW);

  const fields: [string, number][] = [
    [title, TITLE_MULTIPLIER],
    [department, DEPARTMENT_MULTIPLIER],
    [tags, TAG_MULTIPLIER],
    [description, DESCRIPTION_MULTIPLIER],
  ];

  const jobFunction = bestMatch(FUNCTIONS, fields, MIN_CONFIDENT_SCORE);

  // Industry is a property of the employer, not the role, so the company
  // name and description carry it — the job title almost never does.
  const verticalFields: [string, number][] = [
    [input.companyName ?? "", TAG_MULTIPLIER],
    [department, DEPARTMENT_MULTIPLIER],
    [tags, TAG_MULTIPLIER],
    [description, DESCRIPTION_MULTIPLIER],
  ];
  const vertical = bestMatch(VERTICALS, verticalFields, MIN_CONFIDENT_SCORE);

  return {
    jobFunction: jobFunction?.id ?? null,
    vertical: vertical?.id ?? null,
    seniority: inferSeniority(title, description),
  };
}

/**
 * Seniority reads the title almost exclusively. SENIORITY is ordered most
 * senior first and the first hit wins, so "Senior Director" resolves to
 * Director rather than Senior.
 */
export function inferSeniority(title: string, description = ""): string {
  for (const level of SENIORITY) {
    for (const rule of level.rules) {
      if (rule.re.test(title)) return level.id;
    }
  }
  // Nothing in the title. Interns and grads are the only levels a
  // description states reliably enough to act on.
  for (const level of SENIORITY) {
    if (level.id !== "intern" && level.id !== "entry") continue;
    for (const rule of level.rules) {
      if (rule.re.test(description.slice(0, 600))) return level.id;
    }
  }
  return "mid";
}

export { FUNCTIONS, VERTICALS, SENIORITY } from "./taxonomy";
