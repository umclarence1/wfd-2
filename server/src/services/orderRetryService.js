import { fulfillOrder } from './orderService.js';
import {
  findAutoOrdersAwaitingProviderId,
  findQueuedProviderOrders,
  findRetryableFailedOrders,
  findUnsubmittedProviderOrders,
} from './orderQueueService.js';
import {
  hasConfirmedProviderSubmission,
  isOrderSubmittedToProvider,
  isWithinProviderPurchaseCooldown,
  shouldSkipAutoFulfillment,
} from '../utils/fulfillmentLock.js';
import { isEligibleForAutoProviderFulfill } from '../utils/providerAutoFulfill.js';
import { QUEUE_REASONS } from '../utils/providerQueue.js';

/**
 * Retry only NEW paid orders (autoProviderFulfill). Old unsent orders are skipped.
 */
export const retryQueuedProviderOrders = async (io, { limit = 25 } = {}) => {
  const awaiting = await findAutoOrdersAwaitingProviderId(limit);
  const queued = await findQueuedProviderOrders(limit);
  const unsubmitted = await findUnsubmittedProviderOrders(Math.max(5, Math.floor(limit / 2)));
  const failed = await findRetryableFailedOrders(Math.max(5, Math.floor(limit / 2)));
  const seen = new Set();
  const orders = [];

  for (const order of [...awaiting, ...queued, ...unsubmitted, ...failed]) {
    const id = String(order._id);
    if (seen.has(id)) continue;
    seen.add(id);
    orders.push(order);
  }

  const results = [];

  for (const order of orders) {
    try {
      if (!isEligibleForAutoProviderFulfill(order)) {
        results.push({
          reference: order.reference,
          status: order.deliveryStatus,
          success: true,
          skipped: true,
          message: 'Legacy unsent order — not auto-submitted.',
        });
        continue;
      }

      if (
        hasConfirmedProviderSubmission(order)
        || isOrderSubmittedToProvider(order)
        || order.providerResponse?.alreadySubmitted === true
        || (
          shouldSkipAutoFulfillment(order)
          && hasConfirmedProviderSubmission(order)
        )
      ) {
        results.push({
          reference: order.reference,
          status: order.deliveryStatus,
          success: true,
          skipped: true,
          message: isOrderSubmittedToProvider(order) || hasConfirmedProviderSubmission(order)
            ? 'Already submitted to provider.'
            : 'Manual fulfillment — skipped.',
        });
        continue;
      }

      if (
        order.metadata?.queueReason === QUEUE_REASONS.INSUFFICIENT_BALANCE
        && isWithinProviderPurchaseCooldown(order)
      ) {
        results.push({
          reference: order.reference,
          status: order.deliveryStatus,
          success: true,
          skipped: true,
          message: 'Waiting for wallet balance — skip duplicate API purchase.',
        });
        continue;
      }

      if (isWithinProviderPurchaseCooldown(order)) {
        results.push({
          reference: order.reference,
          status: order.deliveryStatus,
          success: true,
          skipped: true,
          message: 'Recent provider attempt — cooldown active.',
        });
        continue;
      }

      if (order.deliveryStatus === 'failed') {
        order.deliveryStatus = 'processing';
        order.metadata = {
          ...(order.metadata || {}),
          queuedForProvider: true,
          pendingProviderRetry: true,
          automaticRetryDisabled: false,
          queueReason: 'retry_after_failure',
        };
        await order.save();
      }

      const updated = await fulfillOrder(order._id, io);
      const accepted =
        isOrderSubmittedToProvider(updated)
        || hasConfirmedProviderSubmission(updated)
        || updated?.deliveryStatus === 'delivered';
      results.push({
        reference: order.reference,
        status: updated?.deliveryStatus || 'unknown',
        queueReason: updated?.metadata?.queueReason,
        success: Boolean(accepted || updated),
        accepted: Boolean(accepted),
        stillQueued: !accepted && updated?.deliveryStatus === 'processing',
      });
    } catch (err) {
      results.push({
        reference: order.reference,
        status: 'error',
        success: false,
        message: err.message,
      });
    }
  }

  const delivered = results.filter((r) => r.accepted).length;
  const stillQueued = results.filter((r) => r.stillQueued).length;

  return {
    retried: results.length,
    delivered,
    stillQueued,
    results,
  };
};
