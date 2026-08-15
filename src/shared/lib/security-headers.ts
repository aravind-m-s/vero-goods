import { ALLOWED_IMAGE_HOSTS } from '@/shared/lib/image-hosts';

/**
 * Baseline response headers, built once per request in Proxy.
 *
 * Kept out of `proxy.ts` so the policy is readable on its own and so the host
 * allowlist can be shared with `next.config.ts` via `image-hosts.ts` — a host
 * that next/image is allowed to optimise must also be one the CSP will render.
 */

const RAZORPAY = 'https://*.razorpay.com';
const GOOGLE_SIGN_IN = 'https://accounts.google.com';
const CLOUDINARY_API = 'https://api.cloudinary.com';
const CLOUDINARY_CDN = 'https://res.cloudinary.com';

const IMAGE_HOSTS = ALLOWED_IMAGE_HOSTS.map((host) => `https://${host}`);

/**
 * `'unsafe-inline'` in `script-src` is deliberate, not an oversight.
 *
 * A nonce has to be minted per request, and the storefront is prerendered — the
 * product pages and the home page are static HTML served from the cache, so
 * there is no per-request render in which to stamp one. Hashes do not work
 * either: the JSON-LD block differs per product and Next's own bootstrap
 * scripts change every build.
 *
 * What the policy still buys, which is the part that matters here: no script
 * may be *loaded* from a host that is not on this list, `object-src 'none'`
 * kills plugin embeds, `base-uri 'self'` stops a `<base>` tag redirecting every
 * relative URL, and `form-action 'self'` stops a form posting card details
 * off-site. Injected inline script is the one class this does not stop.
 *
 * To tighten it further, the storefront pages would have to become dynamic and
 * read a nonce from the request — a real cost to every shopper, so it is a
 * decision rather than a to-do.
 */
function contentSecurityPolicy(isProduction: boolean): string {
  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['base-uri', ["'self'"]],
    ['object-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['form-action', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        "'unsafe-inline'",
        // React Refresh compiles components with eval in development only.
        ...(isProduction ? [] : ["'unsafe-eval'"]),
        RAZORPAY,
        GOOGLE_SIGN_IN,
      ],
    ],
    // Tailwind ships a stylesheet, but React inline `style` props and Next's
    // injected <style> tags are both inline by construction.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', RAZORPAY, GOOGLE_SIGN_IN, ...IMAGE_HOSTS]],
    // Product video is Cloudinary-hosted; blob: covers the local preview the
    // admin uploader shows before the file leaves the browser.
    ['media-src', ["'self'", 'blob:', 'data:', CLOUDINARY_CDN]],
    // next/font/google self-hosts the font files at build time, so no external
    // font origin is needed.
    ['font-src', ["'self'", 'data:']],
    [
      'connect-src',
      [
        "'self'",
        // The admin uploader PUTs files straight to Cloudinary.
        CLOUDINARY_API,
        RAZORPAY,
        GOOGLE_SIGN_IN,
      ],
    ],
    // Razorpay Checkout and the Google Sign-In button both render in an iframe.
    ['frame-src', ["'self'", RAZORPAY, GOOGLE_SIGN_IN]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
  ];

  const policy = directives.map(([name, values]) => `${name} ${values.join(' ')}`);
  if (isProduction) policy.push('upgrade-insecure-requests');

  return policy.join('; ');
}

/**
 * Applies the security headers to a response.
 *
 * `CSP_REPORT_ONLY=true` sends the policy as `Content-Security-Policy-Report-Only`
 * instead, so a deployment can watch the browser console for violations before
 * the policy starts blocking anything. Set it, ship, read the reports, unset it.
 */
export function applySecurityHeaders(headers: Headers): void {
  const isProduction = process.env.NODE_ENV === 'production';

  const csp = contentSecurityPolicy(isProduction);
  headers.set(
    process.env.CSP_REPORT_ONLY === 'true'
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy',
    csp
  );

  // Two years, subdomains included. `preload` is deliberately omitted: getting
  // onto the preload list is easy and getting off it takes months, and it binds
  // every future subdomain to HTTPS. Add it only once that is intended.
  // Sent in production only — on http://localhost the browser ignores it, but a
  // stray HSTS entry for localhost breaks every other local project on the machine.
  if (isProduction) {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  // A storefront handling addresses and payments should not be framable or sniffable.
  // X-Frame-Options duplicates `frame-ancestors` for browsers that predate CSP 2.
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
