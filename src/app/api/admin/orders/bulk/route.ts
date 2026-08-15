import { NextResponse, after, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import {
  applyAdminStatusChange,
  type StatusChangeFailure,
} from '@/features/orders/server/admin-status';
import { OrderBulkStatusUpdateSchema } from '@/features/orders/schemas';
import type { Order } from '@/features/orders/types';
import { sendEmail } from '@/shared/email/send';
import { statusUpdateEmail } from '@/shared/email/templates';

export const dynamic = 'force-dynamic';

/**
 * How many orders are moved at once. Each one is a read, a guarded write and
 * possibly a stock release, so this trades wall-clock time against how hard a
 * single click leans on Mongo.
 */
const CONCURRENCY = 5;

interface BulkFailure {
  id: string;
  reason: StatusChangeFailure;
  message: string;
}

/**
 * Moves many orders to one status.
 *
 * Partial success is the normal outcome, not an error: a selection of ten
 * PLACED orders can easily contain one whose payment never settled, and the
 * other nine should still move. Every order is reported individually and the
 * response is always 200 unless the request itself was malformed — the caller
 * reads `updated` and `failed` to find out what happened.
 *
 * The transition rules, the refund path and the stock release all come from the
 * same helper the single-order route uses, so a bulk change can never take a
 * shortcut that a one-at-a-time change would have refused.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = OrderBulkStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid bulk status update', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status, note } = parsed.data;
  // The same id twice would fail its own second transition and report a
  // confusing failure for an order that did move.
  const orderIds = [...new Set(parsed.data.orderIds)];

  const updated: Order[] = [];
  const failed: BulkFailure[] = [];

  for (let i = 0; i < orderIds.length; i += CONCURRENCY) {
    const batch = orderIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (id) => ({ id, result: await applyAdminStatusChange(id, { status, note }) }))
    );

    for (const { id, result } of results) {
      if (result.ok) updated.push(result.order);
      else failed.push({ id, reason: result.reason, message: result.message });
    }
  }

  // Gmail SMTP opens a fresh connection per message, so awaiting a hundred of
  // them inline would hold the response open for the better part of a minute.
  // The status changes are already committed; the mail goes out behind them.
  if (updated.length > 0) {
    after(async () => {
      for (const order of updated) {
        const email = statusUpdateEmail(order);
        if (email) await sendEmail(email);
      }
    });
  }

  return NextResponse.json({
    updated,
    failed,
    summary: { requested: orderIds.length, updated: updated.length, failed: failed.length },
  });
}
