import { getTopDealsGhOrderStatus } from './providers/topdealsghProvider.js';
import { applyProviderFulfillment } from './providerFulfillment.js';
import {
  hasConfirmedProviderSubmission,
  isOrderSubmittedToProvider,
  markOrderSubmittedToProvider,
} from '../utils/fulfillmentLock.js';
import { appendFulfillmentEvent, FULFILLMENT_EVENTS, logFulfillmentEvent } from './fulfillmentAudit.js';

const mapTopDealsStatus = (raw) => {
  const status = String(raw?.data?.status || raw?.status || raw?.data?.deliveryStatus || '').toLowerCase();
  if (status.includes('deliver')) return 'delivered';
  if (status.includes('fail')) return 'failed';
  if (status.includes('verif')) return 'verification';
  if (status) return 'processing';
  return 'processing';
};

/**
 * Before POST /purchase, check whether TopDeals already accepted this order.
 * TopDeals documents client `reference` on purchase; status lookup uses provider order id (GET /orders/:id).
 */
export const reconcileTopDealsOrderBeforePurchase = async (order, creds) => {
  if (!order || isOrderSubmittedToProvider(order)) {
    return { action: 'already_submitted', order };
  }

  const candidateId =
    order.metadata?.topdealsOrderId
    || order.providerResponse?.orderId
    || order.providerResponse?.raw?.data?.orderId;

  if (!candidateId) {
    appendFulfillmentEvent(order, FULFILLMENT_EVENTS.RECONCILE_MISS, {
      reason: 'no_provider_order_id',
    });
    return { action: 'proceed', order };
  }

  try {
    const raw = await getTopDealsGhOrderStatus(creds, candidateId);
    const orderId = raw?.data?.orderId || raw?.data?.id || candidateId;
    logFulfillmentEvent(order.reference, FULFILLMENT_EVENTS.RECONCILE_HIT, {
      topdealsOrderId: String(orderId),
    });
    appendFulfillmentEvent(order, FULFILLMENT_EVENTS.RECONCILE_HIT, {
      topdealsOrderId: String(orderId),
    });

    const providerResponse = {
      success: true,
      orderId: String(orderId),
      providerId: 'topdealsgh',
      message: raw?.message || 'Reconciled existing TopDeals order.',
      raw,
      alreadySubmitted: true,
    };
    applyProviderFulfillment(order, providerResponse, { successStatus: 'processing' });
    return { action: 'reconciled', order, providerStatus: mapTopDealsStatus(raw) };
  } catch (err) {
    logFulfillmentEvent(order.reference, FULFILLMENT_EVENTS.RECONCILE_MISS, {
      topdealsOrderId: String(candidateId),
      message: err.message,
    });
    appendFulfillmentEvent(order, FULFILLMENT_EVENTS.RECONCILE_MISS, {
      topdealsOrderId: String(candidateId),
      message: err.message,
    });
    return { action: 'proceed', order };
  }
};

export const ensureFulfillmentIdempotencyKey = (order) => {
  if (!order) return null;
  order.metadata = order.metadata || {};
  if (!order.metadata.fulfillmentIdempotencyKey) {
    order.metadata.fulfillmentIdempotencyKey = order.reference;
  }
  return order.metadata.fulfillmentIdempotencyKey;
};

export const persistTopDealsOrderId = (order, orderId) => {
  if (!orderId) return;
  order.metadata = order.metadata || {};
  order.metadata.topdealsOrderId = String(orderId);
  if (hasConfirmedProviderSubmission(order)) {
    markOrderSubmittedToProvider(order, String(orderId), order.providerId || 'topdealsgh');
  }
};
