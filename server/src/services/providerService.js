import {
  resolveProviderForCategory,
  isApiForwardingEnabled,
  isNetworkForwardingEnabled,
  submitViaProvider,
  getProviderCredentials,
} from './apiProviderService.js';
import { PROVIDER_IDS } from '../config/apiProviders.js';
import { QUEUE_REASONS } from '../utils/providerQueue.js';
import { getDatamaxOrderStatus } from './providers/datamaxProvider.js';
import { getSmartDataHubDeliveryStatus } from './providers/smartDataHubProvider.js';

const queueForwardingOff = (order, message) => ({
  success: true,
  queued: true,
  queueReason: QUEUE_REASONS.FORWARDING_OFF,
  reference: order.reference,
  message,
});

const queueNetworkOff = (order, category) => ({
  success: true,
  queued: true,
  queueReason: QUEUE_REASONS.NETWORK_OFF,
  reference: order.reference,
  message: `API forwarding is off for ${category}. Order queued for retry.`,
});

export const submitDataBundleOrder = async (order, pkg) => {
  const forwarding = await isApiForwardingEnabled();
  if (!forwarding) {
    return queueForwardingOff(order, 'API forwarding is off. Order queued for retry.');
  }

  const networkEnabled = await isNetworkForwardingEnabled(pkg.category);
  if (!networkEnabled) {
    return queueNetworkOff(order, pkg.category);
  }

  const providerId = await resolveProviderForCategory(pkg.category);
  return submitViaProvider(providerId, order, pkg);
};

export const submitAFARegistration = async (order, pkg) => {
  const forwarding = await isApiForwardingEnabled();
  if (!forwarding) {
    return queueForwardingOff(order, 'API forwarding is off. Order queued for retry.');
  }

  const networkEnabled = await isNetworkForwardingEnabled(pkg.category);
  if (!networkEnabled) {
    return queueNetworkOff(order, pkg.category);
  }

  const providerId = await resolveProviderForCategory(pkg.category);
  return submitViaProvider(providerId, order, pkg);
};

export const checkProviderStatus = async (providerReference, category, providerId) => {
  const resolvedProvider = providerId || (category ? await resolveProviderForCategory(category) : null);

  if (resolvedProvider === PROVIDER_IDS.DATAMAX && providerReference) {
    const creds = await getProviderCredentials(PROVIDER_IDS.DATAMAX);
    if (!creds.apiKey) return { status: 'unknown' };

    try {
      const result = await getDatamaxOrderStatus(creds, providerReference);
      if (result?.success !== true) return { status: 'unknown', raw: result };

      const status = String(result.status || '').toLowerCase();
      if (['completed', 'delivered', 'success'].includes(status)) return { status: 'delivered', raw: result };
      if (['failed', 'cancelled', 'canceled'].includes(status)) return { status: 'failed', raw: result };
      return { status: 'processing', raw: result };
    } catch {
      return { status: 'unknown' };
    }
  }

  if (resolvedProvider === PROVIDER_IDS.SMART_DATA_HUB && providerReference) {
    const creds = await getProviderCredentials(PROVIDER_IDS.SMART_DATA_HUB);
    if (!creds.apiKey || !creds.apiSecret) return { status: 'unknown' };

    try {
      const result = await getSmartDataHubDeliveryStatus(creds, providerReference);
      if (result?.success !== true) return { status: 'unknown', raw: result };

      const status = String(result.data?.status || '').toLowerCase();
      if (status === 'completed') return { status: 'delivered', raw: result };
      if (['failed', 'cancelled', 'canceled'].includes(status)) return { status: 'failed', raw: result };
      return { status: 'processing', raw: result };
    } catch {
      return { status: 'unknown' };
    }
  }

  return { status: 'delivered' };
};
