import mongoose from 'mongoose';

const siteSettingsSchema = new mongoose.Schema(
  {
    siteName: { type: String, default: 'Wilberforce Data Service' },
    tagline: { type: String, default: 'Fast, reliable digital services in Ghana' },
    logo: { type: String, default: '' },
    favicon: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '0595399837' },
    whatsapp: { type: String, default: '' },
    address: { type: String, default: 'Sunyani' },
    socialLinks: {
      facebook: String,
      twitter: String,
      instagram: String,
      tiktok: String,
    },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'We are currently under maintenance. Please check back soon.' },
    announcementBanner: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
      link: { type: String, default: '' },
    },
    providerApiUrl: { type: String, default: '' },
    providerApiKeyEncrypted: { type: String, default: '' },
    apiProviderSettings: {
      forwardingEnabled: { type: Boolean, default: true },
      defaultProvider: {
        type: String,
        enum: ['default', 'smart_data_hub', 'datamax'],
        default: 'smart_data_hub',
      },
      networkProviders: {
        MTN: { type: String, default: 'smart_data_hub' },
        Telecel: { type: String, default: 'datamax' },
        AirtelTigo: { type: String, default: 'datamax' },
        'AirtelTigo Big Time': { type: String, default: 'datamax' },
        'MTN AFA': { type: String, default: 'datamax' },
      },
      credentials: {
        smart_data_hub: {
          apiUrl: { type: String, default: '' },
          apiKeyEncrypted: { type: String, default: '' },
          apiSecretEncrypted: { type: String, default: '' },
        },
        datamax: {
          apiUrl: { type: String, default: '' },
          apiKeyEncrypted: { type: String, default: '' },
        },
      },
      fulfillmentWebhookUrl: { type: String, default: '' },
    },
    paystackPublicKey: { type: String, default: '' },
    stats: {
      totalOrders: { type: Number, default: 0 },
      happyCustomers: { type: Number, default: 5000 },
      bundlesDelivered: { type: Number, default: 10000 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('SiteSettings', siteSettingsSchema);
