import { fulfillOrder } from './orderService.js';
import { findQueuedProviderOrders } from './orderQueueService.js';

export const retryQueuedProviderOrders = async (io, { limit = 25 } = {}) => {
  const orders = await findQueuedProviderOrders(limit);
  const results = [];

  for (const order of orders) {
    try {
      const updated = await fulfillOrder(order._id, io);
      const delivered =
        updated?.deliveryStatus === 'delivered' || updated?.deliveryStatus === 'processing';
      results.push({
        reference: order.reference,
        status: updated?.deliveryStatus || 'unknown',
        queueReason: updated?.metadata?.queueReason,
        success: delivered,
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
