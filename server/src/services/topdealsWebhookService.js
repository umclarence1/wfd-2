import Order from '../models/Order.js';
import {
  mapTopDealsWebhookStatus,
  normalizeTopDealsWebhookPayload,
} from './topdealsWebhookAuth.js';
import { maybeSendVerificationEmail } from './orderProviderStatusService.js';
import { PROVIDER_IDS } from '../config/apiProviders.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findOrderForTopDealsWebhook = async (payload) => {
  const providerOrderId = String(payload?.orderId || '').trim();
  if (providerOrderId) {
    let order = await Order.findOne({ providerReference: providerOrderId });
    if (order) return order;

    // Checker / multi-ref may store "TD-1, TD-2"
    order = await Order.findOne({
      providerReference: new RegExp(`(^|,\\s*)${escapeRegex(providerOrderId)}(,|$)`, 'i'),
    });
    if (order) return order;

    order = await Order.findOne({ reference: providerOrderId });
    if (order) return order;

    order = await Order.findOne({
      paymentStatus: 'paid',
      'providerResponse.orderId': providerOrderId,
    });
    if (order) return order;

    order = await Order.findOne({
      paymentStatus: 'paid',
      'providerResponse.raw.data.orderId': providerOrderId,
    });
    if (order) return order;
  }

  // Phone-only matching is too ambiguous — require provider orderId.
  return null;
};

/**
 * Apply an inbound TopDealsGH webhook to a local order.
 * Returns { ok, found, synced, verificationEmailSent, order }.
 */
export const applyTopDealsWebhook = async (rawPayload, io) => {
  const payload = normalizeTopDealsWebhookPayload(rawPayload);
  const deliveryStatus = mapTopDealsWebhookStatus(payload);
  const order = await findOrderForTopDealsWebhook(payload);

  if (!order) {
    console.warn('[TOPDEALS_WEBHOOK] No matching order', {
      orderId: payload.orderId || null,
      event: payload.event || null,
      status: payload.status || null,
      phone: payload.recipientPhone || null,
    });
    return {
      ok: true,
      found: false,
      synced: false,
      verificationEmailSent: false,
      message: 'No matching local order.',
      orderId: payload.orderId || null,
    };
  }

  const previousDelivery = order.deliveryStatus;
  let synced = false;

  const isMtnData =
    order.serviceType === 'data_bundle' &&
    String(order.category || '').toUpperCase() === 'MTN';

  if (deliveryStatus && deliveryStatus !== order.deliveryStatus) {
    // MTN data stays pending through processing/verification so the 1h30m notice can fire.
    if (isMtnData && ['processing', 'verification'].includes(deliveryStatus)) {
      // keep pending; still record webhook metadata below
    } else if (!(order.deliveryStatus === 'verification' && deliveryStatus === 'processing')) {
      order.deliveryStatus = deliveryStatus;
      synced = true;
    }
  }

  if (payload.orderId) {
    const providerOrderId = String(payload.orderId).trim();
    if (!order.providerReference) {
      order.providerReference = providerOrderId;
    } else if (
      !String(order.providerReference).includes(providerOrderId) &&
      order.providerReference !== providerOrderId
    ) {
      // Prefer the provider id when we previously stored our local reference.
      if (order.providerReference === order.reference) {
        order.providerReference = providerOrderId;
      }
    }
  }

  order.providerId = order.providerId || PROVIDER_IDS.TOPDEALSGH;
  order.providerResponse = {
    ...(typeof order.providerResponse === 'object' && order.providerResponse
      ? order.providerResponse
      : {}),
    lastWebhook: {
      at: new Date().toISOString(),
      event: payload.event,
      status: payload.status,
      providerStatus: payload.providerStatus,
      orderId: payload.orderId,
      raw: rawPayload,
    },
  };

  order.metadata = {
    ...(order.metadata || {}),
    lastProviderSyncAt: new Date().toISOString(),
    lastProviderStatus: deliveryStatus || payload.status || payload.event,
    lastWebhookEvent: payload.event || null,
    queuedForProvider: false,
  };

  if (['failed', 'cancelled', 'refunded'].includes(order.deliveryStatus)) {
    order.failureReason =
      payload.message || `Provider reported ${order.deliveryStatus}.`;
  } else if (order.deliveryStatus === 'delivered' || order.deliveryStatus === 'verification') {
    order.failureReason = undefined;
  }

  const emailed = await maybeSendVerificationEmail(order, previousDelivery);
  await order.save();

  console.log('[TOPDEALS_WEBHOOK] Applied', {
    reference: order.reference,
    orderId: payload.orderId,
    previousDelivery,
    deliveryStatus: order.deliveryStatus,
    synced,
    emailed,
  });

  if (synced || emailed) {
    io?.emit('order:updated', {
      reference: order.reference,
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
    });
  }

  return {
    ok: true,
    found: true,
    synced,
    verificationEmailSent: emailed,
    reference: order.reference,
    deliveryStatus: order.deliveryStatus,
    previousDeliveryStatus: previousDelivery,
  };
};
