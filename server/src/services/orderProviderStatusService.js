import Order from '../models/Order.js';
import { AppError } from '../middleware/errorHandler.js';
import { PROVIDER_DEFINITIONS } from '../config/apiProviders.js';
import { checkProviderStatus } from './providerService.js';
import { resolveProviderForCategory } from './apiProviderService.js';
import { sendNumberVerificationEmail } from './emailService.js';

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

const buildQueuedPayload = (order) => ({
  orderId: order._id,
  reference: order.reference,
  apiReference: order.reference,
  providerId: order.providerId || null,
  providerName: providerDisplayName(order.providerId),
  providerStatus: 'queued',
  deliveryStatus: order.deliveryStatus,
  queueReason: order.metadata?.queueReason || null,
  message: order.failureReason || 'Order is queued and not yet sent to the API.',
  synced: false,
  checkedAt: new Date().toISOString(),
  raw: null,
});

export const maybeSendVerificationEmail = async (order, previousDeliveryStatus) => {
  // MTN verification notices are delayed (pending ≥ 1h30m) — see mtnPendingNoticeService.
  // Immediate email is only for non-MTN when status becomes verification (e.g. admin).
  if (String(order.category || '').toUpperCase() === 'MTN') return false;
  if (order.deliveryStatus !== 'verification') return false;
  if (previousDeliveryStatus === 'verification') return false;
  if (order.metadata?.verificationEmailSentAt) return false;
  if (!order.email) return false;

  await sendNumberVerificationEmail(order.email, order);
  order.metadata = {
    ...(order.metadata || {}),
    verificationEmailSentAt: new Date().toISOString(),
  };
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

  if (order.metadata?.queuedForProvider && !order.providerReference) {
    return buildQueuedPayload(order);
  }

  const providerId = order.providerId || (await resolveProviderForCategory(order.category));
  const apiReference = order.providerReference || order.reference;

  const result = await checkProviderStatus(apiReference, order.category, providerId);
  const mappedDelivery = mapProviderStatusToDelivery(result.status);

  let synced = false;
  const previousDelivery = order.deliveryStatus;

  if (mappedDelivery && mappedDelivery !== order.deliveryStatus) {
    const isMtnData =
      order.serviceType === 'data_bundle' &&
      String(order.category || '').toUpperCase() === 'MTN';

    // MTN data stays pending through processing/verification (1h30m pending notice).
    if (isMtnData && ['processing', 'verification'].includes(mappedDelivery)) {
      // no-op for deliveryStatus
    } else if (
      order.deliveryStatus === 'verification' &&
      mappedDelivery === 'processing'
    ) {
      // keep verification until delivered/failed
    } else {
      order.deliveryStatus = mappedDelivery;
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
    io?.emit('order:updated', {
      reference: order.reference,
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
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
