import { env } from '../config/env.js';
import {
  DEFAULT_API_PROVIDER_SETTINGS,
  PROVIDER_DEFINITIONS,
  PROVIDER_IDS,
} from '../config/apiProviders.js';
import SiteSettings from '../models/SiteSettings.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/errorHandler.js';
import { markInsufficientBalanceIfNeeded } from '../utils/providerQueue.js';
import { getQueuedProviderOrders } from './orderQueueService.js';
import {
  testSmartDataHubConnection,
  getSmartDataHubBalance,
  submitSmartDataHubDataBundle,
  submitSmartDataHubAFA,
} from './providers/smartDataHubProvider.js';
import {
  testDatamaxConnection,
  getDatamaxBalance,
  getDatamaxOrderStatus,
  submitDatamaxDataBundle,
  submitDatamaxAFA,
} from './providers/datamaxProvider.js';

const mergeSettings = (stored) => {
  const defaults = DEFAULT_API_PROVIDER_SETTINGS();
  if (!stored) return defaults;
  return {
    ...defaults,
    ...stored,
    networkProviders: { ...defaults.networkProviders, ...(stored.networkProviders || {}) },
    credentials: {
      smart_data_hub: {
        ...defaults.credentials.smart_data_hub,
        ...(stored.credentials?.smart_data_hub || {}),
      },
      datamax: {
        ...defaults.credentials.datamax,
        ...(stored.credentials?.datamax || {}),
      },
    },
  };
};

export const getApiProviderSettings = async () => {
  const settings = await SiteSettings.findOne().lean();
  return mergeSettings(settings?.apiProviderSettings);
};

const getEnvCredentials = (providerId) => {
  if (providerId === PROVIDER_IDS.SMART_DATA_HUB) {
    return {
      apiUrl: env.smartDataHub.apiUrl,
      apiKey: env.smartDataHub.apiKey,
      apiSecret: env.smartDataHub.apiSecret,
    };
  }
  if (providerId === PROVIDER_IDS.DATAMAX) {
    return { apiUrl: env.datamax.apiUrl, apiKey: env.datamax.apiKey, apiSecret: '' };
  }
  return { apiUrl: '', apiKey: '', apiSecret: '' };
};

export const getProviderCredentials = async (providerId) => {
  const config = PROVIDER_DEFINITIONS[providerId];
  if (!config) return { apiUrl: '', apiKey: '', apiSecret: '' };

  const settings = await getApiProviderSettings();
  const stored = settings.credentials?.[providerId] || {};
  let apiUrl = stored.apiUrl || getEnvCredentials(providerId).apiUrl || config.defaultUrl;
  let apiKey = getEnvCredentials(providerId).apiKey;
  let apiSecret = getEnvCredentials(providerId).apiSecret || '';

  if (stored.apiKeyEncrypted) {
    try {
      apiKey = decrypt(stored.apiKeyEncrypted);
    } catch {
      apiKey = getEnvCredentials(providerId).apiKey;
    }
  }

  if (stored.apiSecretEncrypted) {
    try {
      apiSecret = decrypt(stored.apiSecretEncrypted);
    } catch {
      apiSecret = getEnvCredentials(providerId).apiSecret || '';
    }
  }

  return { apiUrl: apiUrl.replace(/\/$/, ''), apiKey, apiSecret };
};

export const resolveProviderForCategory = async (category) => {
  const settings = await getApiProviderSettings();
  const selected = settings.networkProviders?.[category] || PROVIDER_IDS.DEFAULT;
  if (selected === PROVIDER_IDS.DISABLED) {
    return PROVIDER_IDS.DISABLED;
  }
  if (selected === PROVIDER_IDS.DEFAULT) {
    return settings.defaultProvider || PROVIDER_IDS.SMART_DATA_HUB;
  }
  return selected;
};

export const isNetworkForwardingEnabled = async (category) => {
  const settings = await getApiProviderSettings();
  if (settings.forwardingEnabled === false) return false;
  const selected = settings.networkProviders?.[category] || PROVIDER_IDS.DEFAULT;
  return selected !== PROVIDER_IDS.DISABLED;
};

export const isApiForwardingEnabled = async () => {
  const settings = await getApiProviderSettings();
  return settings.forwardingEnabled !== false;
};

export const maskApiKey = (key) => {
  if (!key) return '';
  if (key.length <= 4) return '****';
  return `••••${key.slice(-4)}`;
};

export const serializeApiProviderSettingsForAdmin = async () => {
  const settings = await getApiProviderSettings();
  const smartCreds = await getProviderCredentials(PROVIDER_IDS.SMART_DATA_HUB);
  const datamaxCreds = await getProviderCredentials(PROVIDER_IDS.DATAMAX);
  const webhookUrl =
    settings.fulfillmentWebhookUrl || env.fulfillmentWebhookUrl || '';

  return {
    forwardingEnabled: settings.forwardingEnabled !== false,
    defaultProvider: settings.defaultProvider,
    networkProviders: settings.networkProviders,
    fulfillmentWebhookUrl: webhookUrl,
    providers: {
      smart_data_hub: {
        name: PROVIDER_DEFINITIONS.smart_data_hub.name,
        apiUrl: smartCreds.apiUrl,
        configured: Boolean(smartCreds.apiKey && smartCreds.apiSecret),
        apiKeyHint: maskApiKey(smartCreds.apiKey),
        apiSecretHint: maskApiKey(smartCreds.apiSecret),
      },
      datamax: {
        name: PROVIDER_DEFINITIONS.datamax.name,
        apiUrl: datamaxCreds.apiUrl,
        configured: Boolean(datamaxCreds.apiKey),
        apiKeyHint: maskApiKey(datamaxCreds.apiKey),
      },
    },
  };
};

