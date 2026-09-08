import { QUEUE_REASONS } from '../utils/providerQueue.js';
import { isRealProviderReference } from '../utils/providerReference.js';

export const applyProviderFulfillment = (order, providerResponse, { successStatus }) => {
  order.providerId = providerResponse.providerId || order.providerId || null;

  const candidateRef = providerResponse.orderId || providerResponse.reference;
  if (candidateRef && isRealProviderReference(candidateRef, order.reference)) {
    order.providerReference = String(candidateRef);
  }

  order.providerResponse = providerResponse;

  if (providerResponse.queued) {
    order.deliveryStatus = 'processing';
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

  // Paid orders stay processing — background retry will re-submit to the provider.
  order.deliveryStatus = 'processing';
  order.failureReason = 'Payment received — your order is being processed.';
  order.retryCount = (order.retryCount || 0) + 1;
  order.metadata = {
    ...(order.metadata || {}),
    queuedForProvider: true,
    queueReason: providerResponse.queueReason || 'provider_rejected',
    lastProviderError: providerResponse.message || 'Provider rejected submission.',
    lastQueueAt: new Date().toISOString(),
  };
  return { shouldNotify: false, queued: true };
};
