import { env } from '../config/env.js';
import {
  API_NETWORKS,
  DEFAULT_API_PROVIDER_SETTINGS,
  PROVIDER_DEFINITIONS,
  PROVIDER_IDS,
  isAlwaysApiNetwork,
  migrateProviderId,
} from '../config/apiProviders.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/errorHandler.js';
import { markInsufficientBalanceIfNeeded } from '../utils/providerQueue.js';
import { getQueuedProviderOrders } from './orderQueueService.js';
import { getSiteSettings, setSiteSettingsFields } from './siteSettingsService.js';
import { sanitizeProviderApiUrl } from '../utils/providerUrl.js';
import {
  testSmartDataHubConnection,
  getSmartDataHubBalance,
  submitSmartDataHubDataBundle,
  submitSmartDataHubAFA,
} from './providers/smartDataHubProvider.js';
import {
  testTopDealsGhConnection,
  getTopDealsGhBalance,
  submitTopDealsGhDataBundle,
  submitTopDealsGhAFA,
} from './providers/topdealsghProvider.js';

const mergeSettings = (stored) => {
  const defaults = DEFAULT_API_PROVIDER_SETTINGS();
  if (!stored) return defaults;

  const networkProviders = {};
  for (const { key } of API_NETWORKS) {
    const storedValue = stored.networkProviders?.[key];
    let resolved =
      storedValue !== undefined && storedValue !== null && storedValue !== ''
        ? migrateProviderId(storedValue)
        : defaults.networkProviders[key] ?? PROVIDER_IDS.DEFAULT;

    // Telecel can never be Off in effective settings.
    if (isAlwaysApiNetwork(key) && resolved === PROVIDER_IDS.DISABLED) {
      resolved = migrateProviderId(stored.defaultProvider) || PROVIDER_IDS.TOPDEALSGH;
    }

    networkProviders[key] = resolved;
  }

  const storedDefault = migrateProviderId(stored.defaultProvider);

  return {
    forwardingEnabled: stored.forwardingEnabled ?? defaults.forwardingEnabled,
    defaultProvider: storedDefault || defaults.defaultProvider,
    networkProviders,
    credentials: {
      smart_data_hub: {
        ...defaults.credentials.smart_data_hub,
        ...(stored.credentials?.smart_data_hub || {}),
      },
      topdealsgh: {
        ...defaults.credentials.topdealsgh,
        ...(stored.credentials?.topdealsgh || {}),
        // Migrate leftover Datamax key into TopDealsGH if TopDealsGH not set
        ...(!stored.credentials?.topdealsgh?.apiKeyEncrypted &&
        stored.credentials?.datamax?.apiKeyEncrypted
          ? {
              apiUrl: stored.credentials.datamax.apiUrl || '',
              apiKeyEncrypted: stored.credentials.datamax.apiKeyEncrypted,
            }
          : {}),
      },
    },
    fulfillmentWebhookUrl: stored.fulfillmentWebhookUrl ?? defaults.fulfillmentWebhookUrl,
  };
};

export const getApiProviderSettings = async () => {
  const settings = await getSiteSettings(true);
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
  if (providerId === PROVIDER_IDS.TOPDEALSGH) {
    return {
      apiUrl: env.topdealsgh.apiUrl,
      apiKey: env.topdealsgh.apiKey,
      apiSecret: env.topdealsgh.secretKey,
    };
  }
  return { apiUrl: '', apiKey: '', apiSecret: '' };
};

export const getProviderCredentials = async (providerId) => {
  const id = migrateProviderId(providerId);
  const config = PROVIDER_DEFINITIONS[id];
  if (!config) return { apiUrl: '', apiKey: '', apiSecret: '' };

  const settings = await getApiProviderSettings();
  const stored = settings.credentials?.[id] || {};
  const envCreds = getEnvCredentials(id);
  let apiUrl = stored.apiUrl || envCreds.apiUrl || config.defaultUrl;
  apiUrl = sanitizeProviderApiUrl(id, apiUrl);
  let apiKey = envCreds.apiKey || '';
  let apiSecret = envCreds.apiSecret || '';

  // Env credentials win when set so rotated Vercel secrets override stale admin storage.
  if (stored.apiKeyEncrypted && !apiKey) {
    try {
      apiKey = decrypt(stored.apiKeyEncrypted);
    } catch {
      apiKey = '';
    }
  }

  if (stored.apiSecretEncrypted && !apiSecret) {
    try {
      apiSecret = decrypt(stored.apiSecretEncrypted);
    } catch {
      apiSecret = '';
    }
  }

  return {
    apiUrl: String(apiUrl || '').replace(/\/$/, '').trim(),
    apiKey: String(apiKey || '').trim(),
    apiSecret: String(apiSecret || '').trim(),
  };
};

