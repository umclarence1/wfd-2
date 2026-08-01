/**
 * One-off maintenance script: inspect / set TopDealsGH credentials in the live
 * SiteSettings document.
 *
 * Diagnose (read-only):
 *   node src/scripts/setTopdealsKeys.js
 * Write credentials:
 *   node src/scripts/setTopdealsKeys.js --write
 *
 * Requires SITE_SETTINGS_KEY and ENCRYPTION_KEY to match the production values,
 * otherwise the server cannot decrypt what this writes.
 */
import dns from 'node:dns';
import mongoose from 'mongoose';
import CryptoJS from 'crypto-js';
import { env } from '../config/env.js';
import SiteSettings from '../models/SiteSettings.js';

// Some local resolvers refuse SRV lookups needed by mongodb+srv:// URIs.
if (process.env.SCRIPT_DNS) {
  dns.setServers(process.env.SCRIPT_DNS.split(',').map((s) => s.trim()).filter(Boolean));
}

const mask = (value) => {
  const str = String(value || '');
  if (!str) return '(empty)';
  if (str.length <= 8) return `${str.slice(0, 2)}…(${str.length})`;
  return `${str.slice(0, 6)}…${str.slice(-4)} (${str.length} chars)`;
};

const tryDecrypt = (ciphertext, key) => {
  if (!ciphertext) return null;
  try {
    const plain = CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8);
    return plain || null;
  } catch {
    return null;
  }
};

const run = async () => {
  const write = process.argv.includes('--write');

  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 20000 });
  console.log('Connected to MongoDB.\n');

  const all = await SiteSettings.find().select('settingsKey updatedAt').lean();
  console.log(`SiteSettings documents (${all.length}):`);
  for (const doc of all) {
    console.log(`  - settingsKey=${JSON.stringify(doc.settingsKey)} updatedAt=${doc.updatedAt?.toISOString?.() || '?'}`);
  }

  const key = env.siteSettingsKey;
  console.log(`\nTargeting settingsKey = ${JSON.stringify(key)}`);

  const doc = await SiteSettings.findOne({ settingsKey: key });
  if (!doc) {
    console.log('!! No document with that settingsKey. Set SITE_SETTINGS_KEY to one listed above.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const creds = doc.apiProviderSettings?.credentials || {};
  console.log('\nStored credential state:');
  for (const provider of ['smart_data_hub', 'topdealsgh', 'datamax']) {
    const c = creds[provider] || {};
    console.log(
      `  ${provider}: apiUrl=${c.apiUrl || '(none)'} key=${c.apiKeyEncrypted ? 'stored' : 'empty'} secret=${c.apiSecretEncrypted ? 'stored' : 'empty'}`
    );
  }

  // Verify our ENCRYPTION_KEY matches whatever encrypted the existing values.
  const probe =
    creds.smart_data_hub?.apiKeyEncrypted ||
    creds.datamax?.apiKeyEncrypted ||
    doc.providerApiKeyEncrypted;
  if (probe) {
    const plain = tryDecrypt(probe, env.encryptionKey);
    console.log(
      `\nENCRYPTION_KEY check against existing stored value: ${plain ? `MATCH -> ${mask(plain)}` : 'MISMATCH (cannot decrypt)'}`
    );
  } else {
    console.log('\nENCRYPTION_KEY check: no existing encrypted value to probe against.');
  }

  console.log(`\nNetwork routing: ${JSON.stringify(doc.apiProviderSettings?.networkProviders || {})}`);
  console.log(`Default provider: ${doc.apiProviderSettings?.defaultProvider}`);
  console.log(`Forwarding enabled: ${doc.apiProviderSettings?.forwardingEnabled}`);

  if (process.argv.includes('--test')) {
    const { testTopDealsGhConnection } = await import('../services/providers/topdealsghProvider.js');
    const { getProviderCredentials } = await import('../services/apiProviderService.js');
    const creds = await getProviderCredentials('topdealsgh');
    console.log(`\nResolved creds -> url=${creds.apiUrl} key=${mask(creds.apiKey)} secret=${mask(creds.apiSecret)}`);
    const result = await testTopDealsGhConnection(creds);
    console.log(`Connection test: ${result.success ? 'SUCCESS' : 'FAILED'} — ${result.message}`);
  }

  if (!write) {
    console.log('\n(read-only run — pass --write to save TopDealsGH credentials)');
    await mongoose.disconnect();
    return;
  }

  const apiKey = process.env.TOPDEALSGH_API_KEY?.trim();
  const apiSecret = process.env.TOPDEALSGH_SECRET_KEY?.trim();
  if (!apiKey || !apiSecret) {
    console.log('!! TOPDEALSGH_API_KEY / TOPDEALSGH_SECRET_KEY missing from env.');
    await mongoose.disconnect();
    process.exit(1);
  }

  doc.apiProviderSettings = doc.apiProviderSettings || {};
  doc.apiProviderSettings.defaultProvider = 'topdealsgh';
  doc.apiProviderSettings.credentials = doc.apiProviderSettings.credentials || {};
  doc.apiProviderSettings.credentials.topdealsgh = {
    apiUrl: env.topdealsgh.apiUrl,
    apiKeyEncrypted: CryptoJS.AES.encrypt(apiKey, env.encryptionKey).toString(),
    apiSecretEncrypted: CryptoJS.AES.encrypt(apiSecret, env.encryptionKey).toString(),
  };
  doc.markModified('apiProviderSettings');
  await doc.save();

  const saved = await SiteSettings.findOne({ settingsKey: key }).lean();
  const stored = saved.apiProviderSettings.credentials.topdealsgh;
  console.log('\nSaved. Read-back verification:');
  console.log(`  apiUrl: ${stored.apiUrl}`);
  console.log(`  apiKey -> ${mask(tryDecrypt(stored.apiKeyEncrypted, env.encryptionKey))}`);
  console.log(`  apiSecret -> ${mask(tryDecrypt(stored.apiSecretEncrypted, env.encryptionKey))}`);

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('FAILED:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
