import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'Wilberforce Data Service <noreply@wds.com>',
  },
  mnotify: {
    apiKey: process.env.MNOTIFY_API_KEY,
    senderId: process.env.MNOTIFY_SENDER_ID || 'WDS',
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
  datamax: {
    apiUrl: process.env.DATAMAX_API_URL || 'https://datamax.site/wp-json/api/v1',
    apiKey: process.env.DATAMAX_API_KEY || '',
    afaApiUrl: process.env.DATAMAX_AFA_API_URL || 'https://datamax.site/wp-json/afa/v1',
  },
  fulfillmentWebhookUrl: process.env.FULFILLMENT_WEBHOOK_URL || '',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars!!',
  paystackChargeRate: 0.02,
  adminOtpEmail: process.env.ADMIN_OTP_EMAIL || 'wilberforceboanu2002@gmail.com',
};

export default env;
