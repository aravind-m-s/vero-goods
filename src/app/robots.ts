import type { MetadataRoute } from 'next';
import { appUrl, isIndexable } from '@/shared/lib/config';

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    // Deliberately still `allow`, not `disallow: '/'`. Disallow stops crawlers
    // fetching the page at all, and a page that is never fetched never delivers
    // the `X-Robots-Tag: noindex` proxy.ts sends — so a dev URL that already
    // reached the index would be stuck there as a bare link. Crawl-then-noindex
    // is what actually removes it. No sitemap is advertised either way.
    return { rules: { userAgent: '*', allow: '/' } };
  }

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
