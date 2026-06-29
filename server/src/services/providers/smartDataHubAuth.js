import crypto from 'crypto';

export const API_V1_PREFIX = '/api/v1';

export const resolveSigningEndpoint = (path) => {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean.startsWith(API_V1_PREFIX)) return clean;
  return `${API_V1_PREFIX}${clean}`;
};

export const createSmartDataHubSignature = ({ apiSecret, timestamp, method, endpoint, body = '' }) => {
  const signatureString = `${timestamp}${method.toUpperCase()}${endpoint}${body}`;
  return crypto.createHmac('sha256', apiSecret).update(signatureString).digest('hex');
};

export const buildSmartDataHubHeaders = ({ apiKey, apiSecret, method, endpoint, body = '' }) => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body === '' ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const signature = createSmartDataHubSignature({
    apiSecret,
    timestamp,
    method,
    endpoint,
    body: bodyStr,
  });

  return {
    'X-API-KEY': apiKey,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'Content-Type': 'application/json',
  };
};
