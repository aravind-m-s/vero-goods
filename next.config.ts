import type { NextConfig } from 'next';
import { ALLOWED_IMAGE_HOSTS } from './src/shared/lib/image-hosts';

const nextConfig: NextConfig = {
  images: {
    // next/image refuses remote hosts that are not listed here. The list lives
    // in src/shared/lib/image-hosts.ts because the storefront reads it too, to
    // fall back to an unoptimised <img> instead of throwing on a stray host.
    remotePatterns: ALLOWED_IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
    })),
    formats: ['image/avif', 'image/webp'],
    // Product imagery rarely changes; cache the optimised variants for a week.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  // The Mongo driver is server-only; keep it out of any bundling attempt.
  serverExternalPackages: ['mongodb'],

  poweredByHeader: false,
};

export default nextConfig;
