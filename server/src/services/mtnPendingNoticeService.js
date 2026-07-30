import Order from '../models/Order.js';
import { sendNumberVerificationEmail } from './emailService.js';
import { sendMtnVerificationSMS } from './smsService.js';

/** MTN data must sit in pending this long before verification notice. */
export const MTN_PENDING_NOTICE_MS = 90 * 60 * 1000;

const isMtnDataOrder = (order) =>
  order.serviceType === 'data_bundle' &&
  String(order.category || '').toUpperCase() === 'MTN';

/**
 * After 1h30m still pending: send long MTN verification email + short SMS once.
 */
export const notifyStaleMtnPendingOrders = async (io, { limit = 40 } = {}) => {
  const cutoff = new Date(Date.now() - MTN_PENDING_NOTICE_MS);
  const cutoffIso = cutoff.toISOString();

  const orders = await Order.find({
    paymentStatus: 'paid',
    serviceType: 'data_bundle',
    category: 'MTN',
    deliveryStatus: 'pending',
    'metadata.queuedForProvider': { $ne: true },
    'metadata.mtnVerificationNoticeSentAt': { $exists: false },
    'metadata.verificationEmailSentAt': { $exists: false },
    $or: [
      { 'metadata.fulfilledAt': { $lte: cutoffIso } },
      {
        'metadata.fulfilledAt': { $exists: false },
        createdAt: { $lte: cutoff },
      },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  const summary = { checked: orders.length, emailed: 0, sms: 0, errors: 0 };

  for (const order of orders) {
    if (!isMtnDataOrder(order)) continue;

    try {
      let emailed = false;
      let smsOk = false;

      if (order.email) {
        await sendNumberVerificationEmail(order.email, order);
        emailed = true;
        summary.emailed += 1;
      }

      if (order.phone) {
        const smsResult = await sendMtnVerificationSMS(order.phone, order);
        smsOk = smsResult?.success !== false;
        if (smsOk) summary.sms += 1;
      }

      order.metadata = {
        ...(order.metadata || {}),
        mtnVerificationNoticeSentAt: new Date().toISOString(),
        verificationEmailSentAt: emailed
          ? new Date().toISOString()
          : order.metadata?.verificationEmailSentAt,
        mtnVerificationSmsSentAt: smsOk
          ? new Date().toISOString()
          : order.metadata?.mtnVerificationSmsSentAt,
      };
      await order.save();

      io?.emit('order:updated', {
        reference: order.reference,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
      });
    } catch (err) {
      summary.errors += 1;
      console.error(`[MTN_PENDING_NOTICE] Failed for ${order.reference}:`, err.message);
    }
  }

  return summary;
};
