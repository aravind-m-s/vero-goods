import type { MetadataRoute } from 'next';
import { appUrl } from '@/shared/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Tracking pages contain customer PII behind an unguessable token, and
      // checkout/admin have nothing to index.
      disallow: ['/admin', '/api/', '/checkout', '/order/'],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
