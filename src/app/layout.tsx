import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { brand } from "@/config/brand";
import { siteUrl } from "@/lib/site";

import "./globals.css";


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
  openGraph: { siteName: brand.name, type: "website" },
  robots: { index: true, follow: true },
};

/**
 * Applies the stored theme before first paint. Without this the page
 * renders dark and then snaps to light for anyone who chose light mode.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("jobrail-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/*
          Loaded by link rather than next/font so the build never needs
          outbound network access. Every rule carries a real fallback stack,
          so the layout holds if the fonts don't load.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="flex h-14 items-center gap-4 px-4">
            <Link href="/" className="shrink-0" aria-label={`${brand.name} home`}>
              <Logo />
            </Link>

            <div className="hidden min-w-0 flex-1 md:block lg:max-w-2xl">
              <SearchBar />
            </div>

            <nav className="ml-auto flex items-center gap-1.5 text-sm">
              <Link href="/jobs" className="rounded px-2.5 py-1.5 text-fg-muted transition-colors hover:text-fg">
                Browse
              </Link>
              <ThemeToggle />
            </nav>
          </div>

          <div className="border-t border-line-soft px-4 py-2 md:hidden">
            <SearchBar />
          </div>
        </header>

        {children}

        <footer className="border-t border-line px-4 py-8 text-[12px] text-fg-faint">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {brand.name}. Free to use.
            </p>
            <p className="max-w-xl leading-relaxed">
              Listings are summarised from public company career pages and open job feeds.
              Full descriptions and applications stay with the employer. Job data belongs to
              its original publishers.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
