import { QUEUE_REASONS, isWalletOrConfigQueueReason } from '../utils/providerQueue.js';
import { isRealProviderReference } from '../utils/providerReference.js';
import {
  isOrderSubmittedToProvider,
  markManualFulfillment,
  markOrderSubmittedToProvider,
  shouldAbandonNeverSubmittedRetries,
} from '../utils/fulfillmentLock.js';
import { appendFulfillmentEvent, FULFILLMENT_EVENTS } from './fulfillmentAudit.js';

export const applyProviderFulfillment = (order, providerResponse, { successStatus }) => {
  order.providerId = providerResponse.providerId || order.providerId || null;

  const candidateRef =
    providerResponse.orderId
    || providerResponse.orderNumber
    || providerResponse.batchId
    || providerResponse.reference;

  order.providerResponse = providerResponse;

  if (providerResponse.uncertain) {
    order.deliveryStatus = 'processing';
    if (providerResponse.orderId) {
      order.metadata = {
        ...(order.metadata || {}),
        topdealsOrderId: String(providerResponse.orderId),
      };
    }
    order.metadata = {
      ...(order.metadata || {}),
      requiresReconciliation: true,
      queuedForProvider: true,
      pendingProviderRetry: true,
      automaticRetryDisabled: false,
      lastProviderError: providerResponse.message,
      lastUncertainPurchaseAt: new Date().toISOString(),
    };
    order.failureReason =
      'TopDeals did not confirm this call. Will reconcile and retry automatically.';
    appendFulfillmentEvent(order, FULFILLMENT_EVENTS.PROVIDER_SUBMIT_UNCERTAIN, {
      message: providerResponse.message,
    });
    return { shouldNotify: false, queued: true };
  }

  if (providerResponse.queued) {
    const queueReason = providerResponse.queueReason || QUEUE_REASONS.INSUFFICIENT_BALANCE;
    const walletQueue = isWalletOrConfigQueueReason(queueReason);
    order.deliveryStatus = 'processing';
    order.metadata = {
      ...(order.metadata || {}),
      queuedForProvider: true,
      queueReason: walletQueue ? queueReason : (providerResponse.queueReason || undefined),
      lastProviderError: providerResponse.message,
      pendingProviderRetry: true,
      automaticRetryDisabled: false,
      lastQueueAt: new Date().toISOString(),
      idempotencyKey: order.reference,
      fulfillmentAbandoned: false,
    };
    order.failureReason = walletQueue
      ? 'TopDeals wallet is low. Will retry automatically after the wallet is funded.'
      : providerResponse.message || 'TopDeals refused this order. Will retry automatically.';
    return { shouldNotify: false, queued: true };
  }

  if (providerResponse.success === true || providerResponse.alreadySubmitted === true) {
    const trackableRef =
      providerResponse.orderId
      || (candidateRef && isRealProviderReference(candidateRef, order.reference) ? candidateRef : null);
    markOrderSubmittedToProvider(
      order,
      trackableRef,
      providerResponse.providerId || order.providerId || 'topdealsgh'
    );
    order.deliveryStatus = 'delivered';
    order.metadata = {
      ...(order.metadata || {}),
      fulfilledAt: new Date().toISOString(),
      submittedToProvider: true,
      submittedToProviderAt: order.metadata?.submittedToProviderAt || new Date().toISOString(),
      pendingProviderRetry: false,
    };
    markManualFulfillment(order);
    appendFulfillmentEvent(order, FULFILLMENT_EVENTS.PROVIDER_SUBMIT_OK, {
      topdealsOrderId: order.metadata?.topdealsOrderId || providerResponse.orderId || null,
    });
    if (providerResponse.topdealsPackageId) {
      order.metadata.topdealsPackageId = providerResponse.topdealsPackageId;
    }
    order.failureReason = undefined;
    return { shouldNotify: isOrderSubmittedToProvider(order), queued: false };
  }

  // Already accepted by TopDeals — keep delivered and do not send again.
  if (isOrderSubmittedToProvider(order) || order.metadata?.providerSubmissionLocked) {
    order.deliveryStatus = 'delivered';
    markManualFulfillment(order);
    order.failureReason = undefined;
    return { shouldNotify: false, queued: false };
  }

  order.deliveryStatus = 'processing';
  order.retryCount = (order.retryCount || 0) + 1;

  const abandon = shouldAbandonNeverSubmittedRetries(order, providerResponse);
  order.metadata = {
    ...(order.metadata || {}),
    queuedForProvider: !abandon,
    pendingProviderRetry: !abandon,
    automaticRetryDisabled: false,
    fulfillmentAbandoned: abandon,
    queueReason: providerResponse.queueReason || 'provider_rejected',
    lastProviderError: providerResponse.message || 'Provider rejected submission.',
    lastQueueAt: new Date().toISOString(),
  };
  order.failureReason = abandon
    ? `TopDeals did not accept this order after repeated tries. ${providerResponse.message || ''}`.trim()
    : `TopDeals did not accept this order. Will retry automatically. ${providerResponse.message || ''}`.trim();

  if (candidateRef && isRealProviderReference(candidateRef, order.reference)) {
    order.providerReference = String(candidateRef);
  }

  return { shouldNotify: false, queued: false };
};
