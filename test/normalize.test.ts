import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TENANT_NOT_FOUND, candidateUrls } from "@/lib/db";
import { classify, inferSeniority } from "@/lib/ingest/classify";
import { dedupHash } from "@/lib/ingest/dedupe";
import { excerpt, htmlToText } from "@/lib/ingest/html";
import { normalizeJob } from "@/lib/ingest/normalize";
import { inferEmploymentType, inferWorkMode } from "@/lib/ingest/normalize/attributes";
import { parseLocation } from "@/lib/ingest/normalize/location";
import { parseSalaryText } from "@/lib/ingest/normalize/salary";
import { humanizeSlug, normalizeTitle } from "@/lib/ingest/normalize/title";

describe("htmlToText", () => {
  it("unwraps entity-escaped HTML the way Greenhouse sends it", () => {
    const escaped = "&lt;p&gt;We need a &lt;strong&gt;Senior&lt;/strong&gt; dev&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Rust&lt;/li&gt;&lt;/ul&gt;";
    const text = htmlToText(escaped);
    assert.match(text, /We need a Senior dev/);
    assert.match(text, /• Rust/);
    assert.ok(!text.includes("<"), "no tags should survive");
  });

  it("decodes numeric and named entities", () => {
    assert.equal(htmlToText("<p>caf&eacute; &amp; b&#97;r</p>"), "café & bar");
  });

  it("cuts an excerpt on a word boundary", () => {
    const out = excerpt("a".repeat(10) + " " + "b".repeat(400), 40);
    assert.ok(out.length <= 41, `got ${out.length}`);
    assert.ok(out.endsWith("…"));
  });
});

