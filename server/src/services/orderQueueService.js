import Order from '../models/Order.js';

const MAX_FULFILLMENT_RETRIES = 8;

/** Paid orders stuck at processing without a provider reference (never submitted). */
export const findUnsubmittedProviderOrders = (limit = 25) =>
  Order.find({
    paymentStatus: 'paid',
    deliveryStatus: 'processing',
    $or: [{ providerReference: { $exists: false } }, { providerReference: null }, { providerReference: '' }],
    'metadata.queuedForProvider': { $ne: true },
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
    retryCount: { $lt: MAX_FULFILLMENT_RETRIES },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

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
