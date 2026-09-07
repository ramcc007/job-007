import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
          404
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold text-fg">
          End of the line
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          This page doesn&rsquo;t exist, or the role has been taken down.
        </p>
        <Link
          href="/jobs"
          className="mt-5 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent-hover"
        >
          Browse open roles
        </Link>
      </div>
    </main>
  );
}
