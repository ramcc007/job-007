import { PARAM_KEYS } from "@/lib/search/params";
import type { SearchParams } from "@/lib/search/query";

/**
 * A plain GET form — no client JavaScript. Submitting navigates to a real,
 * shareable, crawlable URL, which is exactly what a job board needs.
 */
export function SearchBar({
  params,
  size = "sm",
}: {
  params?: SearchParams;
  size?: "sm" | "lg";
}) {
  const large = size === "lg";

  // Filters already applied must survive a new keyword search.
  const carried = Object.entries(PARAM_KEYS).filter(
    ([field]) => field !== "q" && field !== "location" && field !== "page",
  );

  return (
    <form
      action="/jobs"
      className={`flex w-full items-stretch gap-px overflow-hidden rounded-lg border border-line bg-elevated focus-within:border-accent ${large ? "h-13" : "h-9"}`}
    >
      {params &&
        carried.map(([field, key]) => {
          const value = params[field as keyof SearchParams];
          return value === undefined || value === "" || value === "recent" ? null : (
            <input key={key} type="hidden" name={key} value={String(value)} />
          );
        })}

      <label className="flex flex-1 items-center gap-2 px-3">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">Job title, skill or company</span>
        <input
          type="search"
          name={PARAM_KEYS.q}
          defaultValue={params?.q ?? ""}
          placeholder="Job title, skill or company"
          className={`w-full bg-transparent text-fg placeholder:text-fg-faint focus:outline-none ${large ? "text-base" : "text-sm"}`}
        />
      </label>

      <span className="w-px self-stretch bg-line" aria-hidden="true" />

      <label className="flex flex-1 items-center gap-2 px-3 sm:max-w-56">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 21s7-5.7 7-11a7 7 0 10-14 0c0 5.3 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className="sr-only">City or country</span>
        <input
          type="search"
          name={PARAM_KEYS.location}
          defaultValue={params?.location ?? ""}
          placeholder="City or country"
          className={`w-full bg-transparent text-fg placeholder:text-fg-faint focus:outline-none ${large ? "text-base" : "text-sm"}`}
        />
      </label>

      <button
        type="submit"
        className={`shrink-0 bg-accent font-medium text-ink transition-colors hover:bg-accent-hover ${large ? "px-7 text-[15px]" : "px-4 text-sm"}`}
      >
        Search
      </button>
    </form>
  );
}
