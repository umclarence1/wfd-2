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
  'MTN EXPRESS': 'MTN Express',
  'MTN Express': 'MTN Express',
  mtn_express: 'MTN Express',
  mtnexpress: 'MTN Express',
  mtnxp: 'MTN Express',
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

export const mapTopDealsNetwork = (category) => {
  const key = String(category || '').trim();
  if (!key) return key;
  if (NETWORK_MAP[key]) return NETWORK_MAP[key];
  const upper = key.toUpperCase();
  if (upper === 'MTN EXPRESS' || upper === 'MTNEXPRESS' || upper === 'MTNXP') {
    return 'MTN Express';
  }
  if (upper === 'MTN') return 'MTN';
  return NETWORK_MAP[upper] || key;
};

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

const PACKAGE_CACHE_MS = 5 * 60 * 1000;
const packageListCache = { at: 0, byNetwork: new Map() };

export const listTopDealsGhPackages = async (creds, network) => {
  const cacheKey = network ? mapTopDealsNetwork(network) : '__all__';
  const now = Date.now();
  const cached = packageListCache.byNetwork.get(cacheKey);
  if (cached && now - packageListCache.at < PACKAGE_CACHE_MS) {
    return cached;
  }

  const response = await request(creds, {
    method: 'GET',
    path: '/packages',
    params: network ? { network: mapTopDealsNetwork(network) } : undefined,
    timeout: 15000,
  });
  if (response.data?.success !== true) {
    throw new Error(response.data?.message || 'Could not list TopDealsGH packages.');
  }
  const packages = Array.isArray(response.data?.data) ? response.data.data : [];
  packageListCache.byNetwork.set(cacheKey, packages);
  packageListCache.at = now;
  return packages;
};

const stripNetworkNoise = (value) =>
  String(value || '')
    .replace(/MTN\s*(EXPRESS|XPRESS|XP)?/gi, '')
    .replace(/TELECEL|AIRTELTIGO|AIRTEL\s*TIGO|BIG\s*TIME|AT\b/gi, '')
    .trim();

const packageMatchScore = (remote, localPkg) => {
  const remoteRaw = remote.bundleSize || remote.name || remote.size || remote.dataAmount;
  const remoteLabel = normalizeBundleLabel(remoteRaw);
  const localVolume = parseBundleVolume(localPkg.dataAmount || localPkg.name);
  const remoteVolume = parseBundleVolume(remoteRaw);

  if (localVolume && remoteVolume && localVolume === remoteVolume) return 100;

  const localLabels = [
    normalizeBundleLabel(localPkg.dataAmount),
    normalizeBundleLabel(localPkg.name),
    normalizeBundleLabel(stripNetworkNoise(localPkg.name)),
    normalizeBundleLabel(`${localVolume}GB`),
  ].filter(Boolean);

  if (remoteLabel && localLabels.includes(remoteLabel)) return 100;

  if (
    remoteLabel
    && localLabels.some((l) => l && (l.includes(remoteLabel) || remoteLabel.includes(l)))
  ) {
    return 80;
  }

  return 0;
};

const networksForPackage = (category) => {
  const primary = mapTopDealsNetwork(category);
  const upper = String(category || '').trim().toUpperCase();
  const list = [primary];
  if (upper === 'MTN EXPRESS' || upper === 'MTNEXPRESS' || upper === 'MTNXP') {
    list.push('MTN Express', 'MTN');
  }
  if (upper === 'MTN') list.push('MTN');
  return [...new Set(list.filter(Boolean))];
};

const findBestTopDealsPackage = async (creds, pkg) => {
  let best = null;
  let bestScore = 0;

  for (const network of networksForPackage(pkg.category)) {
    const packages = await listTopDealsGhPackages(creds, network);
    for (const remote of packages) {
      const score = packageMatchScore(remote, pkg);
      if (score > bestScore) {
        bestScore = score;
        best = remote;
      }
    }
  }

  return { best, bestScore };
};

