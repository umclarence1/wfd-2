import axios from 'axios';
import { env } from '../../config/env.js';
import { normalizePhone } from '../../utils/validation.js';
import {
  asQueuedProviderResponse,
  isInsufficientBalanceMessage,
  QUEUE_REASONS,
} from '../../utils/providerQueue.js';

const DATAMAX_NETWORK_CODES = {
  MTN: 'mtn',
  Telecel: 'telecel',
  AirtelTigo: 'airteltigo',
  'AirtelTigo Big Time': 'bigtime',
};

const buildApiUrl = (apiUrl, path) => {
  const base = String(apiUrl || env.datamax.apiUrl).replace(/\/+$/, '');
  const segment = String(path).replace(/^\/+/, '');
  return `${base}/${segment}`;
};

const buildHeaders = (apiKey) => ({
  'X-API-KEY': apiKey,
  'Content-Type': 'application/json',
});

export const mapDatamaxNetwork = (category) => DATAMAX_NETWORK_CODES[category] || category.toLowerCase();

export const parseDatamaxVolume = (dataAmount) => {
  const raw = String(dataAmount || '').trim().toUpperCase();
  const gbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*GB$/);
  if (gbMatch) return gbMatch[1];

  const mbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*MB$/);
  if (mbMatch) {
    const gb = Number(mbMatch[1]) / 1024;
    return String(Number.isInteger(gb) ? gb : gb.toFixed(2));
  }

  const numeric = raw.match(/(\d+(?:\.\d+)?)/);
  return numeric ? numeric[1] : '1';
};

export const formatDatamaxCustomerNumber = (phone) => {
  let digits = normalizePhone(phone);
  if (digits.startsWith('233') && digits.length === 12) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.length === 9) {
    digits = `0${digits}`;
  }
  return digits;
};

const normalizePlaceOrderResponse = (data, requestId) => ({
  success: data?.success === true,
  reference: data?.order_id != null ? String(data.order_id) : requestId,
  orderId: data?.order_id,
  message: data?.message || '',
  total: data?.total,
  raw: data,
});

const normalizeAfaResponse = (data, requestId) => ({
  success: data?.success !== false && data?.status !== 'error',
  reference: data?.reference || data?.order_id || requestId,
  message: data?.message || data?.data?.message || 'AFA registration submitted.',
  raw: data,
});

export const testDatamaxConnection = async ({ apiUrl, apiKey }) => {
  try {
    const response = await axios.get(buildApiUrl(apiUrl, '/check_balance'), {
      headers: buildHeaders(apiKey),
      timeout: 15000,
    });

    if (response.data?.success === true) {
      return {
        success: true,
        message: `Datamax connected. Wallet: GHS ${response.data.wallet_balance ?? '—'}`,
        data: response.data,
      };
    }

    return {
      success: false,
      message: response.data?.message || 'Datamax returned an unexpected response.',
      data: response.data,
    };
  } catch (err) {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Could not connect to Datamax. Check URL and API key.';
    return { success: false, message };
  }
};

export const getDatamaxBalance = async ({ apiUrl, apiKey }) => {
  const response = await axios.get(buildApiUrl(apiUrl, '/check_balance'), {
    headers: buildHeaders(apiKey),
    timeout: 15000,
  });

  if (response.data?.success !== true) {
    throw new Error(response.data?.message || 'Could not fetch Datamax balance.');
  }

  return {
    success: true,
    balance: response.data.wallet_balance,
    currency: 'GHS',
    raw: response.data,
  };
};

export const getDatamaxOrderStatus = async ({ apiUrl, apiKey }, orderId) => {
  const response = await axios.get(buildApiUrl(apiUrl, '/order_status'), {
    headers: buildHeaders(apiKey),
    params: { order_id: orderId },
    timeout: 15000,
  });

  return response.data;
};

export const submitDatamaxDataBundle = async ({ apiUrl, apiKey }, order, pkg) => {
  const payload = {
    request_id: order.reference,
    network: mapDatamaxNetwork(pkg.category),
    volume: parseDatamaxVolume(pkg.dataAmount || pkg.name),
    customer_number: formatDatamaxCustomerNumber(order.phone),
    quantity: 1,
  };

  try {
    const response = await axios.post(buildApiUrl(apiUrl, '/place_order'), payload, {
      headers: buildHeaders(apiKey),
      timeout: 30000,
      validateStatus: (status) => status < 500,
    });

    const message = response.data?.message || '';

    if (isInsufficientBalanceMessage(message)) {
      return asQueuedProviderResponse(
        {
          reference: order.reference,
          message,
          raw: response.data,
        },
        QUEUE_REASONS.INSUFFICIENT_BALANCE
      );
    }

    if (response.status >= 400 || response.data?.success === false) {
      return {
        success: false,
        reference: order.reference,
        message: message || 'Datamax order failed.',
        raw: response.data,
      };
    }

    return normalizePlaceOrderResponse(response.data, order.reference);
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    if (isInsufficientBalanceMessage(message)) {
      return asQueuedProviderResponse(
        { reference: order.reference, message, raw: err.response?.data },
        QUEUE_REASONS.INSUFFICIENT_BALANCE
      );
    }
    throw err;
  }
};

export const submitDatamaxAFA = async ({ apiUrl, apiKey }, order, pkg) => {
  const afaBaseUrl = env.datamax.afaApiUrl.replace(/\/+$/, '');
  const payload = {
    api_key: apiKey,
    full_name: order.afaDetails?.fullName,
    phone: formatDatamaxCustomerNumber(order.phone),
    ghana_card: order.afaDetails?.ghanaCard,
    location: order.afaDetails?.location,
    occupation: order.afaDetails?.occupation || 'Farmer',
  };

  const response = await axios.post(`${afaBaseUrl}/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status === 401) {
    return {
      success: false,
      reference: order.reference,
      message: response.data?.message || 'Invalid Datamax AFA API key.',
      raw: response.data,
    };
  }

  if (response.status === 402) {
    return asQueuedProviderResponse(
      {
        reference: order.reference,
        message: response.data?.message || 'Insufficient Datamax wallet balance for AFA registration.',
        status: 402,
        raw: response.data,
      },
      QUEUE_REASONS.INSUFFICIENT_BALANCE
    );
  }

  if (response.status >= 400) {
    return {
      success: false,
      reference: order.reference,
      message: response.data?.message || 'Datamax AFA registration failed.',
      raw: response.data,
    };
  }

  return normalizeAfaResponse(response.data, order.reference);
};
