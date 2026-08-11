import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // next/image refuses remote hosts that are not listed here. Add the CDN or
    // supplier image host you actually use before pasting its URLs into a product.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    // Product imagery rarely changes; cache the optimised variants for a week.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  // The Mongo driver is server-only; keep it out of any bundling attempt.
  serverExternalPackages: ['mongodb'],

  poweredByHeader: false,
};

export default nextConfig;
