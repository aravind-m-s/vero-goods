import 'server-only';

import { STORE_NAME } from '@/shared/lib/config';

/**
 * Transactional email via the Resend REST API.
 *
 * `RESEND_API_KEY` was already in `.env` but nothing ever read it — OTP codes
 * and order confirmations were only `console.log`ed to the server terminal, so
 * customers never received their login code or their tracking link.
 *
 * Delivery failures are logged and swallowed: a flaky mail provider must never
 * roll back an order that has already been paid for.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? `${STORE_NAME} <onboarding@resend.dev>`;

  if (!apiKey) {
    // Dev fallback so the app is usable without a mail provider configured.
    console.info(
      `[email:not-sent] RESEND_API_KEY missing. To: ${message.to} | Subject: ${message.subject}\n${message.text}`
    );
    return { sent: false };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      console.error('[email:failed]', response.status, await response.text().catch(() => ''));
      return { sent: false };
    }

    const data = (await response.json()) as { id?: string };
    return { sent: true, id: data.id };
  } catch (error) {
    console.error('[email:error]', error);
    return { sent: false };
  }
}
