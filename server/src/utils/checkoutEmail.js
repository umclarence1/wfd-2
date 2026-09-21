const CHECKOUT_EMAIL_DOMAIN = 'checkout.wilberforcedataservice.com';

export const generateCheckoutEmail = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(digits)) {
    throw new Error('Phone must be 10 digits to generate checkout email.');
  }
  return `wds+${digits}@${CHECKOUT_EMAIL_DOMAIN}`;
};

export const isCheckoutEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith(`@${CHECKOUT_EMAIL_DOMAIN}`);
};
