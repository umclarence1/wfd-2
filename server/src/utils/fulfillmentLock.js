import Order from '../models/Order.js';
import { isRealProviderReference } from './providerReference.js';

const LOCK_STALE_MS = 5 * 60 * 1000;
export const MAX_NEVER_SUBMITTED_RETRIES = 15;

export const MANUAL_DELIVERY_SERVICE_TYPES = new Set(['data_bundle', 'afa_registration']);

/** Data bundles stay processing after API submit — admin marks delivered manually. */
export const resolveDeliveryStatusFromProvider = (order, providerStatus) => {
  if (!providerStatus) return null;
  if (MANUAL_DELIVERY_SERVICE_TYPES.has(order.serviceType) && providerStatus === 'delivered') {
    return 'processing';
  }
  if (providerStatus === 'delivered') return 'delivered';
  if (providerStatus === 'failed') return 'failed';
  if (providerStatus === 'verification') return 'verification';
  if (providerStatus === 'processing') return 'processing';
  return null;
};

/** Never attempt API fulfillment (admin handled or customer completed). */
export const shouldSkipAutoFulfillment = (order) =>
  !order
  || order.paymentStatus !== 'paid'
  || order.deliveryStatus === 'delivered'
  || order.metadata?.manuallyFulfilled === true;

/** Order already accepted by a provider — do not submit again (duplicate prevention). */
export const shouldNeverResubmitToProvider = (order) => {
  if (!order) return true;
  if (shouldSkipAutoFulfillment(order)) return true;
  return isOrderSubmittedToProvider(order);
};

/** Order already accepted by TopDealsGH / provider — do not purchase again. */
export const isOrderSubmittedToProvider = (order) => {
  if (!order) return false;
  if (order.metadata?.submittedToProvider === true) return true;
  if (order.providerResponse?.alreadySubmitted === true) return true;
  if (order.providerResponse?.success === true && order.metadata?.fulfilledAt) return true;
  if (order.providerResponse?.orderId) return true;
  if (isRealProviderReference(order.providerReference, order.reference)) return true;
  return false;
};

export const PROVIDER_PURCHASE_COOLDOWN_MS = 90 * 1000;

export const isWithinProviderPurchaseCooldown = (order) => {
  const at = order?.metadata?.providerPurchaseAttemptedAt;
  if (!at) return false;
  return Date.now() - new Date(at).getTime() < PROVIDER_PURCHASE_COOLDOWN_MS;
};

export const hasExhaustedSubmitRetries = (order) =>
  (order?.retryCount || 0) >= MAX_NEVER_SUBMITTED_RETRIES;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry briefly when another handler holds the lock — avoids queueing a fresh paid order. */
export const claimFulfillmentWithRetry = async (orderId, { attempts = 6, delayMs = 400 } = {}) => {
  for (let i = 0; i < attempts; i += 1) {
    const claimed = await claimFulfillment(orderId);
    if (claimed) return claimed;

    const order = await Order.findById(orderId).lean();
    if (!order || shouldNeverResubmitToProvider(order)) return null;

    if (order.metadata?.fulfillmentInProgress === true && i < attempts - 1) {
      await sleep(delayMs);
      continue;
    }

    return null;
  }
  return null;
};

/** Atomically claim fulfillment so concurrent webhooks/retries cannot double-submit. */
export const claimFulfillment = async (orderId) => {
  const existing = await Order.findById(orderId).lean();
  if (!existing || shouldNeverResubmitToProvider(existing)) return null;
  if (hasExhaustedSubmitRetries(existing) && existing.metadata?.fulfillmentAbandoned) return null;

  const lockAt = existing.metadata?.fulfillmentInProgressAt;
  const lockIsStale =
    existing.metadata?.fulfillmentInProgress === true
    && lockAt
    && Date.now() - new Date(lockAt).getTime() > LOCK_STALE_MS;

  if (existing.metadata?.fulfillmentInProgress === true && !lockIsStale) {
    return null;
  }

  if (lockIsStale) {
    await Order.updateOne(
      { _id: orderId },
      { $unset: { 'metadata.fulfillmentInProgress': '', 'metadata.fulfillmentInProgressAt': '' } }
    );
  }

  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: 'paid',
      deliveryStatus: { $ne: 'delivered' },
      'metadata.fulfillmentInProgress': { $ne: true },
      'metadata.manuallyFulfilled': { $ne: true },
      'metadata.submittedToProvider': { $ne: true },
    },
    {
      $set: {
        'metadata.fulfillmentInProgress': true,
        'metadata.fulfillmentInProgressAt': new Date().toISOString(),
        'metadata.fulfillmentAbandoned': false,
      },
    },
    { new: true }
  );

  if (claimed && shouldNeverResubmitToProvider(claimed)) {
    await releaseFulfillmentLock(orderId);
    return null;
  }

  return claimed;
};

export const releaseFulfillmentLock = async (orderId) => {
  await Order.updateOne(
    { _id: orderId },
    {
      $set: { 'metadata.fulfillmentInProgress': false },
      $unset: { 'metadata.fulfillmentInProgressAt': '' },
    }
  );
};

export const markOrderSubmittedToProvider = (order, providerReference, providerId) => {
  if (providerReference) {
    order.providerReference = String(providerReference);
  }
  if (providerId) {
    order.providerId = providerId;
  }
  order.metadata = {
    ...(order.metadata || {}),
    submittedToProvider: true,
    submittedToProviderAt: new Date().toISOString(),
    queuedForProvider: false,
    queueReason: undefined,
    fulfillmentAbandoned: false,
  };
};

export const markManualFulfillment = (order) => {
  order.metadata = {
    ...(order.metadata || {}),
    manuallyFulfilled: true,
    manuallyFulfilledAt: new Date().toISOString(),
    queuedForProvider: false,
    fulfillmentInProgress: false,
  };
  order.failureReason = undefined;
};

/** Stop retrying only after many failed attempts and the order was never accepted by the API. */
export const shouldAbandonNeverSubmittedRetries = (order, providerResponse) => {
  if (isOrderSubmittedToProvider(order)) return false;
  if (providerResponse?.alreadySubmitted) return false;
  return hasExhaustedSubmitRetries(order);
};
