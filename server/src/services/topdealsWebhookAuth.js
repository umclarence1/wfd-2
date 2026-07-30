import crypto from 'crypto';
import { env } from '../config/env.js';
import { getProviderCredentials } from './apiProviderService.js';
import { PROVIDER_IDS } from '../config/apiProviders.js';
import SiteSettings from '../models/SiteSettings.js';
import { decrypt } from '../utils/encryption.js';

/** Collect every TopDealsGH secret we might need to verify (env + stored). */
export const getTopDealsWebhookSecrets = async () => {
  const secrets = new Set();

  if (env.topdealsgh.secretKey) {
    secrets.add(String(env.topdealsgh.secretKey).trim());
  }

  try {
    const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
    if (creds.apiSecret) secrets.add(String(creds.apiSecret).trim());
  } catch {
    // ignore
  }

  // Also try decrypted Mongo secret directly in case env override hid a rotated key TopDeals still uses briefly.
  try {
    const settings = await SiteSettings.findOne()
      .select('apiProviderSettings.credentials.topdealsgh')
      .lean();
    const encrypted =
      settings?.apiProviderSettings?.credentials?.topdealsgh?.apiSecretEncrypted;
    if (encrypted) {
      const stored = decrypt(encrypted);
      if (stored) secrets.add(String(stored).trim());
    }
  } catch {
    // ignore
  }

  return [...secrets].filter(Boolean);
};

export const getTopDealsWebhookSecret = async () => {
  const secrets = await getTopDealsWebhookSecrets();
  return secrets[0] || '';
};

const hmacHex = (secret, payload) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

const signaturesMatch = (providedHex, expectedHex) => {
  try {
    const a = Buffer.from(providedHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

/**
 * Verify X-TopDeals-Signature = HMAC-SHA256(raw body, secret).
 * Accepts hex digests, optionally prefixed with sha256=.
 * Tries all known secrets so rotated keys still verify.
 */
export const verifyTopDealsWebhookSignature = (req, secrets) => {
  const list = Array.isArray(secrets) ? secrets : [secrets];
  const usable = list.map((s) => String(s || '').trim()).filter(Boolean);
  if (!usable.length) return false;

  const header = String(
    req.headers['x-topdeals-signature'] ||
      req.headers['x-topdealsgh-signature'] ||
      req.headers['x-signature'] ||
      ''
  ).trim();
  if (!header) return false;

  const provided = header.replace(/^sha256=/i, '').trim().toLowerCase();
  const payload = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

  return usable.some((secret) => signaturesMatch(provided, hmacHex(secret, payload)));
};

export const mapTopDealsWebhookStatus = (payload) => {
  const event = String(payload?.event || '').toLowerCase();
  const status = String(
    payload?.status || payload?.providerStatus || payload?.deliveryStatus || ''
  ).toLowerCase();

  const fromEvent = event.replace(/^order\./, '');
  const candidate = status || fromEvent;

  if (['delivered', 'completed', 'success'].includes(candidate)) return 'delivered';
  if (['failed'].includes(candidate)) return 'failed';
  if (['verification', 'verifying', 'verify', 'number_verification'].includes(candidate)) {
    return 'verification';
  }
  if (['processing', 'pending', 'queued', 'submitting'].includes(candidate)) return 'processing';
  if (['cancelled', 'canceled'].includes(candidate)) return 'cancelled';
  if (['refunded'].includes(candidate)) return 'refunded';
  return null;
};

/** Flatten nested TopDeals webhook shapes into one lookup object. */
export const normalizeTopDealsWebhookPayload = (body = {}) => {
  const nested = body?.data && typeof body.data === 'object' ? body.data : {};
  const order = body?.order && typeof body.order === 'object' ? body.order : {};

  return {
    ...nested,
    ...order,
    ...body,
    event: body.event || nested.event || order.event,
    orderId:
      body.orderId ||
      nested.orderId ||
      order.orderId ||
      body.id ||
      nested.id ||
      order.id ||
      body.reference ||
      nested.reference,
    status: body.status || nested.status || order.status,
    providerStatus: body.providerStatus || nested.providerStatus || order.providerStatus,
    recipientPhone:
      body.recipientPhone ||
      nested.recipientPhone ||
      order.recipientPhone ||
      body.phone ||
      nested.phone,
    network: body.network || nested.network || order.network || body.category,
    message: body.message || nested.message || order.message,
  };
};