describe("parseLocation", () => {
  const cases: [string, Partial<ReturnType<typeof parseLocation>>][] = [
    ["London, UK", { city: "London", countryCode: "GB", isRemote: false }],
    ["Austin, TX", { city: "Austin", region: "TX", countryCode: "US" }],
    ["Bengaluru, Karnataka, India", { city: "Bengaluru", countryCode: "IN" }],
    ["Gurgaon", { city: "Gurgaon", countryCode: "IN" }],
    ["Remote", { isRemote: true, city: null, countryCode: null }],
    ["Remote - United States", { isRemote: true, countryCode: "US" }],
    ["Remote (India)", { isRemote: true, countryCode: "IN" }],
    ["Worldwide", { isRemote: true }],
    ["Berlin, Germany", { city: "Berlin", countryCode: "DE" }],
    ["Toronto, ON", { city: "Toronto", region: "ON", countryCode: "CA" }],
    ["San Francisco, CA (Remote)", { city: "San Francisco", countryCode: "US", isRemote: true }],
  ];

  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)}`, () => {
      const actual = parseLocation(input);
      for (const [key, value] of Object.entries(expected)) {
        assert.equal(
          actual[key as keyof typeof actual], value,
          `${input} -> ${key}: got ${JSON.stringify(actual[key as keyof typeof actual])}`,
        );
      }
    });
  }
});

describe("parseSalaryText", () => {
  it("reads a plain USD range", () => {
    const s = parseSalaryText("$120,000 - $150,000 per year");
    assert.deepEqual([s.min, s.max, s.currency, s.period], [120000, 150000, "USD", "year"]);
  });

  it("expands k suffixes", () => {
    const s = parseSalaryText("£65k – £80k per annum");
    assert.deepEqual([s.min, s.max, s.currency], [65000, 80000, "GBP"]);
  });

  it("handles Indian lakh notation and grouping", () => {
    const lakh = parseSalaryText("₹15 lakhs - ₹25 lakhs per annum");
    assert.deepEqual([lakh.min, lakh.max, lakh.currency], [1500000, 2500000, "INR"]);

    const grouped = parseSalaryText("Rs. 15,00,000 - 25,00,000 p.a.");
    assert.deepEqual([grouped.min, grouped.max, grouped.currency], [1500000, 2500000, "INR"]);
  });

  it("infers hourly from magnitude when the period is unstated", () => {
    const s = parseSalaryText("$45 - $60");
    assert.equal(s.period, "hour");
  });

  it("returns nulls rather than inventing a figure", () => {
    const s = parseSalaryText("Competitive salary and equity");
    assert.equal(s.min, null);
    assert.equal(s.currency, null);
  });

  it("ignores a bare year", () => {
    assert.equal(parseSalaryText("Posted in 2025").min, null);
  });
});

describe("inferWorkMode", () => {
  it("prefers hybrid when a posting says both", () => {
    assert.equal(inferWorkMode("Remote-friendly hybrid role, 2 days in office", [], undefined), "hybrid");
  });

  it("trusts an explicit source flag", () => {
    assert.equal(inferWorkMode("Office based in Berlin", [], true), "remote");
  });

  it("stays unspecified rather than guessing", () => {
    assert.equal(inferWorkMode("We are hiring an accountant.", [], undefined), "unspecified");
  });

  it("detects onsite", () => {
    assert.equal(inferWorkMode("This is an on-site position", [], undefined), "onsite");
  });
});

describe("inferEmploymentType", () => {
  it("defaults to full time", () => {
    assert.equal(inferEmploymentType(undefined, "Data Analyst", ""), "full_time");
  });
  it("spots an internship in the title", () => {
    assert.equal(inferEmploymentType(undefined, "Marketing Intern", ""), "internship");
  });
  it("spots a contract from the source field", () => {
    assert.equal(inferEmploymentType("Contract", "Developer", ""), "contract");
  });
});

describe("normalizeTitle", () => {
  it("strips requisition ids, gender tags and mode suffixes", () => {
    assert.equal(
      normalizeTitle("Senior Software Engineer (m/w/d) - Remote | Req #44812"),
      "senior software engineer",
    );
  });
});

describe("classify", () => {
  const cases: [string, string][] = [
    ["Senior Backend Engineer", "software_engineering"],
    ["Machine Learning Engineer", "data_ai"],
    ["Site Reliability Engineer", "infrastructure"],
    ["Registered Nurse - ICU", "healthcare"],
    ["Civil Site Engineer", "civil_engineering"],
    ["Mechanical Design Engineer", "mechanical_engineering"],
    ["Account Executive, Enterprise", "sales"],
    ["Digital Marketing Manager", "marketing"],
    ["Financial Analyst", "finance"],
    ["Technical Recruiter", "hr"],
    ["Legal Counsel", "legal"],
    ["Supply Chain Manager", "supply_chain"],
    ["Customer Success Manager", "customer_support"],
    ["UX Designer", "design"],
    ["QA Automation Engineer", "qa"],
    ["Electrician", "skilled_trades"],
    ["Executive Assistant", "admin"],
    ["Secondary School Teacher", "education"],
    ["Product Manager, Payments", "product"],
    ["Security Engineer, AppSec", "security"],
  ];

  for (const [title, expected] of cases) {
    it(`routes "${title}" to ${expected}`, () => {
      assert.equal(classify({ title }).jobFunction, expected);
    });
  }

  it("does not claim a function on a meaningless title", () => {
    assert.equal(classify({ title: "Opportunity" }).jobFunction, null);
  });

  it("reads the industry from company context, not the title", () => {
    const result = classify({
      title: "Software Engineer",
      companyName: "Acme Bank",
      description: "Join our investment banking technology team.",
    });
    assert.equal(result.vertical, "financial_services");
  });
});

describe("inferSeniority", () => {
  const cases: [string, string][] = [
    ["Chief Technology Officer", "c_level"],
    ["VP of Engineering", "vp"],
    ["Senior Director, Marketing", "director"],
    ["Engineering Manager", "manager"],
    ["Principal Engineer", "lead"],
    ["Senior Software Engineer", "senior"],
    ["Junior Developer", "entry"],
    ["Software Engineering Intern", "intern"],
    ["Software Engineer", "mid"],
  ];
  for (const [title, expected] of cases) {
    it(`${title} -> ${expected}`, () => assert.equal(inferSeniority(title), expected));
  }
});

describe("dedupHash", () => {
  it("collapses the same role found on two sources", () => {
    const a = dedupHash({ companyName: "Acme Inc.", titleNormalized: "backend engineer", city: "Berlin", countryCode: "DE" });
    const b = dedupHash({ companyName: "acme inc", titleNormalized: "backend engineer", city: "berlin", countryCode: "DE" });
    assert.equal(a, b);
  });

  it("keeps the same title in two cities apart", () => {
    const berlin = dedupHash({ companyName: "Acme", titleNormalized: "support engineer", city: "Berlin", countryCode: "DE" });
    const blr = dedupHash({ companyName: "Acme", titleNormalized: "support engineer", city: "Bengaluru", countryCode: "IN" });
    assert.notEqual(berlin, blr);
  });
});

describe("normalizeJob", () => {
  it("maps a realistic Lever posting end to end", () => {
    const job = normalizeJob({
      source: "lever",
      sourceJobId: "abc-123",
      url: "https://jobs.lever.co/acme/abc-123",
      title: "Senior Data Engineer (m/f/d)",
      companyName: "Acme Analytics",
      atsPlatform: "lever",
      atsSlug: "acme",
      locationsRaw: ["Berlin, Germany"],
      descriptionText: "Build our data platform with Spark and Airflow. Hybrid, 2 days a week in the office.",
      employmentTypeRaw: "Full-time",
      salaryMin: 70000,
      salaryMax: 90000,
      salaryCurrency: "eur",
      salaryPeriod: "year",
      postedAt: new Date("2026-08-01T00:00:00Z"),
    });

    assert.ok(job);
    assert.equal(job.title, "Senior Data Engineer");
    assert.equal(job.titleNormalized, "senior data engineer");
    assert.equal(job.jobFunction, "data_ai");
    assert.equal(job.seniority, "senior");
    assert.equal(job.workMode, "hybrid");
    assert.equal(job.hybridOfficeDays, 2);
    assert.equal(job.employmentType, "full_time");
    assert.equal(job.salaryCurrency, "EUR");
    assert.equal(job.locations[0]?.city, "Berlin");
    assert.equal(job.locations[0]?.countryCode, "DE");
    assert.match(job.slug, /^acme-analytics-senior-data-engineer-lever-abc-123$/);
  });

  it("rejects a listing with no link to apply through", () => {
    assert.equal(
      normalizeJob({ source: "x", sourceJobId: "1", url: "", title: "Engineer", companyName: "A", locationsRaw: [] }),
      null,
    );
  });

  it("falls back to now for a nonsense posted date", () => {
    const now = new Date("2026-09-07T00:00:00Z");
    const job = normalizeJob({
      source: "x", sourceJobId: "1", url: "https://e.com/1", title: "Engineer",
      companyName: "A", locationsRaw: [], postedAt: new Date("2099-01-01T00:00:00Z"),
    }, now);
    assert.equal(job?.postedAt.getTime(), now.getTime());
  });
});

describe("humanizeSlug", () => {
  it("turns a board slug into a display name", () => {
    assert.equal(humanizeSlug("netflix"), "Netflix");
    assert.equal(humanizeSlug("e-food"), "E Food");
    assert.equal(humanizeSlug("acme_corp"), "Acme Corp");
  });
});

describe("candidateUrls", () => {
  const base = "postgresql://u.ref:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

  it("offers the sibling Supabase pooler shard as a fallback", () => {
    const [first, second] = candidateUrls(base);
    assert.equal(first, base);
    assert.equal(second, base.replace("aws-0-", "aws-1-"));
  });

  it("swaps in both directions", () => {
    const fromOne = base.replace("aws-0-", "aws-1-");
    assert.equal(candidateUrls(fromOne)[1], base);
  });

  it("leaves a non-Supabase URL alone", () => {
    const local = "postgresql://jobrail:jobrail@localhost:5432/jobrail";
    assert.deepEqual(candidateUrls(local), [local]);
  });

  it("preserves the password verbatim", () => {
    const tricky = "postgresql://u.ref:p@ss-0-word@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
    const [, sibling] = candidateUrls(tricky);
    assert.ok(sibling.includes("p@ss-0-word"), "password must not be rewritten");
    assert.ok(sibling.includes("aws-0-eu-west-2"), sibling);
  });
});

describe("TENANT_NOT_FOUND", () => {
  // Both phrasings observed from Supabase's pooler. The first is what the
  // live deployment actually returned; matching only the documented wording
  // meant the fallback never fired.
  const messages = [
    "tenant/user jobrail_app.vwocigleaieyfdeplmnd not found",
    "Tenant or user not found",
  ];
  for (const message of messages) {
    it(`matches ${JSON.stringify(message)}`, () => {
      assert.ok(TENANT_NOT_FOUND.test(message));
    });
  }

  it("does not match an unrelated failure", () => {
    assert.ok(!TENANT_NOT_FOUND.test("password authentication failed for user"));
    assert.ok(!TENANT_NOT_FOUND.test("connect ETIMEDOUT"));
  });
});
