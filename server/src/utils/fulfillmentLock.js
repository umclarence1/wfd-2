import Order from '../models/Order.js';
import { isRealProviderReference } from './providerReference.js';

const LOCK_STALE_MS = 5 * 60 * 1000;
export const MAX_NEVER_SUBMITTED_RETRIES = 15;

export const MANUAL_DELIVERY_SERVICE_TYPES = new Set(['data_bundle', 'afa_registration']);

/** Once TopDeals has the order, admin shows delivered — even while TopDeals is still sending the bundle. */
export const resolveDeliveryStatusFromProvider = (_order, providerStatus) => {
  if (!providerStatus) return null;
  if (providerStatus === 'failed') return 'failed';
  if (providerStatus === 'verification') return 'verification';
  if (providerStatus === 'delivered' || providerStatus === 'processing') return 'delivered';
  return null;
};

/** Never attempt API fulfillment (admin handled or customer completed). */
export const shouldSkipAutoFulfillment = (order) =>
  !order
  || order.paymentStatus !== 'paid'
  || order.deliveryStatus === 'delivered'
  || order.metadata?.manuallyFulfilled === true
  || order.metadata?.providerSubmissionLocked === true;

/** Order already accepted by a provider — do not submit again (duplicate prevention). */
export const shouldNeverResubmitToProvider = (order) => {
  if (!order) return true;
  if (shouldSkipAutoFulfillment(order)) return true;
  return isOrderSubmittedToProvider(order);
};

/** TopDeals (or other provider) returned a trackable id — not our local ORD-/PAY- reference. */
export const hasConfirmedProviderSubmission = (order) => {
  if (!order) return false;
  const rawId = order.providerResponse?.raw?.data?.orderId || order.providerResponse?.raw?.orderId;
  if (order.providerResponse?.orderId || rawId || order.metadata?.topdealsOrderId) return true;
  if (order.providerResponse?.success === true || order.providerResponse?.alreadySubmitted === true) return true;
  if (isRealProviderReference(order.providerReference, order.reference)) return true;
  return false;
};

/** Paid orders TopDeals already accepted should not stay on Processing. */
export const markAcceptedProviderOrdersDelivered = () =>
  Order.updateMany(
    {
      paymentStatus: 'paid',
      deliveryStatus: { $in: ['pending', 'processing', 'verification'] },
      $or: [
        { 'providerResponse.success': true },
        { 'providerResponse.alreadySubmitted': true },
        { 'providerResponse.orderId': { $exists: true, $nin: [null, ''] } },
        { 'metadata.topdealsOrderId': { $exists: true, $nin: [null, ''] } },
        { 'metadata.submittedToProvider': true, 'metadata.fulfilledAt': { $exists: true, $nin: [null, ''] } },
        { providerReference: { $regex: '^ORD-\\d{10,}-\\d+$' } },
        { providerReference: { $regex: '^ORD\\d{8}[A-Z0-9]+$', $options: 'i' } },
      ],
    },
    {
      $set: {
        deliveryStatus: 'delivered',
        'metadata.manuallyFulfilled': true,
        'metadata.providerSubmissionLocked': true,
        'metadata.queuedForProvider': false,
        'metadata.pendingProviderRetry': false,
      },
    }
  );

/** Order already accepted by TopDealsGH / provider — do not purchase again. */
export const isOrderSubmittedToProvider = (order) => {
  if (!order) return false;
  if (hasConfirmedProviderSubmission(order)) return true;
  if (order.providerResponse?.alreadySubmitted === true && hasConfirmedProviderSubmission(order)) {
    return true;
  }
  // Legacy rows: submittedToProvider without a real provider id blocked retries and showed "not submitted".
  if (order.metadata?.submittedToProvider === true) {
    return hasConfirmedProviderSubmission(order);
  }
  return false;
};

/** Clear mistaken "submitted" when only a local ORD-* value was stored as providerReference. */
export const repairStaleProviderSubmission = (order) => {
  if (
    !order
    || order.deliveryStatus === 'delivered'
    || order.metadata?.manuallyFulfilled === true
    || order.metadata?.providerSubmissionLocked === true
  ) {
    return false;
  }
  if (!order?.metadata?.submittedToProvider) return false;
  if (hasConfirmedProviderSubmission(order)) return false;

  order.metadata = {
    ...(order.metadata || {}),
    submittedToProvider: false,
    pendingProviderRetry: true,
    queuedForProvider: false,
  };
  if (order.providerReference && !isRealProviderReference(order.providerReference, order.reference)) {
    order.providerReference = undefined;
  }
  return true;
};

export const PROVIDER_PURCHASE_COOLDOWN_MS = 90 * 1000;
/** After timeout/unknown provider response — wait before another POST /purchase. */
export const UNCERTAIN_SUBMISSION_COOLDOWN_MS = 5 * 60 * 1000;

export const isWithinProviderPurchaseCooldown = (order) => {
  const at = order?.metadata?.providerPurchaseAttemptedAt;
  if (!at) return false;
  const windowMs = order?.metadata?.requiresReconciliation
    ? UNCERTAIN_SUBMISSION_COOLDOWN_MS
    : PROVIDER_PURCHASE_COOLDOWN_MS;
  return Date.now() - new Date(at).getTime() < windowMs;
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
      $or: [
        { 'metadata.topdealsOrderId': { $exists: false } },
        { 'metadata.topdealsOrderId': null },
        { 'metadata.topdealsOrderId': '' },
      ],
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
  const ref = providerReference ? String(providerReference).trim() : '';
  const trackable =
    order.providerResponse?.orderId
    || (ref && isRealProviderReference(ref, order.reference) ? ref : null);

  if (trackable) {
    order.providerReference = String(trackable);
  } else if (ref && isRealProviderReference(ref, order.reference)) {
    order.providerReference = ref;
  }

  if (providerId) {
    order.providerId = providerId;
  }

  if (!trackable && !isRealProviderReference(order.providerReference, order.reference)) {
    order.metadata = {
      ...(order.metadata || {}),
      submittedToProvider: false,
      pendingProviderRetry: true,
    };
    return;
  }

  const confirmedId =
    order.providerResponse?.orderId
    || (trackable ? String(trackable) : null);

  order.metadata = {
    ...(order.metadata || {}),
    submittedToProvider: true,
    submittedToProviderAt: new Date().toISOString(),
    queuedForProvider: false,
    queueReason: undefined,
    pendingProviderRetry: false,
    requiresReconciliation: false,
    fulfillmentAbandoned: false,
    ...(confirmedId ? { topdealsOrderId: String(confirmedId) } : {}),
  };
};

export const markManualFulfillment = (order) => {
  order.metadata = {
    ...(order.metadata || {}),
    manuallyFulfilled: true,
    manuallyFulfilledAt: new Date().toISOString(),
    providerSubmissionLocked: true,
    queuedForProvider: false,
    pendingProviderRetry: false,
    requiresReconciliation: false,
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
