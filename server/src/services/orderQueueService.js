import Order from '../models/Order.js';
import { isRealProviderReference } from '../utils/providerReference.js';
import { MAX_NEVER_SUBMITTED_RETRIES } from '../utils/fulfillmentLock.js';

/** Only new checkouts tagged for auto TopDeals send. */
const autoFulfillFilter = {
  'metadata.autoProviderFulfill': true,
};

const notSubmittedFilter = {
  'metadata.fulfillmentInProgress': { $ne: true },
  'metadata.fulfillmentAbandoned': { $ne: true },
  'metadata.manuallyFulfilled': { $ne: true },
  'metadata.providerSubmissionLocked': { $ne: true },
  serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
  retryCount: { $lt: MAX_NEVER_SUBMITTED_RETRIES },
  ...autoFulfillFilter,
};

/** Paid orders stuck at processing without a real TopDeals/provider reference. */
export const findUnsubmittedProviderOrders = async (limit = 25) => {
  const candidates = await Order.find({
    paymentStatus: 'paid',
    deliveryStatus: 'processing',
    ...notSubmittedFilter,
    $and: [
      {
        $or: [
          { 'metadata.topdealsOrderId': { $exists: false } },
          { 'metadata.topdealsOrderId': null },
          { 'metadata.topdealsOrderId': '' },
        ],
      },
      {
        $or: [
          { 'metadata.submittedToProvider': { $ne: true } },
          { 'metadata.submittedToProvider': true, providerReference: { $exists: false } },
          { 'metadata.submittedToProvider': true, providerReference: { $in: [null, ''] } },
        ],
      },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(limit * 4, 20));

  return candidates
    .filter((order) => {
      if (order.providerResponse?.alreadySubmitted === true) return false;
      if (order.providerResponse?.orderId || order.metadata?.topdealsOrderId) return false;
      if (isRealProviderReference(order.providerReference, order.reference)) return false;
      return true;
    })
    .slice(0, limit);
};

/** New paid orders that still have no TopDeals id, including ones marked delivered too early. */
export const findAutoOrdersAwaitingProviderId = async (limit = 20) => {
  const candidates = await Order.find({
    paymentStatus: 'paid',
    'metadata.autoProviderFulfill': true,
    'metadata.fulfillmentAbandoned': { $ne: true },
    'metadata.fulfillmentInProgress': { $ne: true },
    'providerResponse.alreadySubmitted': { $ne: true },
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
    retryCount: { $lt: MAX_NEVER_SUBMITTED_RETRIES },
    $or: [
      { 'metadata.topdealsOrderId': { $exists: false } },
      { 'metadata.topdealsOrderId': null },
      { 'metadata.topdealsOrderId': '' },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(limit * 3, 20));

  return candidates
    .filter((order) => {
      if (isRealProviderReference(order.providerReference, order.reference)) return false;
      if (isRealProviderReference(order.providerResponse?.orderId, order.reference)) return false;
      return true;
    })
    .slice(0, limit);
};

export const findQueuedProviderOrders = (limit = 25) =>
  Order.find({
    paymentStatus: 'paid',
    deliveryStatus: { $in: ['pending', 'processing'] },
    'metadata.queuedForProvider': true,
    'metadata.submittedToProvider': { $ne: true },
    ...notSubmittedFilter,
  })
    .sort({ createdAt: -1 })
    .limit(limit);

/** Paid orders marked failed — retry fulfillment (e.g. transient TopDeals errors). */
export const findRetryableFailedOrders = (limit = 15) =>
  Order.find({
    paymentStatus: 'paid',
    deliveryStatus: 'failed',
    'metadata.submittedToProvider': { $ne: true },
    ...notSubmittedFilter,
  })
    .sort({ createdAt: -1 })
    .limit(limit);

export const getQueuedProviderOrders = (limit = 50) =>
  findQueuedProviderOrders(limit).select(
    'reference deliveryStatus serviceType createdAt metadata failureReason category'
  );