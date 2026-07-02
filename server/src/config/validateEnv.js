import { env } from './env.js';

const REQUIRED_IN_PRODUCTION = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
];

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
  ];

  for (const [key, fragment] of weakSecrets) {
    if (process.env[key]?.includes(fragment)) {
      throw new Error(`${key} must be changed from the default value in production.`);
    }
  }
};
