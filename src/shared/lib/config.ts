/** Absolute public origin, used for emails, sitemaps, canonicals and OG tags. */
export function appUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000');
  return raw.replace(/\/$/, '');
}

export function trackingUrl(token: string): string {
  return `${appUrl()}/order/track/${token}`;
}

export const STORE_NAME = 'Vero Goods';
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@verogoods.in';
