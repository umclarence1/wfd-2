/** True when the value is a provider-side order id, not our local ORD/PAY reference. */
export const isRealProviderReference = (providerReference, localReference) => {
  const ref = String(providerReference || '').trim();
  if (!ref) return false;
  const local = String(localReference || '').trim();
  if (local && ref === local) return false;
  if (/^ORD-/i.test(ref)) return false;
  if (/^PAY-/i.test(ref)) return false;
  return true;
};