export const updateApiProviderSettings = async (updates) => {
  const settings = await SiteSettings.findOne();
  const current = mergeSettings(settings?.apiProviderSettings);
  const next = { ...current };

  if (typeof updates.forwardingEnabled === 'boolean') {
    next.forwardingEnabled = updates.forwardingEnabled;
  }
  if (updates.defaultProvider) {
    next.defaultProvider = updates.defaultProvider;
  }
  if (updates.networkProviders) {
    next.networkProviders = { ...next.networkProviders, ...updates.networkProviders };
  }
  if (updates.fulfillmentWebhookUrl !== undefined) {
    next.fulfillmentWebhookUrl = updates.fulfillmentWebhookUrl;
  }
  if (updates.credentials) {
    for (const providerId of [PROVIDER_IDS.SMART_DATA_HUB, PROVIDER_IDS.DATAMAX]) {
      const incoming = updates.credentials[providerId];
      if (!incoming) continue;
      if (incoming.apiUrl !== undefined) {
        next.credentials[providerId].apiUrl = incoming.apiUrl;
      }
      if (incoming.apiKey) {
        next.credentials[providerId].apiKeyEncrypted = encrypt(incoming.apiKey);
      }
      if (incoming.apiSecret && providerId === PROVIDER_IDS.SMART_DATA_HUB) {
        next.credentials[providerId].apiSecretEncrypted = encrypt(incoming.apiSecret);
      }
    }
  }

  await SiteSettings.findOneAndUpdate({}, { apiProviderSettings: next }, { new: true, upsert: true });

  return serializeApiProviderSettingsForAdmin();
};

export const testProviderConnection = async (providerId) => {
  const creds = await getProviderCredentials(providerId);
  if (!creds.apiKey) {
    return { success: false, message: 'API key not configured for this provider.' };
  }

  if (providerId === PROVIDER_IDS.SMART_DATA_HUB) {
    if (!creds.apiSecret) {
      return { success: false, message: 'Smart Data Hub API secret is required for HMAC authentication.' };
    }
    return testSmartDataHubConnection(creds);
  }
  if (providerId === PROVIDER_IDS.DATAMAX) {
    return testDatamaxConnection(creds);
  }

  return { success: false, message: 'Unknown provider.' };
};

export const fetchDatamaxBalance = async () => {
  const creds = await getProviderCredentials(PROVIDER_IDS.DATAMAX);
  if (!creds.apiKey) {
    throw new AppError('Datamax API key not configured.', 400);
  }
  return getDatamaxBalance(creds);
};

export const fetchSmartDataHubBalance = async () => {
  const creds = await getProviderCredentials(PROVIDER_IDS.SMART_DATA_HUB);
  if (!creds.apiKey || !creds.apiSecret) {
    throw new AppError('Smart Data Hub API key and secret are required.', 400);
  }
  return getSmartDataHubBalance(creds);
};

export const submitViaProvider = async (providerId, order, pkg) => {
  const creds = await getProviderCredentials(providerId);

  if (providerId === PROVIDER_IDS.SMART_DATA_HUB && (!creds.apiKey || !creds.apiSecret)) {
    console.log(`[PROVIDER:${providerId}] Mock delivery (missing key/secret):`, order.reference);
    return {
      success: true,
      reference: `MOCK-${providerId}-${order.reference}`,
      mocked: true,
      providerId,
    };
  }

  if (!creds.apiKey) {
    console.log(`[PROVIDER:${providerId}] Mock delivery (no API key):`, order.reference);
    return {
      success: true,
      reference: `MOCK-${providerId}-${order.reference}`,
      mocked: true,
      providerId,
    };
  }

  if (pkg.serviceType === 'afa_registration') {
    if (providerId === PROVIDER_IDS.SMART_DATA_HUB) {
      return markInsufficientBalanceIfNeeded({
        ...(await submitSmartDataHubAFA(creds, order, pkg)),
        providerId,
      });
    }
    if (providerId === PROVIDER_IDS.DATAMAX) {
      return markInsufficientBalanceIfNeeded({
        ...(await submitDatamaxAFA(creds, order, pkg)),
        providerId,
      });
    }
  } else {
    if (providerId === PROVIDER_IDS.SMART_DATA_HUB) {
      return markInsufficientBalanceIfNeeded({
        ...(await submitSmartDataHubDataBundle(creds, order, pkg)),
        providerId,
      });
    }
    if (providerId === PROVIDER_IDS.DATAMAX) {
      return markInsufficientBalanceIfNeeded({
        ...(await submitDatamaxDataBundle(creds, order, pkg)),
        providerId,
      });
    }
  }

  throw new AppError(`Unsupported provider: ${providerId}`, 500);
};

export const getQueuedOrders = () => getQueuedProviderOrders(50);
