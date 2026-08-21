/** Absolute public origin, used for emails, sitemaps, canonicals and OG tags. */
export function appUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000');
  return raw.replace(/\/$/, '');
}

/** The one origin allowed to appear in search results. */
const PRODUCTION_HOST = 'verogoods.in';

/**
 * Whether search engines may index this deployment.
 *
 * Fails closed on the origin rather than on NODE_ENV: the dev server runs the
 * same production build with its own NEXT_PUBLIC_APP_URL, so it stays noindex
 * without anyone remembering to set a flag there. `SEO_INDEXING=off` is a kill
 * switch for production itself.
 */
export function isIndexable(): boolean {
  if (process.env.SEO_INDEXING === 'off') return false;
  try {
    return new URL(appUrl()).hostname.replace(/^www[.]/, '') === PRODUCTION_HOST;
  } catch {
    return false;
  }
}

export function trackingUrl(token: string): string {
  return `${appUrl()}/order/track/${token}`;
}

export const STORE_NAME = 'Vero Goods';
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'info@verogoods.in';
