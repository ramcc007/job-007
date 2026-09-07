/**
 * The public origin of this deployment.
 *
 * On Vercel, VERCEL_PROJECT_PRODUCTION_URL is injected automatically, so a
 * deployment gets correct canonical URLs, sitemap entries and Open Graph
 * tags without anyone having to configure the domain first. Setting
 * NEXT_PUBLIC_SITE_URL overrides it once a real domain is attached.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
