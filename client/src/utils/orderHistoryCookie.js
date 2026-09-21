const COOKIE_NAME = 'wds_order_history';
const MAX_ENTRIES = 100;
const MAX_AGE_SEC = 365 * 24 * 60 * 60;

const readRawCookie = () => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

export const getOrderHistoryFromCookie = () => {
  const raw = readRawCookie();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getPaymentReferencesFromCookie = () => {
  const entries = getOrderHistoryFromCookie();
  return entries
    .map((e) => e.paymentReference)
    .filter((ref) => typeof ref === 'string' && ref.trim());
};

export const appendOrderToHistoryCookie = (order) => {
  if (typeof document === 'undefined' || !order) return;

  const paymentReference = order.paymentReference || null;
  if (!paymentReference) return;

  const entry = {
    paymentReference,
    reference: order.reference || null,
    phone: order.phone || null,
    category: order.category || null,
    packageName: order.packageName || null,
    dataAmount: order.dataAmount || null,
    createdAt: order.createdAt || new Date().toISOString(),
  };

  const existing = getOrderHistoryFromCookie().filter(
    (e) => e.paymentReference !== paymentReference
  );
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);

  const encoded = encodeURIComponent(JSON.stringify(next));
  document.cookie = `${COOKIE_NAME}=${encoded}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax`;
};