export const resolveTopDealsGhPackageId = async (creds, pkg) => {
  if (pkg.providerPackageId) return String(pkg.providerPackageId);

  const { best, bestScore } = await findBestTopDealsPackage(creds, pkg);
  if (!best || bestScore < 80) {
    throw new Error(
      `No TopDealsGH package match for ${pkg.category} ${pkg.dataAmount || pkg.name}. Check bundle sizes in Admin → Packages.`
    );
  }
  return String(best._id);
};

const isDuplicatePurchaseMessage = (message) =>
  /already\s+(exist|submitted|processed|in progress)|duplicate|order\s+exists|reference\s+(already|exists)|wait until it completes/i.test(
    String(message || '')
  );

export const getTopDealsGhOrderStatus = async (creds, orderId) => {
  const response = await request(creds, {
    method: 'GET',
    path: `/orders/${encodeURIComponent(orderId)}`,
    timeout: 15000,
  });
  return response.data;
};

export const submitTopDealsGhDataBundle = async (creds, order, pkg) => {
  let packageId;
  try {
    packageId = await resolveTopDealsGhPackageId(creds, pkg);
  } catch (err) {
    return {
      success: false,
      reference: order.reference,
      message: err.message || 'Could not match package on TopDealsGH.',
      queueReason: 'package_unmatched',
      providerId: 'topdealsgh',
    };
  }

  const payload = {
    packageId,
    recipientPhone: formatGhanaLocalPhone(order.phone),
    reference: order.reference,
  };

  try {
    const response = await request(creds, {
      method: 'POST',
      path: '/purchase',
      data: payload,
      timeout: 45000,
    });

    const message = response.data?.message || '';
    if (isInsufficientBalanceMessage(message) || /insufficient/i.test(message)) {
      return asQueuedProviderResponse(
        { reference: order.reference, message, raw: response.data },
        QUEUE_REASONS.INSUFFICIENT_BALANCE
      );
    }

    if (response.status >= 400 || response.data?.success === false) {
      if (isDuplicatePurchaseMessage(message)) {
        const data = response.data?.data || {};
        return {
          success: true,
          reference: data.orderId || order.reference,
          orderId: data.orderId,
          message: message || 'Order already submitted to TopDealsGH.',
          raw: response.data,
          alreadySubmitted: true,
          providerId: 'topdealsgh',
        };
      }
      return {
        success: false,
        reference: order.reference,
        message: message || 'TopDealsGH purchase failed.',
        raw: response.data,
        providerId: 'topdealsgh',
      };
    }

    const data = response.data?.data || {};
    return {
      success: true,
      reference: data.orderId || order.reference,
      orderId: data.orderId,
      message: message || 'Order submitted.',
      raw: response.data,
      providerId: 'topdealsgh',
      topdealsPackageId: packageId,
    };
  } catch (err) {
    const message = extractErrorMessage(err, 'TopDealsGH purchase failed.');
    if (isInsufficientBalanceMessage(message) || /insufficient/i.test(message)) {
      return asQueuedProviderResponse(
        { reference: order.reference, message, raw: err.response?.data },
        QUEUE_REASONS.INSUFFICIENT_BALANCE
      );
    }
    if (isDuplicatePurchaseMessage(message)) {
      return {
        success: true,
        reference: order.reference,
        message,
        alreadySubmitted: true,
        providerId: 'topdealsgh',
        raw: err.response?.data,
      };
    }
    return {
      success: false,
      reference: order.reference,
      message,
      providerId: 'topdealsgh',
      raw: err.response?.data,
    };
  }
};

export const submitTopDealsGhAFA = async (creds, order) => {
  const payload = {
    phone: formatGhanaLocalPhone(order.phone),
    ...(order.email ? { email: String(order.email).trim() } : {}),
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
  const offer = (data.offers || []).find((o) => {
    const offerType = String(o.type || '').toLowerCase();
    if (type === 'wassce') return offerType === 'wassce' || offerType === 'waec';
    return offerType === type;
  });
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
