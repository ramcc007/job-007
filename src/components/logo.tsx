import { brand } from "@/config/brand";

/**
 * A length of rail seen from above: two parallel tracks, sleepers, and a
 * lit node where a role sits on the line.
 */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6.5h16M4 17.5h16" stroke="var(--color-fg-muted)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7.5 6.5v11M16.5 6.5v11" stroke="var(--color-line)" strokeWidth="1.25" />
        <circle cx="12" cy="12" r="3.25" fill="var(--color-accent)" />
        <circle cx="12" cy="12" r="6" stroke="var(--color-accent)" strokeWidth="1" opacity="0.3" />
      </svg>
      <span className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-tight text-fg">
        {brand.name}
      </span>
    </span>
  );
}
