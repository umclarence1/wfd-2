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

export const normalizePhone = (phone) => {
  return String(phone || '').replace(/\s/g, '').replace(/\D/g, '');
};

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
  const pattern = /^GHA-\d{9}-\d$/;
  if (!pattern.test(cardNumber)) {
    return { valid: false, error: 'Ghana Card must be in format GHA-#########-#' };
  }
  return { valid: true };
};

export const validateEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return { valid: false, error: 'Email address is required.' };
  }
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!pattern.test(normalized)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  return { valid: true, normalized };
};

export { NETWORK_PREFIXES, NETWORK_ERROR_MESSAGES, CATEGORY_NETWORK_MAP };
