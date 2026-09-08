"use client";

import { Combobox } from "@/components/combobox";

const TitleIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
);

const PlaceIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 21s7-5.7 7-11a7 7 0 10-14 0c0 5.3 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);

/**
 * A plain GET form. Submitting navigates to a real, shareable URL, and it
 * works without JavaScript beyond the suggestion list.
 */
export function SearchBar({
  q = "", l = "", size = "sm", autoFocus,
}: {
  q?: string;
  l?: string;
  size?: "sm" | "lg";
  autoFocus?: boolean;
}) {
  const large = size === "lg";
  return (
    <form
      action="/jobs"
      className={`flex w-full items-stretch gap-px rounded-lg border border-line bg-elevated focus-within:border-accent ${large ? "h-13 text-base" : "h-9 text-sm"}`}
    >
      <Combobox name="q" kind="title" defaultValue={q} autoFocus={autoFocus}
                placeholder="Job title, skill or company" icon={TitleIcon} />
      <span className="w-px self-stretch bg-line" aria-hidden="true" />
      <Combobox name="l" kind="location" defaultValue={l}
                placeholder="City or country" icon={PlaceIcon} />
      <button
        type="submit"
        className={`shrink-0 rounded-r-lg bg-accent font-medium text-ink transition-colors hover:bg-accent-hover ${large ? "px-7" : "px-4"}`}
      >
        Search
      </button>
    </form>
  );
}
