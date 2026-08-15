import 'server-only';

import type { NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { clientIp, rateLimit } from '@/shared/lib/rate-limit';

/** Crawlers that announce themselves. Anything running JS still gets through. */
const BOT_PATTERN = /bot|crawler|spider|crawling|preview|headless|lighthouse|pingdom|curl|wget/i;

/**
 * Whether an analytics event should be recorded at all.
 *
 * Shared by every beacon endpoint so the funnel steps cannot drift apart: if
 * views excluded admins and cart adds did not, the conversion rate between them
 * would be quietly wrong in your favour.
 */
export async function shouldRecordEvent(request: NextRequest, bucket: string): Promise<boolean> {
  if (BOT_PATTERN.test(request.headers.get('user-agent') ?? '')) return false;

  // Your own browsing would otherwise be the biggest visitor in the report.
  if (await isAdminAuthenticated()) return false;

  // The client throttles itself; this is the backstop against a script that
  // does not, so one machine cannot manufacture a bestseller.
  const limit = await rateLimit(`${bucket}:${clientIp(request)}`, 120, 60 * 10);
  return limit.allowed;
}