export const resolveProviderForCategory = async (category) => {
  const settings = await getApiProviderSettings();
  const selected = migrateProviderId(
    settings.networkProviders?.[category] || PROVIDER_IDS.DEFAULT
  );

  // Telecel (and any ALWAYS_API network) always resolve to a live provider.
  if (isAlwaysApiNetwork(category)) {
    if (
      selected === PROVIDER_IDS.DISABLED ||
      selected === PROVIDER_IDS.DEFAULT ||
      !selected
    ) {
      return migrateProviderId(settings.defaultProvider) || PROVIDER_IDS.TOPDEALSGH;
    }
    return selected;
  }

  if (selected === PROVIDER_IDS.DISABLED) {
    return PROVIDER_IDS.DISABLED;
  }
  if (selected === PROVIDER_IDS.DEFAULT) {
    return migrateProviderId(settings.defaultProvider) || PROVIDER_IDS.TOPDEALSGH;
  }
  return selected;
};

export const isNetworkForwardingEnabled = async (category) => {
  if (isAlwaysApiNetwork(category)) return true;
  const settings = await getApiProviderSettings();
  if (settings.forwardingEnabled === false) return false;
  const selected = migrateProviderId(
    settings.networkProviders?.[category] || PROVIDER_IDS.DEFAULT
  );
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
  const topCreds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
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
      topdealsgh: {
        name: PROVIDER_DEFINITIONS.topdealsgh.name,
        apiUrl: topCreds.apiUrl,
        configured: Boolean(topCreds.apiKey && topCreds.apiSecret),
        apiKeyHint: maskApiKey(topCreds.apiKey),
        apiSecretHint: maskApiKey(topCreds.apiSecret),
      },
    },
  };
};

export const updateApiProviderSettings = async (updates) => {
  const settings = await getSiteSettings();
  const current = mergeSettings(settings?.apiProviderSettings);
  const next = {
    forwardingEnabled: current.forwardingEnabled,
    defaultProvider: current.defaultProvider,
    networkProviders: { ...current.networkProviders },
    credentials: {
      smart_data_hub: { ...current.credentials.smart_data_hub },
      topdealsgh: { ...current.credentials.topdealsgh },
    },
    fulfillmentWebhookUrl: current.fulfillmentWebhookUrl,
  };

  if (typeof updates.forwardingEnabled === 'boolean') {
    next.forwardingEnabled = updates.forwardingEnabled;
  }
  if (updates.defaultProvider) {
    next.defaultProvider = migrateProviderId(updates.defaultProvider);
  }
  if (updates.networkProviders) {
    for (const { key } of API_NETWORKS) {
      const value = updates.networkProviders[key];
      if (value !== undefined && value !== null && value !== '') {
        const migrated = migrateProviderId(value);
        // Telecel cannot be turned Off — always keep a live provider.
        if (isAlwaysApiNetwork(key) && migrated === PROVIDER_IDS.DISABLED) {
          next.networkProviders[key] =
            migrateProviderId(next.defaultProvider) || PROVIDER_IDS.TOPDEALSGH;
        } else {
          next.networkProviders[key] = migrated;
        }
      }
    }
  }

  // Hard guarantee even if Telecel was previously saved as disabled.
  if (isAlwaysApiNetwork('Telecel')) {
    const telecel = next.networkProviders.Telecel;
    if (!telecel || telecel === PROVIDER_IDS.DISABLED) {
      next.networkProviders.Telecel =
        migrateProviderId(next.defaultProvider) || PROVIDER_IDS.TOPDEALSGH;
    }
  }
  if (updates.fulfillmentWebhookUrl !== undefined) {
    next.fulfillmentWebhookUrl = updates.fulfillmentWebhookUrl;
  }
  if (updates.credentials) {
    for (const providerId of [PROVIDER_IDS.SMART_DATA_HUB, PROVIDER_IDS.TOPDEALSGH]) {
      const incoming = updates.credentials[providerId];
      if (!incoming) continue;
      if (incoming.apiUrl !== undefined) {
        next.credentials[providerId].apiUrl = sanitizeProviderApiUrl(
          providerId,
          incoming.apiUrl
        );
      }
      if (incoming.apiKey) {
        next.credentials[providerId].apiKeyEncrypted = encrypt(incoming.apiKey);
      }
      if (incoming.apiSecret) {
        next.credentials[providerId].apiSecretEncrypted = encrypt(incoming.apiSecret);
      }
    }
  }

  await setSiteSettingsFields({ apiProviderSettings: next });

  return serializeApiProviderSettingsForAdmin();
};

