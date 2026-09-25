import { normalizePhone } from './validation.js';

/** Normalized 10-digit Ghana numbers blocked from new checkout. */
const BLOCKED_CHECKOUT_PHONES = new Set(['0543916222', '0557635301']);

export const isCheckoutPhoneBlocked = (phone) => {
  const normalized = normalizePhone(phone);
  return BLOCKED_CHECKOUT_PHONES.has(normalized);
};

export const checkoutPhoneBlockedMessage =
  'Orders are not available for this phone number. Please contact support if you need help.';
