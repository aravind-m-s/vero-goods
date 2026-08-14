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
import { normaliseIdentifier } from '@/features/auth/server/users.repo';
import { isGoogleSignInEnabled } from '@/features/auth/server/google';
import { sendEmail } from '@/shared/email/send';
import { otpEmail } from '@/shared/email/templates';
import { otpSms, sendSms } from '@/shared/sms/send';
import { clientIp, rateLimit, resetRateLimit } from '@/shared/lib/rate-limit';
import {
  AdminLoginSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  identifyChannel,
} from '@/features/auth/schemas';
import { publicUser } from '@/features/auth/server/public-user';

export const dynamic = 'force-dynamic';

/** Uniform failure response — never reveals whether an account exists. */
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
  return NextResponse.json({
    user: customer ? publicUser(customer) : null,
    googleSignInEnabled: isGoogleSignInEnabled(),
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Enter a valid email address or mobile number' },
      { status: 400 }
    );
  }

  const { name } = parsed.data;
  // The schema has already proved it is one or the other.
  const channel = identifyChannel(parsed.data.identifier) as 'email' | 'phone';
  const identifier = normaliseIdentifier(parsed.data.identifier, channel);

  // Two limiters: per-identifier stops mailbox/handset flooding, per-IP stops
  // an attacker cycling through addresses from one host.
  const [byIdentifier, byIp] = await Promise.all([
    rateLimit(`otp-send:${identifier}`, 5, 60 * 60),
    rateLimit(`otp-send-ip:${ip}`, 20, 60 * 60),
  ]);
  if (!byIdentifier.allowed) return tooMany(byIdentifier.retryAfterSeconds);
  if (!byIp.allowed) return tooMany(byIp.retryAfterSeconds);

  const code = await createOtp({ identifier, channel, purpose: 'login', name });

  const { sent } =
    channel === 'email'
      ? await sendEmail(otpEmail(identifier, code, OTP_TTL_SECONDS / 60))
      : await sendSms({ to: identifier, text: otpSms(code, OTP_TTL_SECONDS / 60) });

  return NextResponse.json({
    success: true,
    channel,
    delivery: sent ? channel : 'console',
    message: sent
      ? channel === 'email'
        ? 'Verification code sent to your email.'
        : 'Verification code sent by SMS.'
      : `${channel === 'email' ? 'Email' : 'SMS'} delivery is not configured — the code was printed to the server terminal.`,
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

  const { name } = parsed.data;
  const channel = identifyChannel(parsed.data.identifier) as 'email' | 'phone';
  const identifier = normaliseIdentifier(parsed.data.identifier, channel);

  const [byIdentifier, byIp] = await Promise.all([
    rateLimit(`otp-verify:${identifier}`, 10, 15 * 60),
    rateLimit(`otp-verify-ip:${ip}`, 50, 15 * 60),
  ]);
  if (!byIdentifier.allowed) return tooMany(byIdentifier.retryAfterSeconds);
  if (!byIp.allowed) return tooMany(byIp.retryAfterSeconds);

  const result = await verifyOtp({ identifier, channel, name }, parsed.data.code);
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

  await Promise.all([
    resetRateLimit(`otp-verify:${identifier}`),
    setCustomerSession(result.user.id),
  ]);

  // Only disclosed *after* the code was proved, so it guides the person holding
  // the identifier without telling an anonymous prober who has an account.
  return NextResponse.json({
    success: true,
    user: publicUser(result.user),
    isNewAccount: result.isNewAccount,
    /** True when the account exists but still carries a generated name. */
    needsName: !result.user.name || result.user.name.startsWith('Customer '),
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
