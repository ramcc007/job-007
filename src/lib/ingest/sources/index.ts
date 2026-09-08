import { ashby } from "./ats/ashby";
import { greenhouse } from "./ats/greenhouse";
import { lever } from "./ats/lever";
import { recruitee } from "./ats/recruitee";
import { smartrecruiters } from "./ats/smartrecruiters";
import { workable } from "./ats/workable";
import { adzuna } from "./feeds/adzuna";
import { arbeitnow } from "./feeds/arbeitnow";
import { careerjet } from "./feeds/careerjet";
import { himalayas } from "./feeds/himalayas";
import { jooble } from "./feeds/jooble";
import { jsearch } from "./feeds/jsearch";
import { rss } from "./feeds/rss";
import { jobicy } from "./feeds/jobicy";
import { themuse } from "./feeds/themuse";
import { remoteok } from "./feeds/remoteok";
import { remotive } from "./feeds/remotive";
import type { SourceAdapter } from "../types";

/**
 * Every source the crawler knows about. Adding one means writing an
 * adapter and adding it here — nothing else in the pipeline changes.
 */
export const ADAPTERS: readonly SourceAdapter[] = [
  greenhouse,
  lever,
  ashby,
  workable,
  smartrecruiters,
  recruitee,
  remotive,
  remoteok,
  arbeitnow,
  jobicy,
  themuse,
  himalayas,
  rss,
  // Licensed aggregators. Each self-disables without its key, and each is
  // the lawful route to inventory that Indeed, LinkedIn, Glassdoor and the
  // national boards do not expose directly.
  adzuna,
  jsearch,
  jooble,
  careerjet,
];

export const ADAPTERS_BY_NAME = new Map(ADAPTERS.map((a) => [a.name, a]));
