import 'server-only';

import { paymentAlertsCollection, stripIds } from '@/shared/db/collections';
import { randomId } from '@/shared/lib/tokens';
import type { PaymentAlert, PaymentAlertKind } from '@/features/payments/types';

export type PaymentAlertInput = Omit<
  PaymentAlert,
  'id' | 'occurrences' | 'firstSeenAt' | 'lastSeenAt' | 'resolvedAt'
>;

/**
 * Records a payment the webhook could not settle.
 *
 * Upserted on `razorpayOrderId` + `kind` rather than inserted: the gateway
 * retries a failed delivery for hours, and one unmatched payment should read as
 * one problem with a retry count, not as forty rows to work through.
 *
 * Never throws. This runs on the failure path of a webhook that has already
 * lost its way, and an alert that cannot be written must not also take down the
 * handler that was trying to report it.
 */
export async function recordPaymentAlert(input: PaymentAlertInput): Promise<void> {
  console.error(
    `[payments:alert] ${input.kind} on razorpay order ${input.razorpayOrderId}: ${input.message}`
  );

  try {
    const alerts = await paymentAlertsCollection();
    const now = new Date();
    await alerts.updateOne(
      { razorpayOrderId: input.razorpayOrderId, kind: input.kind },
      {
        $set: { ...input, lastSeenAt: now },
        $setOnInsert: { id: randomId('palert'), firstSeenAt: now },
        $inc: { occurrences: 1 },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('[payments:alert] could not persist the alert', error);
  }
}

/** Open alerts, most recently seen first. */
export async function listOpenPaymentAlerts(limit = 50): Promise<PaymentAlert[]> {
  const alerts = await paymentAlertsCollection();
  return stripIds(
    await alerts
      .find({ resolvedAt: { $exists: false } })
      .sort({ lastSeenAt: -1 })
      .limit(limit)
      .toArray()
  );
}

export async function resolvePaymentAlert(
  razorpayOrderId: string,
  kind: PaymentAlertKind
): Promise<void> {
  const alerts = await paymentAlertsCollection();
  await alerts.updateOne({ razorpayOrderId, kind }, { $set: { resolvedAt: new Date() } });
}
