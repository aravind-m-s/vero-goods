import { NextResponse, type NextRequest } from 'next/server';
import { setCustomerSession } from '@/features/auth/server/auth';
import { isGoogleSignInEnabled, verifyGoogleIdToken } from '@/features/auth/server/google';
import { findOrCreateGoogleCustomer } from '@/features/auth/server/users.repo';
import { publicUser } from '@/features/auth/server/public-user';
import { clientIp, rateLimit } from '@/shared/lib/rate-limit';
import { GoogleSignInSchema } from '@/features/auth/schemas';

export const dynamic = 'force-dynamic';

/** POST — exchange a Google ID token for a customer session. */
export async function POST(request: NextRequest) {
  if (!isGoogleSignInEnabled()) {
    return NextResponse.json({ error: 'Google sign-in is not configured' }, { status: 503 });
  }

  const limit = await rateLimit(`google-signin:${clientIp(request)}`, 20, 15 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = GoogleSignInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Google sign-in failed' }, { status: 400 });
  }

  // Everything trusted comes out of this call — the client's own claims about
  // its email or name are never read.
  const identity = await verifyGoogleIdToken(parsed.data.credential);
  if (!identity) {
    return NextResponse.json({ error: 'Google sign-in could not be verified' }, { status: 401 });
  }

  const user = await findOrCreateGoogleCustomer(identity);
  await setCustomerSession(user.id);

  return NextResponse.json({ success: true, user: publicUser(user) });
}
