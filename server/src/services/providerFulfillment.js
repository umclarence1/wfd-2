import { QUEUE_REASONS } from '../utils/providerQueue.js';

export const applyProviderFulfillment = (order, providerResponse, { successStatus }) => {
  order.providerId = providerResponse.providerId || order.providerId || null;

  if (providerResponse.reference) {
    order.providerReference = String(providerResponse.reference);
  }

  order.providerResponse = providerResponse;

  if (providerResponse.queued) {
    order.deliveryStatus = 'pending';
    order.metadata = {
      ...(order.metadata || {}),
      queuedForProvider: true,
      queueReason: providerResponse.queueReason || QUEUE_REASONS.INSUFFICIENT_BALANCE,
      lastQueueAt: new Date().toISOString(),
      idempotencyKey: order.reference,
    };
    order.failureReason = 'Your order is queued and will be processed shortly.';
    return { shouldNotify: false, queued: true };
  }

  if (providerResponse.success !== false) {
    order.deliveryStatus = successStatus;
    order.metadata = {
      ...(order.metadata || {}),
      queuedForProvider: false,
      queueReason: undefined,
      fulfilledAt: new Date().toISOString(),
    };
    order.failureReason = undefined;
    return { shouldNotify: true, queued: false };
  }

  order.deliveryStatus = 'failed';
  order.failureReason = 'We could not complete delivery at this time. Please contact support if this persists.';
  order.retryCount = (order.retryCount || 0) + 1;
  order.metadata = {
    ...(order.metadata || {}),
    queuedForProvider: false,
  };
  return { shouldNotify: false, queued: false };
};
