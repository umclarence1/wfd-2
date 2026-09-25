import Order from '../models/Order.js';
import { fulfillOrder } from './orderService.js';
import { isOrderSubmittedToProvider } from '../utils/fulfillmentLock.js';
import { QUEUE_REASONS } from '../utils/providerQueue.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wallet/config only — other failures retry via cron without a "queued" flag. */
const NON_RETRYABLE_QUEUE_REASONS = new Set([
  QUEUE_REASONS.INSUFFICIENT_BALANCE,
  QUEUE_REASONS.FORWARDING_OFF,
  QUEUE_REASONS.NETWORK_OFF,
]);

/**
 * Submit to TopDealsGH in-process right after payment — no background queue wait.
 */
/** One automatic TopDeals call per paid order. Admin Resubmit is the only second send. */
export const fulfillPaidOrderImmediately = async (orderId, io, { maxAttempts = 1 } = {}) => {
  let lastOrder = await Order.findById(orderId);
  if (!lastOrder || isOrderSubmittedToProvider(lastOrder)) {
    return lastOrder;
  }
  if (lastOrder.metadata?.providerPurchaseAttemptedAt) {
    return lastOrder;
  }

  const reason = lastOrder.metadata?.queueReason;
  if (reason && NON_RETRYABLE_QUEUE_REASONS.has(reason)) {
    return lastOrder;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastOrder = await Order.findById(orderId);
    if (!lastOrder || isOrderSubmittedToProvider(lastOrder)) {
      return lastOrder;
    }

    const queueReason = lastOrder.metadata?.queueReason;
    if (queueReason && NON_RETRYABLE_QUEUE_REASONS.has(queueReason)) {
      return lastOrder;
    }

    try {
      await fulfillOrder(orderId, io);
    } catch (err) {
      console.error('[FULFILL_NOW] Attempt failed:', lastOrder.reference, err.message);
    }

    lastOrder = await Order.findById(orderId);
    if (!lastOrder || isOrderSubmittedToProvider(lastOrder)) {
      return lastOrder;
    }

    if (NON_RETRYABLE_QUEUE_REASONS.has(lastOrder.metadata?.queueReason)) {
      return lastOrder;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(lastOrder.metadata?.fulfillmentInProgress ? 600 : 400);
    }
  }

  return lastOrder;
};
