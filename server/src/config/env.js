import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const requireSecret = (key, devFallback) => {
  const value = process.env[key];
  if (value) return value;
  if (isProduction) throw new Error(`${key} is required in production.`);
  return devFallback;
};

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    accessSecret: requireSecret('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production'),
    refreshSecret: requireSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  },
  smtp: {
    host: process.env.SMTP_HOST?.trim(),
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER?.trim(),
    pass: process.env.SMTP_PASS?.trim().replace(/\s+/g, ''),
    from: process.env.EMAIL_FROM?.trim() || 'Wilberforce Data Service <noreply@wds.com>',
  },
  resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
  mnotify: {
    apiKey: process.env.MNOTIFY_API_KEY,
    senderId: process.env.MNOTIFY_SENDER_ID || 'WDS',
  },
  arkesel: {
    apiKey: process.env.ARKESEL_API_KEY?.trim() || '',
    senderId: process.env.ARKESEL_SENDER_ID?.trim() || 'WDS',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  provider: {
    apiUrl: process.env.PROVIDER_API_URL,
    apiKey: process.env.PROVIDER_API_KEY,
  },
  smartDataHub: {
    apiUrl: process.env.SMART_DATA_HUB_API_URL || 'https://smartdatahubgh.com/api/v1',
    apiKey: process.env.SMART_DATA_HUB_API_KEY || '',
    apiSecret: process.env.SMART_DATA_HUB_API_SECRET || '',
  },
  topdealsgh: {
    apiUrl: process.env.TOPDEALSGH_API_URL || 'https://www.topdealsgh.com/api/v1/agent',
    apiKey: process.env.TOPDEALSGH_API_KEY || '',
    secretKey: process.env.TOPDEALSGH_SECRET_KEY || '',
  },
  fulfillmentWebhookUrl: process.env.FULFILLMENT_WEBHOOK_URL || '',
  encryptionKey: requireSecret('ENCRYPTION_KEY', 'dev-encryption-key-32-chars!!'),
  paystackChargeRate: 0.02,
  adminOtpEmail: process.env.ADMIN_OTP_EMAIL?.trim().toLowerCase() || '',
  adminOtpPhone: process.env.ADMIN_OTP_PHONE?.trim() || '',
  siteSettingsKey:
    process.env.SITE_SETTINGS_KEY?.trim() ||
    (() => {
      try {
        const host = new URL(process.env.CLIENT_URL || 'http://localhost:5173').hostname;
        return host.replace(/^www\./, '') || 'wilberforce';
      } catch {
        return 'wilberforce';
      }
    })(),
};

export default env;
