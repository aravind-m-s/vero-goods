import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, verifySessionValue } from '@/features/auth/server/session';

/**
 * Optimistic gate for the admin portal. This only checks that the cookie is a
 * signature-valid, unexpired admin session — every admin API route re-checks
 * with `isAdminAuthenticated()` before touching data. Proxy is a redirect
 * convenience, never the authorisation boundary.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const session = await verifySessionValue(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
    if (session?.role !== 'admin') {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();

  // Baseline hardening headers. A storefront handling addresses and payments
  // should not be framable or sniffable.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets, so the security
    // headers apply site-wide while the admin check stays path-scoped.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
