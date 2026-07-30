import axios from 'axios';
import { env } from '../../config/env.js';
import {
  asQueuedProviderResponse,
  isInsufficientBalanceMessage,
  QUEUE_REASONS,
} from '../../utils/providerQueue.js';
import {
  formatGhanaLocalPhone,
  normalizeBundleLabel,
  parseBundleVolume,
} from './providerPhone.js';

const NETWORK_MAP = {
  MTN: 'MTN',
  Telecel: 'Telecel',
  AirtelTigo: 'AirtelTigo',
  'AirtelTigo Big Time': 'AirtelTigo',
};

const buildApiUrl = (apiUrl, path) => {
  const base = String(apiUrl || env.topdealsgh.apiUrl).replace(/\/+$/, '');
  const segment = String(path).replace(/^\/+/, '');
  return `${base}/${segment}`;
};

const buildHeaders = ({ apiKey, apiSecret }) => ({
  'Content-Type': 'application/json',
  'x-api-key': String(apiKey || '').trim(),
  'x-secret-key': String(apiSecret || '').trim(),
});

const extractErrorMessage = (err, fallback) =>
  err.response?.data?.message ||
  err.response?.data?.error ||
  err.message ||
  fallback;

const request = async (creds, { method, path, data, params, timeout = 30000 }) => {
  const response = await axios({
    method,
    url: buildApiUrl(creds.apiUrl, path),
    headers: buildHeaders(creds),
    data,
    params,
    timeout,
    validateStatus: (status) => status < 500,
  });
  return response;
};

export const mapTopDealsNetwork = (category) => NETWORK_MAP[category] || category;

export const testTopDealsGhConnection = async (creds) => {
  try {
    if (!creds.apiKey || !creds.apiSecret) {
      return { success: false, message: 'TopDealsGH API key and secret key are required.' };
    }

    const response = await request(creds, { method: 'GET', path: '/wallet', timeout: 15000 });
    if (response.status === 401) {
      return {
        success: false,
        message:
          response.data?.message ||
          'Invalid TopDealsGH credentials. Open TopDealsGH → Developer API, copy a fresh API key and secret, then paste them here and Save.',
      };
    }
    if (response.status === 403) {
      return {
        success: false,
        message: response.data?.message || 'TopDealsGH rejected this server IP (whitelist).',
      };
    }
    if (response.data?.success === true) {
      const balance = response.data?.data?.balance;
      return {
        success: true,
        message: `TopDealsGH connected. Wallet: GHS ${balance ?? '—'}`,
        data: response.data,
      };
    }
    return {
      success: false,
      message: response.data?.message || 'TopDealsGH returned an unexpected response.',
      data: response.data,
    };
  } catch (err) {
    return { success: false, message: extractErrorMessage(err, 'Could not connect to TopDealsGH.') };
  }
};

export const getTopDealsGhBalance = async (creds) => {
  const response = await request(creds, { method: 'GET', path: '/wallet', timeout: 15000 });
  if (response.data?.success !== true) {
    throw new Error(response.data?.message || 'Could not fetch TopDealsGH balance.');
  }
  return {
    success: true,
    balance: response.data?.data?.balance,
    currency: 'GHS',
    raw: response.data,
  };
};

export const listTopDealsGhPackages = async (creds, network) => {
  const response = await request(creds, {
    method: 'GET',
    path: '/packages',
    params: network ? { network: mapTopDealsNetwork(network) } : undefined,
    timeout: 20000,
  });
  if (response.data?.success !== true) {
    throw new Error(response.data?.message || 'Could not list TopDealsGH packages.');
  }
  return Array.isArray(response.data?.data) ? response.data.data : [];
};

const packageMatchScore = (remote, localPkg) => {
  const remoteLabel = normalizeBundleLabel(remote.bundleSize);
  const localLabels = [
    normalizeBundleLabel(localPkg.dataAmount),
    normalizeBundleLabel(localPkg.name),
    normalizeBundleLabel(`${parseBundleVolume(localPkg.dataAmount || localPkg.name)}GB`),
  ].filter(Boolean);

  if (localLabels.includes(remoteLabel)) return 100;
  // Partial: remote "1GB" contained in local name
  if (localLabels.some((l) => l && remoteLabel && (l.includes(remoteLabel) || remoteLabel.includes(l)))) {
    return 50;
  }
  return 0;
};

export const resolveTopDealsGhPackageId = async (creds, pkg) => {
  if (pkg.providerPackageId) return String(pkg.providerPackageId);

  const network = mapTopDealsNetwork(pkg.category);
  const packages = await listTopDealsGhPackages(creds, network);
  let best = null;
  let bestScore = 0;
  for (const remote of packages) {
    const score = packageMatchScore(remote, pkg);
    if (score > bestScore) {
      bestScore = score;
      best = remote;
    }
  }
  if (!best || bestScore < 50) {
    throw new Error(
      `No TopDealsGH package match for ${pkg.category} ${pkg.dataAmount || pkg.name}. Sync bundle sizes or set providerPackageId.`
    );
  }
  return String(best._id);
};

export const getTopDealsGhOrderStatus = async (creds, orderId) => {
  const response = await request(creds, {
    method: 'GET',
    path: `/orders/${encodeURIComponent(orderId)}`,
    timeout: 15000,
  });
  return response.data;
};

