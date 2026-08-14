import { NextResponse, type NextRequest } from 'next/server';
import { OTP_TTL_SECONDS, consumeOtp, createOtp, getSessionCustomer } from '@/features/auth/server/auth';
import {
  IdentifierTakenError,
  findByIdentifier,
  normaliseIdentifier,
  updateProfile,
} from '@/features/auth/server/users.repo';
import { publicUser } from '@/features/auth/server/public-user';
import { sendEmail } from '@/shared/email/send';
import { otpEmail } from '@/shared/email/templates';
import { otpSms, sendSms } from '@/shared/sms/send';
import { clientIp, rateLimit } from '@/shared/lib/rate-limit';
import {
  EmailSchema,
  PhoneSchema,
  ProfileIdentifierSchema,
  ProfileUpdateSchema,
} from '@/features/auth/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  return NextResponse.json({ user: publicUser(customer) });
}

/**
 * POST — send a code to a *new* email address or mobile number.
 *
 * Separate from the login endpoint on purpose: this code has purpose `change`,
 * so it can only be spent on the profile update below and never mints a
 * session for whoever holds it.
 */
export async function POST(request: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = ProfileIdentifierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Enter a valid email address or mobile number' },
      { status: 400 }
    );
  }

  const { channel, value } = parsed.data;
  // The row being edited fixes the channel, so typing a number into the email
  // row is a validation error rather than a silent phone change.
  const shape = channel === 'email' ? EmailSchema.safeParse(value) : PhoneSchema.safeParse(value);
  if (!shape.success) {
    return NextResponse.json(
      { error: shape.error.issues[0]?.message ?? 'Check the value and try again' },
      { status: 400 }
    );
  }
  const identifier = normaliseIdentifier(value, channel);

  const current = channel === 'email' ? customer.email : customer.phone;
  if (current === identifier) {
    return NextResponse.json(
      { error: `That is already your ${channel === 'email' ? 'email address' : 'mobile number'}` },
      { status: 400 }
    );
  }

  // Fail here rather than after the customer has waited for a code they can
  // never spend.
  const clash = await findByIdentifier(identifier, channel);
  if (clash && clash.id !== customer.id) {
    return NextResponse.json(
      { error: `That ${channel === 'email' ? 'email address' : 'mobile number'} is already used by another account` },
      { status: 409 }
    );
  }

  const [byIdentifier, byIp] = await Promise.all([
    rateLimit(`profile-otp:${identifier}`, 5, 60 * 60),
    rateLimit(`profile-otp-ip:${clientIp(request)}`, 20, 60 * 60),
  ]);
  if (!byIdentifier.allowed || !byIp.allowed) {
    const retryAfter = Math.max(byIdentifier.retryAfterSeconds, byIp.retryAfterSeconds);
    return NextResponse.json(
      { error: 'Too many attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const code = await createOtp({ identifier, channel, purpose: 'change' });
  const { sent } =
    channel === 'email'
      ? await sendEmail(otpEmail(identifier, code, OTP_TTL_SECONDS / 60))
      : await sendSms({ to: identifier, text: otpSms(code, OTP_TTL_SECONDS / 60) });

  return NextResponse.json({
    success: true,
    channel,
    delivery: sent ? channel : 'console',
    message: sent
      ? `Verification code sent to ${channel === 'email' ? identifier : `+${identifier}`}.`
      : 'Delivery is not configured — the code was printed to the server terminal.',
  });
}

/** PATCH — apply the change. Name is free; email/phone need the code above. */
export async function PATCH(request: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check the details and try again' },
      { status: 400 }
    );
  }

  const { name, email, phone, code } = parsed.data;
  const patch: { name?: string; email?: string; phone?: string } = {};
  if (name !== undefined) patch.name = name;

  if (email !== undefined || phone !== undefined) {
    const channel = email !== undefined ? 'email' : 'phone';
    const identifier = normaliseIdentifier((email ?? phone) as string, channel);

    const limit = await rateLimit(`profile-verify:${identifier}`, 10, 15 * 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    const verified = await consumeOtp({ identifier, channel, purpose: 'change' }, code!);
    if (!verified.ok) {
      return NextResponse.json(
        {
          error:
            verified.reason === 'too_many_attempts'
              ? 'Too many incorrect attempts. Request a new code.'
              : 'Invalid or expired verification code',
        },
        { status: verified.reason === 'too_many_attempts' ? 429 : 401 }
      );
    }

    if (channel === 'email') patch.email = identifier;
    else patch.phone = identifier;
  }

  try {
    const updated = await updateProfile(customer.id, patch);
    if (!updated) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true, user: publicUser(updated) });
  } catch (error) {
    if (error instanceof IdentifierTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
