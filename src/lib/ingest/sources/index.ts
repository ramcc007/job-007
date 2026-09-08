import { ashby } from "./ats/ashby";
import { greenhouse } from "./ats/greenhouse";
import { lever } from "./ats/lever";
import { recruitee } from "./ats/recruitee";
import { smartrecruiters } from "./ats/smartrecruiters";
import { workable } from "./ats/workable";
import { adzuna } from "./feeds/adzuna";
import { arbeitnow } from "./feeds/arbeitnow";
import { himalayas } from "./feeds/himalayas";
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
  adzuna,
];

export const ADAPTERS_BY_NAME = new Map(ADAPTERS.map((a) => [a.name, a]));
