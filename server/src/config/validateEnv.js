import { env } from './env.js';

const REQUIRED_IN_PRODUCTION = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'PAYSTACK_SECRET_KEY',
];

const RECOMMENDED_IN_PRODUCTION = ['CRON_SECRET', 'ADMIN_OTP_EMAIL'];

export const validateProductionEnv = () => {
  if (env.nodeEnv !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const weakSecrets = [
    ['JWT_ACCESS_SECRET', 'dev-access-secret'],
    ['JWT_REFRESH_SECRET', 'dev-refresh-secret'],
    ['ENCRYPTION_KEY', 'dev-encryption-key'],
    ['ADMIN_PASSWORD', 'Admin@123456'],
    ['CRON_SECRET', 'change-me'],
  ];

  for (const [key, fragment] of weakSecrets) {
    if (process.env[key]?.includes(fragment)) {
      throw new Error(`${key} must be changed from the default value in production.`);
    }
  }

  for (const key of RECOMMENDED_IN_PRODUCTION) {
    if (!process.env[key]?.trim()) {
      console.warn(`[ENV] Warning: ${key} is not set. Some features will be unavailable.`);
    }
  }

  if (process.env.CRON_SECRET && process.env.CRON_SECRET.trim().length < 24) {
    console.warn('[ENV] Warning: CRON_SECRET should be at least 24 characters.');
  }
};
