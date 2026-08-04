import SiteSettings from '../models/SiteSettings.js';
import { env } from '../config/env.js';
import {
  API_NETWORKS,
  DEFAULT_API_PROVIDER_SETTINGS,
  PROVIDER_IDS,
  isAlwaysApiNetwork,
  migrateProviderId,
} from '../config/apiProviders.js';

const LEGACY_FILTER = {
  $or: [{ settingsKey: { $exists: false } }, { settingsKey: null }, { settingsKey: '' }],
};

let leanSettingsCache = { at: 0, key: '', data: null };
const LEAN_SETTINGS_TTL_MS = 15_000;

const clearLeanSettingsCache = () => {
  leanSettingsCache = { at: 0, key: '', data: null };
};

export const getSiteSettingsKey = () => env.siteSettingsKey;

const assignSettingsKey = async (doc, key) => {
  doc.settingsKey = key;
  await doc.save();
  return doc;
};

/** Ensure every network routes to TopDealsGH (migrate leftover Datamax IDs). */
const normalizeApiProviderSettingsToTopDeals = (stored) => {
  const defaults = DEFAULT_API_PROVIDER_SETTINGS();
  const current = stored || {};
  const networkProviders = { ...defaults.networkProviders };

  for (const { key } of API_NETWORKS) {
    const raw = current.networkProviders?.[key];
    if (isAlwaysApiNetwork(key)) {
      // Telecel must always use a live API — never Off.
      networkProviders[key] =
        raw === PROVIDER_IDS.SMART_DATA_HUB
          ? PROVIDER_IDS.SMART_DATA_HUB
          : PROVIDER_IDS.TOPDEALSGH;
    } else if (raw === PROVIDER_IDS.DISABLED) {
      networkProviders[key] = PROVIDER_IDS.DISABLED;
    } else if (raw === PROVIDER_IDS.SMART_DATA_HUB) {
      networkProviders[key] = PROVIDER_IDS.SMART_DATA_HUB;
    } else {
      // default, datamax, topdealsgh, missing → TopDealsGH
      networkProviders[key] = PROVIDER_IDS.TOPDEALSGH;
    }
  }

  return {
    forwardingEnabled: current.forwardingEnabled !== false,
    defaultProvider:
      migrateProviderId(current.defaultProvider) === PROVIDER_IDS.SMART_DATA_HUB
        ? PROVIDER_IDS.SMART_DATA_HUB
        : PROVIDER_IDS.TOPDEALSGH,
    networkProviders,
    credentials: {
      smart_data_hub: {
        ...defaults.credentials.smart_data_hub,
        ...(current.credentials?.smart_data_hub || {}),
      },
      topdealsgh: {
        ...defaults.credentials.topdealsgh,
        ...(current.credentials?.topdealsgh || {}),
        ...(!current.credentials?.topdealsgh?.apiKeyEncrypted &&
        current.credentials?.datamax?.apiKeyEncrypted
          ? {
              apiUrl: current.credentials.datamax.apiUrl || '',
              apiKeyEncrypted: current.credentials.datamax.apiKeyEncrypted,
            }
          : {}),
      },
    },
    fulfillmentWebhookUrl: current.fulfillmentWebhookUrl || '',
  };
};

export const ensureSiteSettings = async () => {
  const key = getSiteSettingsKey();

  let settings = await SiteSettings.findOne({ settingsKey: key });
  if (settings) return settings;

  const legacy = await SiteSettings.findOne(LEGACY_FILTER).sort({ updatedAt: -1 });
  if (legacy && (await SiteSettings.countDocuments({ settingsKey: key })) === 0) {
    const legacyCount = await SiteSettings.countDocuments(LEGACY_FILTER);
    if (legacyCount === 1) {
      return assignSettingsKey(legacy, key);
    }
  }

  try {
    settings = await SiteSettings.create({
      settingsKey: key,
      apiProviderSettings: DEFAULT_API_PROVIDER_SETTINGS(),
    });
    return settings;
  } catch (err) {
    if (err?.code === 11000) {
      return SiteSettings.findOne({ settingsKey: key });
    }
    throw err;
  }
};

export const getSiteSettings = async (lean = false) => {
  const key = getSiteSettingsKey();

  // Short in-memory cache — every request hits maintenanceCheck → getSiteSettings.
  if (lean) {
    const now = Date.now();
    if (
      leanSettingsCache.key === key &&
      leanSettingsCache.data &&
      now - leanSettingsCache.at < LEAN_SETTINGS_TTL_MS
    ) {
      return leanSettingsCache.data;
    }
  }

  const query = SiteSettings.findOne({ settingsKey: key });
  let settings = lean ? await query.lean() : await query;

  if (!settings) {
    const created = await ensureSiteSettings();
    settings = lean ? created.toObject() : created;
  }

  if (lean && settings) {
    leanSettingsCache = { at: Date.now(), key, data: settings };
  }

  return settings;
};

export const updateSiteSettings = async (updates, options = {}) => {
  const key = getSiteSettingsKey();
  await ensureSiteSettings();
  clearLeanSettingsCache();

  return SiteSettings.findOneAndUpdate(
    { settingsKey: key },
    updates,
    { new: true, upsert: true, runValidators: true, ...options }
  );
};

export const setSiteSettingsFields = async (fields) => {
  const $set = {};
  for (const [field, value] of Object.entries(fields)) {
    if (value !== undefined) $set[field] = value;
  }
  if (!Object.keys($set).length) {
    return getSiteSettings();
  }
  return updateSiteSettings({ $set });
};

export const migrateSiteSettingsOnBoot = async () => {
  const key = getSiteSettingsKey();
  const canonical = await ensureSiteSettings();

  const duplicateKeys = await SiteSettings.find({
    settingsKey: key,
    _id: { $ne: canonical._id },
  }).sort({ updatedAt: -1 });

  for (const duplicate of duplicateKeys) {
    if (duplicate.apiProviderSettings && !canonical.apiProviderSettings?.defaultProvider) {
      canonical.apiProviderSettings = duplicate.apiProviderSettings;
    }
    await SiteSettings.deleteOne({ _id: duplicate._id });
  }

  const legacyDuplicates = await SiteSettings.find({
    _id: { $ne: canonical._id },
    ...LEGACY_FILTER,
  });

  for (const legacy of legacyDuplicates) {
    if (!canonical.apiProviderSettings?.networkProviders && legacy.apiProviderSettings) {
      canonical.apiProviderSettings = legacy.apiProviderSettings;
    }
    await SiteSettings.deleteOne({ _id: legacy._id });
  }

  // Force TopDealsGH as the live provider for data/AFA (migrate Datamax leftovers).
  canonical.apiProviderSettings = normalizeApiProviderSettingsToTopDeals(
    canonical.apiProviderSettings
  );
  canonical.markModified('apiProviderSettings');

  await canonical.save();
};
