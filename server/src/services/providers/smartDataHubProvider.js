import axios from 'axios';
import { formatDatamaxCustomerNumber, parseDatamaxVolume } from './datamaxProvider.js';
import {
  API_V1_PREFIX,
  buildSmartDataHubHeaders,
  resolveSigningEndpoint,
} from './smartDataHubAuth.js';
import {
  asQueuedProviderResponse,
  QUEUE_REASONS,
} from '../../utils/providerQueue.js';

const SMART_DATA_HUB_NETWORK_CODES = {
  MTN: 'mtn',
  Telecel: 'telecel',
  AirtelTigo: 'at',
  'AirtelTigo Big Time': 'at',
};

const buildRequestUrl = (apiUrl, path) => {
  const base = String(apiUrl || '').replace(/\/+$/, '');
  const segment = path.replace(/^\/+/, '');
  if (base.endsWith(API_V1_PREFIX)) {
    return `${base}/${segment.replace(/^api\/v1\//, '')}`;
  }
  return `${base}${resolveSigningEndpoint(`/${segment}`)}`;
};

const smartDataHubRequest = async (
  creds,
  { method, path, body, idempotencyKey, validateStatus }
) => {
  const endpoint = resolveSigningEndpoint(path.startsWith('/') ? path : `/${path}`);
  const bodyStr = method === 'GET' ? '' : JSON.stringify(body ?? {});
  const headers = buildSmartDataHubHeaders({
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
    method,
    endpoint,
    body: bodyStr,
  });

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await axios({
    method,
    url: buildRequestUrl(creds.apiUrl, path.replace(/^\//, '')),
    headers,
    data: method === 'GET' ? undefined : body,
    timeout: 30000,
    validateStatus: validateStatus || ((status) => status < 500),
  });

  return response;
};

export const mapSmartDataHubNetwork = (category) =>
  SMART_DATA_HUB_NETWORK_CODES[category] || category.toLowerCase();

export const parseSmartDataHubDataSize = (dataAmount) => {
  const volume = parseDatamaxVolume(dataAmount);
  const numeric = Number(volume);
  return Number.isFinite(numeric) ? numeric : 1;
};

const extractErrorMessage = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;

export const testSmartDataHubConnection = async ({ apiUrl, apiKey, apiSecret }) => {
  if (!apiKey || !apiSecret) {
    return {
      success: false,
      message: 'Smart Data Hub API key and API secret are both required.',
    };
  }

  try {
    const response = await smartDataHubRequest(
      { apiUrl, apiKey, apiSecret },
      { method: 'GET', path: '/test' }
    );

    if (response.data?.success === true) {
      return {
        success: true,
        message: response.data?.data?.message || 'Smart Data Hub connection successful.',
        data: response.data,
      };
    }

    return {
      success: false,
      message: response.data?.message || 'Smart Data Hub returned an unexpected response.',
      data: response.data,
    };
  } catch (err) {
    return {
      success: false,
      message: extractErrorMessage(err, 'Could not connect to Smart Data Hub.'),
    };
  }
};

export const getSmartDataHubBalance = async ({ apiUrl, apiKey, apiSecret }) => {
  const response = await smartDataHubRequest(
    { apiUrl, apiKey, apiSecret },
    { method: 'GET', path: '/wallet/balance' }
  );

  if (response.data?.success !== true) {
    throw new Error(response.data?.message || 'Could not fetch Smart Data Hub balance.');
  }

  return {
    success: true,
    balance: response.data?.data?.balance,
    currency: response.data?.data?.currency || 'GHS',
    raw: response.data,
  };
};

export const getSmartDataHubDeliveryStatus = async ({ apiUrl, apiKey, apiSecret }, orderReference) => {
  const response = await smartDataHubRequest(
    { apiUrl, apiKey, apiSecret },
    { method: 'GET', path: `/orders/${encodeURIComponent(orderReference)}/delivery-status` }
  );

  return response.data;
};

const normalizeCreateResponse = (data, fallbackRef) => ({
  success: data?.success === true,
  reference:
    data?.data?.order_number ||
    data?.data?.batch_id ||
    fallbackRef,
  batchId: data?.data?.batch_id,
  orderNumber: data?.data?.order_number,
  message: data?.data?.message || data?.message || '',
  raw: data,
});

export const submitSmartDataHubDataBundle = async ({ apiUrl, apiKey, apiSecret }, order, pkg) => {
  const body = {
    order_number: order.reference,
    orders: [
      {
        _beneficiary_number: formatDatamaxCustomerNumber(order.phone),
        network: mapSmartDataHubNetwork(pkg.category),
        _data_size: parseSmartDataHubDataSize(pkg.dataAmount || pkg.name),
      },
    ],
  };

  const response = await smartDataHubRequest(
    { apiUrl, apiKey, apiSecret },
    {
      method: 'POST',
      path: '/orders/create',
      body,
      idempotencyKey: order.reference,
      validateStatus: (status) => status < 500,
    }
  );

  if (response.status === 402) {
    return asQueuedProviderResponse(
      {
        reference: order.reference,
        message: response.data?.message || 'Insufficient Smart Data Hub wallet balance.',
        errorCode: response.data?.error_code || 'INSUFFICIENT_BALANCE',
        status: 402,
        raw: response.data,
      },
      QUEUE_REASONS.INSUFFICIENT_BALANCE
    );
  }

  if (response.status === 422) {
    return {
      success: false,
      reference: order.reference,
      message: response.data?.message || 'Smart Data Hub rejected the order.',
      raw: response.data,
    };
  }

  if (response.status >= 400 || response.data?.success === false) {
    return {
      success: false,
      reference: order.reference,
      message: response.data?.message || 'Smart Data Hub order failed.',
      raw: response.data,
    };
  }

  return normalizeCreateResponse(response.data, order.reference);
};

export const submitSmartDataHubAFA = async (_creds, order) => ({
  success: false,
  reference: order.reference,
  message:
    'Smart Data Hub API does not support AFA registration. Route MTN AFA through Datamax in API Providers.',
});
