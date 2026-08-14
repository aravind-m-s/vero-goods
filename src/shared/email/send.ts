import 'server-only';
import nodemailer from 'nodemailer';
import { STORE_NAME } from '@/shared/lib/config';

/**
 * Transactional email via Gmail SMTP (Nodemailer).
 *
 * Configured via SMTP_EMAIL_ADDRESS, SMTP_APP_PASSWORD, and SMTP_PORT in .env.
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
  // Phone-first customers may have no email on file at all; that is not an
  // error, there is simply nowhere to send.
  if (!message.to?.trim()) return { sent: false };

  const user = process.env.SMTP_EMAIL_ADDRESS;
  const pass = process.env.SMTP_APP_PASSWORD;
  const port = Number(process.env.SMTP_PORT) || 465;

  if (!user || !pass) {
    // Dev fallback so the app is usable without a mail provider configured.
    console.info(
      `[email:not-sent] SMTP credentials missing. To: ${message.to} | Subject: ${message.subject}\n${message.text}`
    );
    return { sent: false };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port,
      secure: port === 465, // true for port 465, false for 587 or other ports
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${STORE_NAME}" <${user}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return { sent: true, id: info.messageId };
  } catch (error) {
    console.error('[email:error]', error);
    return { sent: false };
  }
}