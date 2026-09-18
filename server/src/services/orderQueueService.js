import Order from '../models/Order.js';
import { isRealProviderReference } from '../utils/providerReference.js';
import { MAX_NEVER_SUBMITTED_RETRIES } from '../utils/fulfillmentLock.js';

/** Paid orders stuck at processing without a real TopDeals/provider reference. */
export const findUnsubmittedProviderOrders = async (limit = 25) => {
  const candidates = await Order.find({
    paymentStatus: 'paid',
    deliveryStatus: 'processing',
    'metadata.queuedForProvider': { $ne: true },
    'metadata.fulfillmentInProgress': { $ne: true },
    'metadata.fulfillmentAbandoned': { $ne: true },
    'metadata.manuallyFulfilled': { $ne: true },
    'metadata.submittedToProvider': { $ne: true },
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
    retryCount: { $lt: MAX_NEVER_SUBMITTED_RETRIES },
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
    'metadata.fulfillmentInProgress': { $ne: true },
    'metadata.fulfillmentAbandoned': { $ne: true },
    'metadata.manuallyFulfilled': { $ne: true },
    'metadata.submittedToProvider': { $ne: true },
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
    retryCount: { $lt: MAX_NEVER_SUBMITTED_RETRIES },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

/** Paid orders marked failed — retry fulfillment (e.g. transient TopDeals errors). */
export const findRetryableFailedOrders = (limit = 15) =>
  Order.find({
    paymentStatus: 'paid',
    deliveryStatus: 'failed',
    'metadata.fulfillmentAbandoned': { $ne: true },
    'metadata.manuallyFulfilled': { $ne: true },
    'metadata.submittedToProvider': { $ne: true },
    retryCount: { $lt: MAX_NEVER_SUBMITTED_RETRIES },
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
  })
    .sort({ updatedAt: 1 })
    .limit(limit);

export const getQueuedProviderOrders = (limit = 50) =>
  findQueuedProviderOrders(limit).select(
    'reference deliveryStatus serviceType createdAt metadata failureReason category'
  );
