import { NextResponse, type NextRequest } from 'next/server';
import {
  OTP_TTL_SECONDS,
  clearAdminSession,
  clearCustomerSession,
  createOtp,
  getSessionCustomer,
  setAdminSession,
  setCustomerSession,
  verifyAdminPassword,
  verifyOtp,
} from '@/features/auth/server/auth';
import { sendEmail } from '@/shared/email/send';
import { otpEmail } from '@/shared/email/templates';
import { clientIp, rateLimit, resetRateLimit } from '@/shared/lib/rate-limit';
import { AdminLoginSchema, OtpRequestSchema, OtpVerifySchema } from '@/features/auth/schemas';

export const dynamic = 'force-dynamic';

/** Uniform delay-free failure response — never reveals whether an email exists. */
const GENERIC_OTP_ERROR = 'Invalid or expired verification code';

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Please wait before trying again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

// GET — current customer session
export async function GET() {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: { id: customer.id, email: customer.email, name: customer.name, phone: customer.phone },
  });
}

// POST — request an OTP (customer) or sign in (admin)
export async function POST(request: NextRequest) {
  const role = new URL(request.url).searchParams.get('role');
  const ip = clientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (role === 'admin') {
    // Brute-force guard on the single shared admin credential.
    const limit = await rateLimit(`admin-login:${ip}`, 5, 15 * 60);
    if (!limit.allowed) return tooMany(limit.retryAfterSeconds);

    const parsed = AdminLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    let valid = false;
    try {
      valid = verifyAdminPassword(parsed.data.password);
    } catch (error) {
      console.error('[auth] admin password is not configured', error);
      return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 });
    }

    if (!valid) {
      return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
    }

    await resetRateLimit(`admin-login:${ip}`);
    await setAdminSession();
    return NextResponse.json({ success: true });
  }

  const parsed = OtpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  // Two limiters: per-address stops mailbox flooding, per-IP stops an attacker
  // cycling through addresses from one host.
  const [byEmail, byIp] = await Promise.all([
    rateLimit(`otp-send:${email}`, 5, 60 * 60),
    rateLimit(`otp-send-ip:${ip}`, 20, 60 * 60),
  ]);
  if (!byEmail.allowed) return tooMany(byEmail.retryAfterSeconds);
  if (!byIp.allowed) return tooMany(byIp.retryAfterSeconds);

  const code = await createOtp(email);
  const { sent } = await sendEmail(otpEmail(email, code, OTP_TTL_SECONDS / 60));

  return NextResponse.json({
    success: true,
    delivery: sent ? 'email' : 'console',
    message: sent
      ? 'Verification code sent to your email.'
      : 'Email delivery is not configured — the code was printed to the server terminal.',
  });
}

// PUT — verify an OTP and start a customer session
export async function PUT(request: NextRequest) {
  const ip = clientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = OtpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_OTP_ERROR }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const [byEmail, byIp] = await Promise.all([
    rateLimit(`otp-verify:${email}`, 10, 15 * 60),
    rateLimit(`otp-verify-ip:${ip}`, 50, 15 * 60),
  ]);
  if (!byEmail.allowed) return tooMany(byEmail.retryAfterSeconds);
  if (!byIp.allowed) return tooMany(byIp.retryAfterSeconds);

  const result = await verifyOtp(email, parsed.data.code);
  if (!result.ok) {
    const status = result.reason === 'too_many_attempts' ? 429 : 401;
    return NextResponse.json(
      {
        error:
          result.reason === 'too_many_attempts'
            ? 'Too many incorrect attempts. Request a new code.'
            : GENERIC_OTP_ERROR,
      },
      { status }
    );
  }

  await Promise.all([resetRateLimit(`otp-verify:${email}`), setCustomerSession(result.user.id)]);

  return NextResponse.json({
    success: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      phone: result.user.phone,
    },
  });
}

// DELETE — sign out
export async function DELETE(request: NextRequest) {
  const role = new URL(request.url).searchParams.get('role');
  if (role === 'admin') {
    await clearAdminSession();
  } else {
    await clearCustomerSession();
  }
  return NextResponse.json({ success: true });
}
