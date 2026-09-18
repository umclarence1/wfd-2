/**
 * Run the one-time order repair locally (production DB via MONGODB_URI).
 *
 *   node src/scripts/fixStuckOrdersOnce.js
 */
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { runOrderFulfillmentRepair } from '../services/fixStuckOrdersService.js';

if (process.env.SCRIPT_DNS) {
  dns.setServers(process.env.SCRIPT_DNS.split(',').map((s) => s.trim()).filter(Boolean));
}

const run = async () => {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 30000 });
  const result = await runOrderFulfillmentRepair(null, { submit: true });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('FAILED:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
