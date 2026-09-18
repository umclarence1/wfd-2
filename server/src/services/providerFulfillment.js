import { QUEUE_REASONS } from '../utils/providerQueue.js';
import { isRealProviderReference } from '../utils/providerReference.js';
import {
  isOrderSubmittedToProvider,
  markOrderSubmittedToProvider,
  shouldAbandonNeverSubmittedRetries,
} from '../utils/fulfillmentLock.js';

export const applyProviderFulfillment = (order, providerResponse, { successStatus }) => {
  order.providerId = providerResponse.providerId || order.providerId || null;

  const candidateRef =
    providerResponse.orderId
    || providerResponse.orderNumber
    || providerResponse.batchId
    || providerResponse.reference;

  order.providerResponse = providerResponse;

  if (providerResponse.queued) {
    order.deliveryStatus = 'processing';
    order.metadata = {
      ...(order.metadata || {}),
      queuedForProvider: true,
      queueReason: providerResponse.queueReason || QUEUE_REASONS.INSUFFICIENT_BALANCE,
      lastQueueAt: new Date().toISOString(),
      idempotencyKey: order.reference,
      fulfillmentAbandoned: false,
    };
    order.failureReason = 'Your order is queued and will be processed shortly.';
    return { shouldNotify: false, queued: true };
  }

  if (providerResponse.success === true || providerResponse.alreadySubmitted === true) {
    order.deliveryStatus = successStatus;
    markOrderSubmittedToProvider(
      order,
      candidateRef || order.reference,
      providerResponse.providerId || order.providerId || 'topdealsgh'
    );
    order.metadata.fulfilledAt = new Date().toISOString();
    if (providerResponse.topdealsPackageId) {
      order.metadata.topdealsPackageId = providerResponse.topdealsPackageId;
    }
    order.failureReason = undefined;
    return { shouldNotify: true, queued: false };
  }

  // Already submitted — never queue another API attempt.
  if (isOrderSubmittedToProvider(order)) {
    order.deliveryStatus = 'processing';
    order.failureReason = providerResponse.message || 'Provider reported an issue after submission.';
    return { shouldNotify: false, queued: false };
  }

  order.deliveryStatus = 'processing';
  order.retryCount = (order.retryCount || 0) + 1;

  const abandon = shouldAbandonNeverSubmittedRetries(order, providerResponse);
  order.metadata = {
    ...(order.metadata || {}),
    queuedForProvider: abandon ? false : true,
    fulfillmentAbandoned: abandon,
    queueReason: providerResponse.queueReason || 'provider_rejected',
    lastProviderError: providerResponse.message || 'Provider rejected submission.',
    lastQueueAt: new Date().toISOString(),
  };
  order.failureReason = abandon
    ? `Could not submit to provider after ${order.retryCount} attempts — use Admin resubmit or fulfill manually. ${providerResponse.message || ''}`.trim()
    : 'Payment received — retrying provider submission shortly.';

  if (candidateRef && isRealProviderReference(candidateRef, order.reference)) {
    order.providerReference = String(candidateRef);
  }

  return { shouldNotify: false, queued: !abandon };
};
