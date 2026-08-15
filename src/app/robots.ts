import type { MetadataRoute } from 'next';
import { appUrl } from '@/shared/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Tracking pages contain customer PII behind an unguessable token, and
      // checkout has nothing to index.
      //
      // /admin is deliberately absent: proxy.ts sends `X-Robots-Tag: noindex`
      // for it, and a crawler must be allowed to fetch the page to see that
      // header. Disallowing it here would do the opposite of what it looks
      // like — the URL could still surface as a bare link — while also
      // publishing the admin path in a file anyone can read.
      disallow: ['/api/', '/checkout', '/order/'],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
