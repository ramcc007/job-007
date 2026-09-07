import Link from "next/link";

import { pageUrl } from "@/lib/search/params";
import type { SearchParams } from "@/lib/search/query";

export function Pagination({
  params,
  page,
  perPage,
  total,
  basePath = "/jobs",
}: {
  params: SearchParams;
  page: number;
  perPage: number;
  total: number;
  basePath?: string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  if (lastPage <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const step = (delta: number, label: string) => {
    const target = page + delta;
    const disabled = target < 1 || target > lastPage;
    return disabled ? (
      <span className="rounded border border-line-soft px-2.5 py-1 text-fg-faint">{label}</span>
    ) : (
      <Link
        href={pageUrl(params, target, basePath)}
        className="rounded border border-line px-2.5 py-1 text-fg-muted transition-colors hover:border-accent hover:text-accent"
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12px]">
      <span className="font-[family-name:var(--font-mono)] text-fg-faint">
        {from}–{to} of {total}
      </span>
      <nav aria-label="Pagination" className="flex items-center gap-1.5">
        {step(-1, "Previous")}
        <span className="px-1 font-[family-name:var(--font-mono)] text-fg-faint">
          {page}/{lastPage}
        </span>
        {step(1, "Next")}
      </nav>
    </div>
  );
}
