import { NextRequest, NextResponse } from 'next/server';
import { sendOTP, verifyOTP, setCustomerSession, getSessionCustomer, clearCustomerSession, setAdminSession, clearAdminSession } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

// GET - check current session
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  try {
    const customer = await getSessionCustomer();
    return NextResponse.json({ user: customer });
  } catch (e) {
    return NextResponse.json({ user: null });
  }
}

// POST - send OTP (customer) or login (admin)
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const body = await request.json();

  // Admin password login
  if (role === 'admin') {
    const { password } = body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
    }

    await setAdminSession();
    return NextResponse.json({ success: true });
  }

  // Customer OTP flow
  const { email } = body;
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
  }

  await sendOTP(email);
  return NextResponse.json({ success: true, message: 'OTP generated. Check server terminal for the code.' });
}

// PUT - verify OTP and log in customer
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { email, code } = body;

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
  }

  const user = await verifyOTP(email, code);

  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 401 });
  }

  await setCustomerSession(user.id);
  return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
}

// DELETE - logout customer or admin
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  if (role === 'admin') {
    await clearAdminSession();
  } else {
    await clearCustomerSession();
  }

  return NextResponse.json({ success: true });
}
