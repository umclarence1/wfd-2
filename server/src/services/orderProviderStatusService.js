import Order from '../models/Order.js';
import { AppError } from '../middleware/errorHandler.js';
import { PROVIDER_DEFINITIONS } from '../config/apiProviders.js';
import { checkProviderStatus } from './providerService.js';
import { resolveProviderForCategory } from './apiProviderService.js';
import { sendNumberVerificationEmail } from './emailService.js';
import { publishOrderUpdate } from './orderWebhookService.js';
import { isRealProviderReference } from '../utils/providerReference.js';
import { fulfillOrder } from './orderService.js';
import { isMtnDataCategory } from '../utils/validation.js';

const API_SERVICE_TYPES = new Set(['data_bundle', 'afa_registration']);
const OPEN_DELIVERY_STATUSES = ['pending', 'processing', 'verification'];

const mapProviderStatusToDelivery = (providerStatus) => {
  if (providerStatus === 'delivered') return 'delivered';
  if (providerStatus === 'failed') return 'failed';
  if (providerStatus === 'verification') return 'verification';
  if (providerStatus === 'processing') return 'processing';
  return null;
};

const providerDisplayName = (providerId) =>
  (providerId && PROVIDER_DEFINITIONS[providerId]?.name) || providerId || '—';

const buildQueuedPayload = (order, { message, providerStatus = 'queued' } = {}) => ({
  orderId: order._id,
  reference: order.reference,
  apiReference: isRealProviderReference(order.providerReference, order.reference)
    ? order.providerReference
    : null,
  providerId: order.providerId || null,
  providerName: providerDisplayName(order.providerId),
  providerStatus,
  deliveryStatus: order.deliveryStatus,
  queueReason: order.metadata?.queueReason || null,
  message:
    message
    || order.failureReason
    || order.metadata?.lastFulfillmentError
    || 'Order is queued and not yet sent to the API.',
  synced: false,
  checkedAt: new Date().toISOString(),
  raw: null,
});

export const maybeSendVerificationEmail = async (order, previousDeliveryStatus, { force = false } = {}) => {
  // Never send MTN / MTN EXPRESS verification emails to customers.
  if (isMtnDataCategory(order.category)) return false;
  if (order.deliveryStatus !== 'verification') return false;
  if (previousDeliveryStatus === 'verification') return false;
  if (order.metadata?.verificationEmailSentAt) return false;
  if (!order.email) return false;

  await sendNumberVerificationEmail(order.email, order);
  order.metadata = {
    ...(order.metadata || {}),
    verificationEmailSentAt: new Date().toISOString(),
  };
  order.markModified?.('metadata');
  return true;
};

