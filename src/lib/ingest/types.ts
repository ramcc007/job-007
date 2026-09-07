/** A listing as the source gave it to us, before any normalisation. */
export interface RawJob {
  source: string;
  sourceJobId: string;
  /** The posting on the employer's own site — where "Apply" sends people. */
  url: string;
  applyUrl?: string;
  title: string;

  companyName: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  atsPlatform?: string;
  atsSlug?: string;

  /** Every location string the source gave, unparsed. */
  locationsRaw: string[];
  /** Set when the source explicitly flags the role as remote. */
  isRemoteHint?: boolean;

  /**
   * Plain-text description, used only to classify and to cut a short
   * excerpt. Never stored in full — see the note on jobs.descriptionExcerpt.
   */
  descriptionText?: string;

  employmentTypeRaw?: string;
  departmentRaw?: string;

  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  salaryRaw?: string;

  postedAt?: Date;
  tags?: string[];
}

export interface CompanySeed {
  platform: string;
  slug: string;
  name?: string;
}

export interface FetchContext {
  /** Company slugs to crawl, already filtered to this adapter's platform. */
  seeds: CompanySeed[];
  /** Cap on listings per source, for quick test runs. */
  limit?: number;
  log: (msg: string) => void;
}

export interface SourceAdapter {
  name: string;
  kind: "ats" | "feed";
  /** True when the adapter needs credentials that aren't configured. */
  unavailableReason?: () => string | null;
  /** Throws on hard failure; the runner isolates each source. */
  fetch(ctx: FetchContext): Promise<RawJob[]>;
}
