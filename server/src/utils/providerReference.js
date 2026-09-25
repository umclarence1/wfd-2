/** Storefront checkout ids: ORD-YYYYMMDD-code. TopDeals ids are a different shape. */
const isOurCheckoutReference = (ref) => /^ORD-\d{8}-[A-Z0-9]{6,}$/i.test(ref);

/** TopDeals returns ids like ORD-1790319766850-8776 after a purchase is accepted. */
export const isTopDealsOrderId = (providerReference) => {
  const ref = String(providerReference || '').trim();
  return /^ORD-\d{10,}-\d+$/.test(ref) || /^ORD\d{8}[A-Z0-9]+$/i.test(ref);
};

/** True when the value is a provider-side order id, not our local ORD/PAY reference. */
export const isRealProviderReference = (providerReference, localReference) => {
  const ref = String(providerReference || '').trim();
  if (!ref) return false;
  const local = String(localReference || '').trim();
  if (local && ref === local) return false;
  if (/^PAY-/i.test(ref)) return false;
  if (isOurCheckoutReference(ref)) return false;
  return true;
};
