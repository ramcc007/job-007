import { EMPLOYMENT_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS, labelFor } from "@/lib/search/labels";

const WORK_MODE_STYLE: Record<string, string> = {
  remote: "border-teal-dim bg-teal-dim/40 text-teal",
  hybrid: "border-accent-dim bg-accent-dim/25 text-accent",
  onsite: "border-line bg-elevated text-fg-muted",
  unspecified: "border-line bg-elevated text-fg-faint",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "teal";
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-elevated text-fg-muted",
    accent: "border-accent-dim bg-accent-dim/25 text-accent",
    teal: "border-teal-dim bg-teal-dim/40 text-teal",
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-4 ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function WorkModeBadge({ mode }: { mode: string | null }) {
  const key = mode ?? "unspecified";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-4 ${WORK_MODE_STYLE[key] ?? WORK_MODE_STYLE.unspecified}`}>
      {labelFor(WORK_MODE_LABELS, key)}
    </span>
  );
}

export function SeniorityBadge({ seniority }: { seniority: string | null }) {
  if (!seniority) return null;
  return <Badge>{labelFor(SENIORITY_LABELS, seniority)}</Badge>;
}

export function EmploymentBadge({ type }: { type: string | null }) {
  // Full-time is the overwhelming default; badging it adds noise, not signal.
  if (!type || type === "full_time") return null;
  return <Badge tone="accent">{labelFor(EMPLOYMENT_LABELS, type)}</Badge>;
}
