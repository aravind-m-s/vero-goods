/**
 * Hosts next/image is allowed to optimise.
 *
 * Single source of truth: `next.config.ts` turns this into `remotePatterns`,
 * and `SafeImage` reads it to decide whether a URL can go through the optimiser
 * at all. Keeping one list means a host can never be renderable but
 * unoptimisable, or vice versa.
 *
 * The list is deliberately an allowlist. `hostname: '**'` would make
 * `/_next/image` an open image proxy that anyone on the internet can point at
 * any URL, at our bandwidth.
 */
export const ALLOWED_IMAGE_HOSTS = [
  'images.unsplash.com',
  'plus.unsplash.com',
  'res.cloudinary.com',
  // Supplier and marketplace CDNs used by current catalogue data.
  'i.ebayimg.com',
  'imgs.search.brave.com',
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'cdn.shopify.com',
  'ik.imagekit.io',
  'lh3.googleusercontent.com',
  // YouTube's thumbnail CDN, for posters derived by `videoPosterUrl`.
  'i.ytimg.com',
] as const;

export function isAllowedImageHost(url: string): boolean {
  try {
    return (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(new URL(url).hostname);
  } catch {
    // Relative paths (/logo.svg) are ours and always fine.
    return url.startsWith('/');
  }
}
