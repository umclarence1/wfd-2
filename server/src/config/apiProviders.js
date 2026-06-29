export const PROVIDER_IDS = {
  DEFAULT: 'default',
  DISABLED: 'disabled',
  SMART_DATA_HUB: 'smart_data_hub',
  DATAMAX: 'datamax',
};

export const API_NETWORKS = [
  { key: 'MTN', label: 'MTN', serviceType: 'data_bundle' },
  { key: 'Telecel', label: 'Telecel', serviceType: 'data_bundle' },
  { key: 'AirtelTigo', label: 'AirtelTigo', serviceType: 'data_bundle' },
  { key: 'AirtelTigo Big Time', label: 'AirtelTigo Big Time', serviceType: 'data_bundle' },
  { key: 'MTN AFA', label: 'AFA Registration', serviceType: 'afa_registration', hint: 'MTN farmer registration via Datamax' },
];

export const PROVIDER_DEFINITIONS = {
  [PROVIDER_IDS.SMART_DATA_HUB]: {
    id: PROVIDER_IDS.SMART_DATA_HUB,
    name: 'Smart Data Hub',
    defaultUrl: 'https://smartdatahubgh.com/api/v1',
    envUrlKey: 'SMART_DATA_HUB_API_URL',
    envKeyKey: 'SMART_DATA_HUB_API_KEY',
  },
  [PROVIDER_IDS.DATAMAX]: {
    id: PROVIDER_IDS.DATAMAX,
    name: 'Datamax',
    defaultUrl: 'https://datamax.site/wp-json/api/v1',
    afaApiUrl: 'https://datamax.site/wp-json/afa/v1',
    envUrlKey: 'DATAMAX_API_URL',
    envKeyKey: 'DATAMAX_API_KEY',
  },
};

export const NETWORK_API_CODES = {
  MTN: 'mtn',
  Telecel: 'telecel',
  AirtelTigo: 'airteltigo',
  'AirtelTigo Big Time': 'bigtime',
  'MTN AFA': 'mtn_afa',
};

export const DEFAULT_API_PROVIDER_SETTINGS = () => ({
  forwardingEnabled: true,
  defaultProvider: PROVIDER_IDS.SMART_DATA_HUB,
  networkProviders: {
    MTN: PROVIDER_IDS.SMART_DATA_HUB,
    Telecel: PROVIDER_IDS.DATAMAX,
    AirtelTigo: PROVIDER_IDS.DATAMAX,
    'AirtelTigo Big Time': PROVIDER_IDS.DATAMAX,
    'MTN AFA': PROVIDER_IDS.DATAMAX,
  },
  credentials: {
    smart_data_hub: { apiUrl: '', apiKeyEncrypted: '', apiSecretEncrypted: '' },
    datamax: { apiUrl: '', apiKeyEncrypted: '' },
  },
  fulfillmentWebhookUrl: '',
});
