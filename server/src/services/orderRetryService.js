import { fulfillOrder } from './orderService.js';
import { findQueuedProviderOrders, findRetryableFailedOrders, findUnsubmittedProviderOrders } from './orderQueueService.js';

export const retryQueuedProviderOrders = async (io, { limit = 25 } = {}) => {
  const queued = await findQueuedProviderOrders(limit);
  const unsubmitted = await findUnsubmittedProviderOrders(Math.max(5, Math.floor(limit / 2)));
  const failed = await findRetryableFailedOrders(Math.max(5, Math.floor(limit / 2)));
  const seen = new Set();
  const orders = [];

  for (const order of [...queued, ...unsubmitted, ...failed]) {
    const id = String(order._id);
    if (seen.has(id)) continue;
    seen.add(id);
    orders.push(order);
  }

  const results = [];

  for (const order of orders) {
    try {
      if (order.deliveryStatus === 'failed') {
        order.deliveryStatus = 'processing';
        order.metadata = {
          ...(order.metadata || {}),
          queuedForProvider: true,
          queueReason: 'retry_after_failure',
        };
        await order.save();
      }

      const updated = await fulfillOrder(order._id, io);
      const ok =
        updated?.deliveryStatus === 'delivered'
        || updated?.deliveryStatus === 'processing'
        || updated?.deliveryStatus === 'pending'
        || updated?.deliveryStatus === 'verification';
      results.push({
        reference: order.reference,
        status: updated?.deliveryStatus || 'unknown',
        queueReason: updated?.metadata?.queueReason,
        success: ok,
        stillQueued: updated?.metadata?.queuedForProvider === true,
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

  const delivered = results.filter((r) => r.success).length;
  const stillQueued = results.filter((r) => r.stillQueued).length;

  return {
    retried: results.length,
    delivered,
    stillQueued,
    results,
  };
};
