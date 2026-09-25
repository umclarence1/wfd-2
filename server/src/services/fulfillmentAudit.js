/** Structured fulfilment audit — no secrets or full phone numbers in logs. */

const maskPhone = (phone) => {
  const s = String(phone || '');
  if (s.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
};

export const FULFILLMENT_EVENTS = {
  PAYMENT_VERIFIED: 'payment.verified',
  DUPLICATE_PAYMENT_IGNORED: 'duplicate_payment.ignored',
  CLAIM_WON: 'fulfillment.claim.won',
  CLAIM_SKIPPED: 'fulfillment.claim.skipped',
  PROVIDER_SUBMIT_START: 'provider.submit.start',
  PROVIDER_SUBMIT_OK: 'provider.submit.ok',
  PROVIDER_SUBMIT_UNCERTAIN: 'provider.submit.uncertain',
  PROVIDER_SUBMIT_REJECTED: 'provider.submit.rejected',
  RECONCILE_HIT: 'provider.reconcile.found',
  RECONCILE_MISS: 'provider.reconcile.miss',
  DUPLICATE_PREVENTED: 'fulfillment.duplicate_prevented',
  RETRY_ATTEMPT: 'fulfillment.retry',
  STALE_LOCK_RECOVERED: 'fulfillment.stale_lock_recovered',
};

export const logFulfillmentEvent = (orderRef, event, meta = {}) => {
  const payload = {
    ts: new Date().toISOString(),
    scope: 'fulfillment',
    orderRef: orderRef || null,
    event,
    ...meta,
  };
  if (payload.phone) payload.phone = maskPhone(payload.phone);
  console.log(JSON.stringify(payload));
};

export const appendFulfillmentEvent = (order, event, details = {}) => {
  if (!order) return;
  order.metadata = order.metadata || {};
  const events = Array.isArray(order.metadata.fulfillmentEvents)
    ? order.metadata.fulfillmentEvents
    : [];
  events.push({
    at: new Date().toISOString(),
    event,
    ...details,
  });
  if (events.length > 40) {
    order.metadata.fulfillmentEvents = events.slice(-40);
  } else {
    order.metadata.fulfillmentEvents = events;
  }
  order.markModified?.('metadata');
};
