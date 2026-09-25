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
      queuedForProvider: false,
      pendingProviderRetry: false,
      automaticRetryDisabled: true,
      lastProviderError: providerResponse.message,
      lastUncertainPurchaseAt: new Date().toISOString(),
    };
    order.failureReason =
      'TopDeals did not confirm this call. It was not sent again. Check TopDeals, then use Resubmit only if that order is missing.';
    appendFulfillmentEvent(order, FULFILLMENT_EVENTS.PROVIDER_SUBMIT_UNCERTAIN, {
      message: providerResponse.message,
    });
    return { shouldNotify: false, queued: false };
  }

  if (providerResponse.queued) {
    const queueReason = providerResponse.queueReason || QUEUE_REASONS.INSUFFICIENT_BALANCE;
    const walletQueue = isWalletOrConfigQueueReason(queueReason);
    order.deliveryStatus = 'processing';
    order.metadata = {
      ...(order.metadata || {}),
      queuedForProvider: false,
      queueReason: walletQueue ? queueReason : (providerResponse.queueReason || undefined),
      lastProviderError: providerResponse.message,
      pendingProviderRetry: false,
      automaticRetryDisabled: true,
      lastQueueAt: new Date().toISOString(),
      idempotencyKey: order.reference,
      fulfillmentAbandoned: false,
    };
    order.failureReason = walletQueue
      ? 'TopDeals wallet is low. This order was not sent again. Fund the wallet, then use admin Resubmit.'
      : providerResponse.message || 'TopDeals refused this order. Use admin Resubmit to send it again.';
    return { shouldNotify: false, queued: walletQueue };
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
    queuedForProvider: false,
    pendingProviderRetry: false,
    automaticRetryDisabled: true,
    fulfillmentAbandoned: abandon,
    queueReason: providerResponse.queueReason || 'provider_rejected',
    lastProviderError: providerResponse.message || 'Provider rejected submission.',
    lastQueueAt: new Date().toISOString(),
  };
  order.failureReason = `TopDeals did not accept this order. It stays Processing until you Resubmit. ${providerResponse.message || ''}`.trim();

  if (candidateRef && isRealProviderReference(candidateRef, order.reference)) {
    order.providerReference = String(candidateRef);
  }

  return { shouldNotify: false, queued: false };
};
