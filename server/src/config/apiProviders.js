export const PROVIDER_IDS = {
  DEFAULT: 'default',
  DISABLED: 'disabled',
  SMART_DATA_HUB: 'smart_data_hub',
  TOPDEALSGH: 'topdealsgh',
};

export const API_NETWORKS = [
  { key: 'MTN', label: 'MTN', serviceType: 'data_bundle' },
  { key: 'MTN EXPRESS', label: 'MTN EXPRESS', serviceType: 'data_bundle' },
  { key: 'Telecel', label: 'Telecel', serviceType: 'data_bundle' },
  { key: 'AirtelTigo', label: 'AirtelTigo', serviceType: 'data_bundle' },
  { key: 'AirtelTigo Big Time', label: 'AirtelTigo Big Time', serviceType: 'data_bundle' },
  { key: 'MTN AFA', label: 'AFA Registration', serviceType: 'afa_registration', hint: 'MTN AFA via TopDealsGH' },
];

export const PROVIDER_DEFINITIONS = {
  [PROVIDER_IDS.SMART_DATA_HUB]: {
    id: PROVIDER_IDS.SMART_DATA_HUB,
    name: 'Smart Data Hub',
    defaultUrl: 'https://smartdatahubgh.com/api/v1',
    envUrlKey: 'SMART_DATA_HUB_API_URL',
    envKeyKey: 'SMART_DATA_HUB_API_KEY',
  },
  [PROVIDER_IDS.TOPDEALSGH]: {
    id: PROVIDER_IDS.TOPDEALSGH,
    name: 'TopDealsGH',
    defaultUrl: 'https://www.topdealsgh.com/api/v1/agent',
    envUrlKey: 'TOPDEALSGH_API_URL',
    envKeyKey: 'TOPDEALSGH_API_KEY',
    envSecretKey: 'TOPDEALSGH_SECRET_KEY',
  },
};

export const NETWORK_API_CODES = {
  MTN: 'mtn',
  'MTN EXPRESS': 'mtn_express',
  Telecel: 'telecel',
  AirtelTigo: 'airteltigo',
  'AirtelTigo Big Time': 'bigtime',
  'MTN AFA': 'mtn_afa',
};

/** All storefront networks — always TopDealsGH, never Off. */
export const TOPDEALSGH_NETWORKS = new Set(API_NETWORKS.map(({ key }) => key));

/** @deprecated Smart Data Hub is not used for order routing. */
export const SMART_DATA_HUB_NETWORKS = new Set();

export const isTopDealsGhNetwork = (category) =>
  TOPDEALSGH_NETWORKS.has(String(category || '').trim());

/** @deprecated use isTopDealsGhNetwork */
export const isTopDealsGhOnlyNetwork = isTopDealsGhNetwork;

export const isAlwaysApiNetwork = (category) => isTopDealsGhNetwork(category);

/** @deprecated always false — orders no longer route to Smart Data Hub. */
export const isSmartDataHubNetwork = () => false;

export const DEFAULT_API_PROVIDER_SETTINGS = () => ({
  forwardingEnabled: true,
  defaultProvider: PROVIDER_IDS.TOPDEALSGH,
  networkProviders: Object.fromEntries(
    API_NETWORKS.map(({ key }) => [key, PROVIDER_IDS.TOPDEALSGH])
  ),
  credentials: {
    smart_data_hub: { apiUrl: '', apiKeyEncrypted: '', apiSecretEncrypted: '' },
    topdealsgh: { apiUrl: '', apiKeyEncrypted: '', apiSecretEncrypted: '' },
  },
  fulfillmentWebhookUrl: '',
});

/** Normalize legacy Datamax IDs stored in MongoDB to TopDealsGH. */
export const migrateProviderId = (value) => {
  if (value === 'datamax') return PROVIDER_IDS.TOPDEALSGH;
  if (value === PROVIDER_IDS.SMART_DATA_HUB) return PROVIDER_IDS.TOPDEALSGH;
  return value;
};