export const submitTopDealsGhDataBundle = async (creds, order, pkg) => {
  const packageId = await resolveTopDealsGhPackageId(creds, pkg);
  const payload = {
    packageId,
    recipientPhone: formatGhanaLocalPhone(order.phone),
  };

  try {
    const response = await request(creds, {
      method: 'POST',
      path: '/purchase',
      data: payload,
    });

    const message = response.data?.message || '';
    if (isInsufficientBalanceMessage(message) || /insufficient/i.test(message)) {
      return asQueuedProviderResponse(
        { reference: order.reference, message, raw: response.data },
        QUEUE_REASONS.INSUFFICIENT_BALANCE
      );
    }

    if (response.status >= 400 || response.data?.success === false) {
      return {
        success: false,
        reference: order.reference,
        message: message || 'TopDealsGH purchase failed.',
        raw: response.data,
      };
    }

    const data = response.data?.data || {};
    return {
      success: true,
      reference: data.orderId || order.reference,
      orderId: data.orderId,
      message: message || 'Order submitted.',
      raw: response.data,
    };
  } catch (err) {
    const message = extractErrorMessage(err, 'TopDealsGH purchase failed.');
    if (isInsufficientBalanceMessage(message) || /insufficient/i.test(message)) {
      return asQueuedProviderResponse(
        { reference: order.reference, message, raw: err.response?.data },
        QUEUE_REASONS.INSUFFICIENT_BALANCE
      );
    }
    throw err;
  }
};

export const submitTopDealsGhAFA = async (creds, order) => {
  const payload = {
    fullName: order.afaDetails?.fullName,
    phone: formatGhanaLocalPhone(order.phone),
    ghanaCard: order.afaDetails?.ghanaCard,
    location: order.afaDetails?.location,
    occupation: order.afaDetails?.occupation || 'Farmer',
  };

  try {
    const response = await request(creds, {
      method: 'POST',
      path: '/afa/register',
      data: payload,
    });

    const message = response.data?.message || response.data?.data?.message || '';
    if (isInsufficientBalanceMessage(message) || /insufficient/i.test(message)) {
      return asQueuedProviderResponse(
        { reference: order.reference, message, raw: response.data },
        QUEUE_REASONS.INSUFFICIENT_BALANCE
      );
    }

    if (response.status === 401) {
      return {
        success: false,
        reference: order.reference,
        message: message || 'Invalid TopDealsGH credentials.',
        raw: response.data,
      };
    }

    if (response.status >= 400 || response.data?.success === false) {
      return {
        success: false,
        reference: order.reference,
        message: message || 'TopDealsGH AFA registration failed.',
        raw: response.data,
      };
    }

    const data = response.data?.data || {};
    return {
      success: true,
      reference: data.orderId || order.reference,
      orderId: data.orderId,
      message: message || 'Registration submitted.',
      raw: response.data,
    };
  } catch (err) {
    const message = extractErrorMessage(err, 'TopDealsGH AFA registration failed.');
    if (isInsufficientBalanceMessage(message) || /insufficient/i.test(message)) {
      return asQueuedProviderResponse(
        { reference: order.reference, message, raw: err.response?.data },
        QUEUE_REASONS.INSUFFICIENT_BALANCE
      );
    }
    throw err;
  }
};

export const getTopDealsGhCheckerOffers = async (creds) => {
  const response = await request(creds, { method: 'GET', path: '/checker', timeout: 15000 });
  if (response.data?.success !== true) {
    throw new Error(response.data?.message || 'Could not fetch TopDealsGH checker offers.');
  }
  return response.data?.data || {};
};

export const checkTopDealsGhCheckerStock = async (creds, checkerType, quantity = 1) => {
  const data = await getTopDealsGhCheckerOffers(creds);
  const type = String(checkerType || '').toLowerCase();
  const offer = (data.offers || []).find((o) => String(o.type).toLowerCase() === type);
  if (!offer) return false;
  if (offer.inStock === false) return false;
  const available = Number(offer.availableCount);
  if (Number.isFinite(available)) return available >= quantity;
  return true;
};

export const submitTopDealsGhCheckerPurchase = async (creds, { type, email, phone }) => {
  const payload = {
    type: String(type || '').toLowerCase(),
    email,
    phone: formatGhanaLocalPhone(phone),
  };

  const response = await request(creds, {
    method: 'POST',
    path: '/checker/purchase',
    data: payload,
  });

  const message = response.data?.message || response.data?.data?.message || '';
  if (isInsufficientBalanceMessage(message) || /insufficient/i.test(message)) {
    return asQueuedProviderResponse(
      { message, raw: response.data },
      QUEUE_REASONS.INSUFFICIENT_BALANCE
    );
  }

  if (response.status >= 400 || response.data?.success === false) {
    return {
      success: false,
      message: message || 'TopDealsGH checker purchase failed.',
      raw: response.data,
    };
  }

  const data = response.data?.data || {};
  return {
    success: true,
    reference: data.orderId,
    orderId: data.orderId,
    serial: data.serial,
    pin: data.pin,
    type: data.type,
    status: data.status,
    message: message || 'Checker delivered.',
    raw: response.data,
  };
};