export const syncOrderProviderStatus = async (orderId, io) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found.', 404);

  if (!API_SERVICE_TYPES.has(order.serviceType)) {
    return {
      orderId: order._id,
      reference: order.reference,
      apiReference: order.providerReference || order.reference,
      providerId: order.providerId || null,
      providerName: providerDisplayName(order.providerId),
      providerStatus: order.deliveryStatus,
      deliveryStatus: order.deliveryStatus,
      message: 'This order type does not use an external data API.',
      synced: false,
      checkedAt: new Date().toISOString(),
      raw: order.providerResponse || null,
    };
  }

  if (order.metadata?.queuedForProvider && !isRealProviderReference(order.providerReference, order.reference)) {
    return buildQueuedPayload(order);
  }

  if (
    order.paymentStatus === 'paid'
    && !isRealProviderReference(order.providerReference, order.reference)
  ) {
    try {
      await fulfillOrder(order._id, io);
    } catch (err) {
      console.error('[PROVIDER_SYNC] Auto-submit failed:', order.reference, err.message);
      return buildQueuedPayload(order, {
        providerStatus: 'submit_failed',
        message: err.message || 'Could not submit order to TopDealsGH.',
      });
    }

    const refreshed = await Order.findById(orderId);
    if (!isRealProviderReference(refreshed?.providerReference, refreshed?.reference)) {
      return buildQueuedPayload(refreshed || order, {
        providerStatus: 'queued',
        message:
          refreshed?.failureReason
          || refreshed?.metadata?.lastFulfillmentError
          || 'Payment received — submitting to TopDealsGH. Refresh in a moment.',
      });
    }
    order = refreshed;
  }

  const providerId = order.providerId || (await resolveProviderForCategory(order.category));
  const apiReference = order.providerReference;

  const result = await checkProviderStatus(apiReference, order.category, providerId, order.reference);
  const mappedDelivery = mapProviderStatusToDelivery(result.status);

  let synced = false;
  const previousDelivery = order.deliveryStatus;
  const previousPayment = order.paymentStatus;

  if (mappedDelivery && mappedDelivery !== order.deliveryStatus) {
    let nextStatus = mappedDelivery;

    if (order.paymentStatus === 'paid' && nextStatus === 'failed') {
      nextStatus = 'processing';
      order.metadata = {
        ...(order.metadata || {}),
        queuedForProvider: true,
        queueReason: 'provider_reported_failure',
      };
      order.failureReason = 'Payment received — your order is being processed.';
    } else if (order.paymentStatus === 'paid' && nextStatus === 'pending') {
      nextStatus = 'processing';
    } else if (order.deliveryStatus === 'verification' && nextStatus === 'processing') {
      nextStatus = order.deliveryStatus;
    }

    if (nextStatus !== order.deliveryStatus) {
      order.deliveryStatus = nextStatus;
      synced = true;
    }
  }

  order.metadata = {
    ...(order.metadata || {}),
    lastProviderSyncAt: new Date().toISOString(),
    lastProviderStatus: result.status,
  };

  if (result.raw) {
    order.providerResponse = {
      ...(typeof order.providerResponse === 'object' && order.providerResponse ? order.providerResponse : {}),
      lastStatusCheck: result.raw,
    };
  }

  if (!order.providerId && providerId) {
    order.providerId = providerId;
  }

  const emailed = await maybeSendVerificationEmail(order, previousDelivery);
  await order.save();

  if (synced || emailed) {
    await publishOrderUpdate(order, {
      io,
      trigger: 'provider.sync',
      previousPaymentStatus: previousPayment,
      previousDeliveryStatus: previousDelivery,
    });
  }

  return {
    orderId: order._id,
    reference: order.reference,
    apiReference,
    providerId,
    providerName: providerDisplayName(providerId),
    providerStatus: result.status,
    deliveryStatus: order.deliveryStatus,
    previousDeliveryStatus: previousDelivery,
    message: result.raw?.message || result.raw?.data?.message || null,
    synced,
    verificationEmailSent: emailed,
    checkedAt: order.metadata.lastProviderSyncAt,
    raw: result.raw || null,
  };
};

/** Poll TopDealsGH (and other providers) for open paid orders and update local status. */
export const syncOpenProviderOrders = async (io, { limit = 25 } = {}) => {
  const orders = await Order.find({
    paymentStatus: 'paid',
    serviceType: { $in: [...API_SERVICE_TYPES] },
    deliveryStatus: { $in: OPEN_DELIVERY_STATUSES },
    providerReference: { $exists: true, $nin: [null, ''] },
    'metadata.queuedForProvider': { $ne: true },
  })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .select('_id');

  const summary = {
    checked: 0,
    synced: 0,
    verificationEmails: 0,
    errors: 0,
  };

  for (const { _id } of orders) {
    try {
      const result = await syncOrderProviderStatus(_id, io);
      summary.checked += 1;
      if (result.synced) summary.synced += 1;
      if (result.verificationEmailSent) summary.verificationEmails += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(`[PROVIDER_SYNC] Failed for ${_id}:`, err.message);
    }
  }

  return summary;
};