export const testProviderConnection = async (providerId) => {
  const id = migrateProviderId(providerId);
  const creds = await getProviderCredentials(id);
  if (!creds.apiKey) {
    return { success: false, message: 'API key not configured for this provider.' };
  }

  if (id === PROVIDER_IDS.SMART_DATA_HUB) {
    if (!creds.apiSecret) {
      return { success: false, message: 'Smart Data Hub API secret is required for HMAC authentication.' };
    }
    return testSmartDataHubConnection(creds);
  }
  if (id === PROVIDER_IDS.TOPDEALSGH) {
    if (!creds.apiSecret) {
      return { success: false, message: 'TopDealsGH secret key (x-secret-key) is required.' };
    }
    return testTopDealsGhConnection(creds);
  }

  return { success: false, message: 'Unknown provider.' };
};

export const fetchTopDealsGhBalance = async () => {
  const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
  if (!creds.apiKey || !creds.apiSecret) {
    throw new AppError('TopDealsGH API key and secret key are required.', 400);
  }
  return getTopDealsGhBalance(creds);
};

export const fetchSmartDataHubBalance = async () => {
  const creds = await getProviderCredentials(PROVIDER_IDS.SMART_DATA_HUB);
  if (!creds.apiKey || !creds.apiSecret) {
    throw new AppError('Smart Data Hub API key and secret are required.', 400);
  }
  return getSmartDataHubBalance(creds);
};

/** @deprecated Use fetchTopDealsGhBalance */
export const fetchDatamaxBalance = fetchTopDealsGhBalance;

export const submitViaProvider = async (providerId, order, pkg) => {
  const id = migrateProviderId(providerId);
  const creds = await getProviderCredentials(id);
  const missingCreds =
    (id === PROVIDER_IDS.SMART_DATA_HUB && (!creds.apiKey || !creds.apiSecret)) ||
    (id === PROVIDER_IDS.TOPDEALSGH && (!creds.apiKey || !creds.apiSecret)) ||
    !creds.apiKey;

  if (missingCreds) {
    // Never mock-fulfill paid orders — fail closed (esp. production).
    if (env.nodeEnv === 'production' || isAlwaysApiNetwork(pkg?.category || order?.category)) {
      throw new AppError(
        'Delivery provider is not configured. Set API credentials under Admin → API Providers.',
        503
      );
    }
    const allowMock = process.env.ALLOW_MOCK_FULFILLMENT === 'true';
    if (!allowMock) {
      throw new AppError(
        'Delivery provider is not configured. Set API credentials or ALLOW_MOCK_FULFILLMENT=true for local testing.',
        503
      );
    }
    console.log(`[PROVIDER:${id}] Mock delivery (dev only):`, order.reference);
    return {
      success: true,
      reference: `MOCK-${id}-${order.reference}`,
      mocked: true,
      providerId: id,
    };
  }

  if (pkg.serviceType === 'afa_registration') {
    if (id === PROVIDER_IDS.SMART_DATA_HUB) {
      return markInsufficientBalanceIfNeeded({
        ...(await submitSmartDataHubAFA(creds, order, pkg)),
        providerId: id,
      });
    }
    if (id === PROVIDER_IDS.TOPDEALSGH) {
      return markInsufficientBalanceIfNeeded({
        ...(await submitTopDealsGhAFA(creds, order, pkg)),
        providerId: id,
      });
    }
  } else {
    if (id === PROVIDER_IDS.SMART_DATA_HUB) {
      return markInsufficientBalanceIfNeeded({
        ...(await submitSmartDataHubDataBundle(creds, order, pkg)),
        providerId: id,
      });
    }
    if (id === PROVIDER_IDS.TOPDEALSGH) {
      return markInsufficientBalanceIfNeeded({
        ...(await submitTopDealsGhDataBundle(creds, order, pkg)),
        providerId: id,
      });
    }
  }

  throw new AppError(`Unsupported provider: ${id}`, 500);
};

export const getQueuedOrders = () => getQueuedProviderOrders(50);

export const isTopDealsGhConfigured = async () => {
  const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
  return Boolean(creds.apiKey && creds.apiSecret);
};
