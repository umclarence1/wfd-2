import Order from '../models/Order.js';
import { isRealProviderReference } from '../utils/providerReference.js';

const MAX_FULFILLMENT_RETRIES = 8;

/** Paid orders stuck at processing without a real TopDeals/provider reference. */
export const findUnsubmittedProviderOrders = async (limit = 25) => {
  const candidates = await Order.find({
    paymentStatus: 'paid',
    deliveryStatus: 'processing',
    'metadata.queuedForProvider': { $ne: true },
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
    retryCount: { $lt: MAX_FULFILLMENT_RETRIES },
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(limit * 4, 20));

  return candidates
    .filter((order) => !isRealProviderReference(order.providerReference, order.reference))
    .slice(0, limit);
};

export const findQueuedProviderOrders = (limit = 25) =>
  Order.find({
    paymentStatus: 'paid',
    deliveryStatus: { $in: ['pending', 'processing'] },
    'metadata.queuedForProvider': true,
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
    retryCount: { $lt: MAX_FULFILLMENT_RETRIES },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

/** Paid orders marked failed — retry fulfillment (e.g. transient TopDeals errors). */
export const findRetryableFailedOrders = (limit = 15) =>
  Order.find({
    paymentStatus: 'paid',
    deliveryStatus: 'failed',
    retryCount: { $lt: MAX_FULFILLMENT_RETRIES },
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
  })
    .sort({ updatedAt: 1 })
    .limit(limit);

export const getQueuedProviderOrders = (limit = 50) =>
  findQueuedProviderOrders(limit).select(
    'reference deliveryStatus serviceType createdAt metadata failureReason category'
  );
