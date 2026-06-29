const NETWORK_PREFIXES = {
  MTN: ['024', '025', '053', '054', '055', '059'],
  Telecel: ['020', '050'],
  AirtelTigo: ['026', '027', '056', '057'],
};

const NETWORK_ERROR_MESSAGES = {
  MTN: 'Please enter a valid MTN number.',
  Telecel: 'Please enter a valid Telecel number.',
  AirtelTigo: 'Please enter a valid AirtelTigo number.',
};

const CATEGORY_NETWORK_MAP = {
  MTN: 'MTN',
  'MTN AFA': 'MTN',
  Telecel: 'Telecel',
  'AirtelTigo Big Time': 'AirtelTigo',
  AirtelTigo: 'AirtelTigo',
};

export const normalizePhone = (phone) => String(phone || '').replace(/\s/g, '').replace(/\D/g, '');

export const detectNetwork = (phone) => {
  const normalized = normalizePhone(phone);
  if (normalized.length < 3) return null;
  const prefix = normalized.slice(0, 3);
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.includes(prefix)) return network;
  }
  return null;
};

export const validatePhone = (phone) => {
  const normalized = normalizePhone(phone);
  if (!/^\d{10}$/.test(normalized)) {
    return { valid: false, error: 'Phone number must contain exactly 10 digits.' };
  }
  return { valid: true, normalized };
};

export const getPhonePlaceholder = (category) => {
  const network = CATEGORY_NETWORK_MAP[category];
  if (network === 'AirtelTigo') return '0275399837';
  return '0595399837';
};

export const validateNetworkPhone = (phone, category) => {
  const phoneResult = validatePhone(phone);
  if (!phoneResult.valid) return phoneResult;

  const expectedNetwork = CATEGORY_NETWORK_MAP[category];
  if (!expectedNetwork) return phoneResult;

  const prefix = phoneResult.normalized.slice(0, 3);
  if (!NETWORK_PREFIXES[expectedNetwork].includes(prefix)) {
    return { valid: false, error: NETWORK_ERROR_MESSAGES[expectedNetwork] };
  }

  return { valid: true, normalized: phoneResult.normalized, network: expectedNetwork };
};

export const validateGhanaCard = (cardNumber) => {
  if (!/^GHA-\d{9}-\d$/.test(cardNumber)) {
    return { valid: false, error: 'Ghana Card must be in format GHA-#########-#' };
  }
  return { valid: true };
};

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const validateEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return { valid: false, error: 'Email address is required.' };
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  return { valid: true, normalized };
};

export const formatCurrency = (amount) => `GH₵${Number(amount || 0).toFixed(2)}`;

const PAYSTACK_CHARGE_RATE = 0.02;

export const calculatePaymentBreakdown = (packagePrice, promoDiscount = 0) => {
  const price = Number(packagePrice) || 0;
  const discount = Number(promoDiscount) || 0;
  const finalPrice = Math.max(0, price - discount);

  if (finalPrice === 0) {
    return {
      packagePrice: price,
      promoDiscount: discount,
      paystackCharge: 0,
      totalPayable: 0,
      isFreeOrder: true,
    };
  }

  const paystackCharge = Math.round(finalPrice * PAYSTACK_CHARGE_RATE * 100) / 100;
  return {
    packagePrice: price,
    promoDiscount: discount,
    discountedPrice: discount > 0 ? finalPrice : undefined,
    paystackCharge,
    totalPayable: Math.round((finalPrice + paystackCharge) * 100) / 100,
    isFreeOrder: false,
  };
};

export const formatDate = (date) =>
  new Date(date).toLocaleString('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export { NETWORK_PREFIXES, NETWORK_ERROR_MESSAGES, CATEGORY_NETWORK_MAP };
