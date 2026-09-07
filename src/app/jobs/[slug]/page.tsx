import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JobDetail } from "@/components/job-detail";
import { countryName, formatSalary } from "@/lib/format";
import { getJobBySlug } from "@/lib/search/query";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return { title: "Job not found" };

  const where = job.locationLabel ?? "";
  const title = `${job.title} at ${job.companyName}${where ? ` — ${where}` : ""}`;

  return {
    title,
    description:
      job.descriptionExcerpt ??
      `${job.title} at ${job.companyName}${where ? ` in ${where}` : ""}. Apply directly on the company's careers page.`,
    alternates: { canonical: `/jobs/${job.slug}` },
    openGraph: { title, type: "article", publishedTime: new Date(job.postedAt).toISOString() },
    // A filled or withdrawn role shouldn't stay in the index.
    robots: job.isActive ? { index: true, follow: true } : { index: false, follow: true },
  };
}

const EMPLOYMENT_TYPE_SCHEMA: Record<string, string> = {
  full_time: "FULL_TIME", part_time: "PART_TIME", contract: "CONTRACTOR",
  internship: "INTERN", temporary: "TEMPORARY",
};

const PERIOD_SCHEMA: Record<string, string> = {
  year: "YEAR", month: "MONTH", week: "WEEK", day: "DAY", hour: "HOUR",
};

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const salary = formatSalary(job);

  /**
   * Google for Jobs structured data. This is how a job board earns organic
   * traffic, so every field Google can use is filled in.
   *
   * Note: `description` carries our excerpt, not the employer's full text.
   * Google prefers the complete description, so this trades some rich-result
   * quality for staying clear of republishing copyrighted copy. Swap in the
   * full text only if you have the publisher's permission to redistribute it.
   */
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.descriptionExcerpt ?? `${job.title} at ${job.companyName}.`,
    datePosted: new Date(job.postedAt).toISOString(),
    employmentType: EMPLOYMENT_TYPE_SCHEMA[job.employmentType ?? "full_time"] ?? "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyName,
      ...(job.companyWebsite ? { sameAs: job.companyWebsite } : {}),
      ...(job.companyLogoUrl ? { logo: job.companyLogoUrl } : {}),
    },
    directApply: false,
    ...(job.locations.some((l) => l.isRemote)
      ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "Worldwide" } }
      : {}),
    ...(job.locations.filter((l) => l.city || l.countryCode).length
      ? {
          jobLocation: job.locations
            .filter((l) => l.city || l.countryCode)
            .map((l) => ({
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                ...(l.city ? { addressLocality: l.city } : {}),
                ...(l.region ? { addressRegion: l.region } : {}),
                ...(l.countryCode ? { addressCountry: l.countryCode } : {}),
              },
            })),
        }
      : {}),
    ...(job.salaryMin && job.salaryCurrency
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.salaryCurrency,
            value: {
              "@type": "QuantitativeValue",
              minValue: Number(job.salaryMin),
              maxValue: Number(job.salaryMax ?? job.salaryMin),
              unitText: PERIOD_SCHEMA[job.salaryPeriod ?? "year"] ?? "YEAR",
            },
          },
        }
      : {}),
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-faint">
        <Link href="/jobs" className="hover:text-accent">All jobs</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/companies/${job.companySlug}`} className="hover:text-accent">{job.companyName}</Link>
        <span aria-hidden="true">/</span>
        <span className="text-fg-muted">{job.title}</span>
      </nav>

      <div className="rounded-lg border border-line bg-surface">
        <JobDetail job={job} standalone />
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-fg-faint">
        {salary ? "Compensation shown is as published by the employer. " : null}
        Location:{" "}
        {job.locations
          .map((l) => [l.city, l.countryCode ? countryName(l.countryCode) : null].filter(Boolean).join(", ") || "Remote")
          .join(" · ") || "Not stated"}
        .
      </p>
    </main>
  );
}
