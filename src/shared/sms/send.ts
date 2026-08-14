import 'server-only';

import { STORE_NAME } from '@/shared/lib/config';

/**
 * Transactional SMS, provider-agnostic.
 *
 * Selected with `SMS_PROVIDER`:
 *   - `twilio`  — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *   - `msg91`   — MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_DLT_TEMPLATE_ID
 *   - anything else / unset — the message is printed to the server terminal.
 *
 * The console fallback mirrors `sendEmail`: the app stays usable end to end
 * before an SMS provider (and, in India, DLT registration) is in place.
 * Delivery failures are logged and swallowed — an OTP that failed to send must
 * not 500 the login endpoint, it just means the customer retries.
 */
export interface SmsMessage {
  /** Digits only, with country code, e.g. `919876543210`. */
  to: string;
  text: string;
}

export async function sendSms(message: SmsMessage): Promise<{ sent: boolean; id?: string }> {
  const provider = (process.env.SMS_PROVIDER ?? '').toLowerCase();

  try {
    if (provider === 'twilio') return await sendViaTwilio(message);
    if (provider === 'msg91') return await sendViaMsg91(message);
  } catch (error) {
    console.error('[sms:error]', error);
    return { sent: false };
  }

  console.info(`[sms:not-sent] SMS_PROVIDER is not configured. To: +${message.to}\n${message.text}`);
  return { sent: false };
}

async function sendViaTwilio(message: SmsMessage): Promise<{ sent: boolean; id?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.error('[sms:error] SMS_PROVIDER=twilio but the Twilio credentials are incomplete');
    return { sent: false };
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: `+${message.to}`, From: from, Body: message.text }),
  });

  if (!response.ok) {
    console.error('[sms:error] twilio responded', response.status, await response.text());
    return { sent: false };
  }
  const data = (await response.json()) as { sid?: string };
  return { sent: true, id: data.sid };
}

async function sendViaMsg91(message: SmsMessage): Promise<{ sent: boolean; id?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const sender = process.env.MSG91_SENDER_ID;
  const templateId = process.env.MSG91_DLT_TEMPLATE_ID;
  if (!authKey || !sender || !templateId) {
    console.error('[sms:error] SMS_PROVIDER=msg91 but the MSG91 credentials are incomplete');
    return { sent: false };
  }

  const response = await fetch('https://api.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { authkey: authKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      sender,
      short_url: '0',
      recipients: [{ mobiles: message.to, MESSAGE: message.text, STORE: STORE_NAME }],
    }),
  });

  if (!response.ok) {
    console.error('[sms:error] msg91 responded', response.status, await response.text());
    return { sent: false };
  }
  const data = (await response.json()) as { request_id?: string };
  return { sent: true, id: data.request_id };
}

export function otpSms(code: string, ttlMinutes: number): string {
  return `${code} is your ${STORE_NAME} verification code. It expires in ${ttlMinutes} minutes. Do not share it with anyone.`;
}
