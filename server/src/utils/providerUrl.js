import { PROVIDER_IDS } from '../config/apiProviders.js';

const ALLOWED_HOSTS = {
  [PROVIDER_IDS.TOPDEALSGH]: new Set(['www.topdealsgh.com', 'topdealsgh.com']),
  [PROVIDER_IDS.SMART_DATA_HUB]: new Set(['smartdatahubgh.com', 'www.smartdatahubgh.com']),
};

const DEFAULT_URLS = {
  [PROVIDER_IDS.TOPDEALSGH]: 'https://www.topdealsgh.com/api/v1/agent',
  [PROVIDER_IDS.SMART_DATA_HUB]: 'https://smartdatahubgh.com/api/v1',
};

/**
 * Only allow HTTPS URLs to known provider hosts (blocks SSRF via admin apiUrl).
 * Returns the sanitized URL or the provider default when invalid.
 */
export const sanitizeProviderApiUrl = (providerId, apiUrl) => {
  const fallback = DEFAULT_URLS[providerId] || '';
  const raw = String(apiUrl || '').trim();
  if (!raw) return fallback;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return fallback;
  }

  if (parsed.protocol !== 'https:') return fallback;

  const host = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS[providerId];
  if (!allowed || !allowed.has(host)) return fallback;

  // Block obvious internal / metadata hosts even if somehow allowlisted later.
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal' ||
    /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(host)
  ) {
    return fallback;
  }

  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
};

export const isSafeHttpUrl = (value) => {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};
