/**
 * Unpause BECE result checker and sync availability from TopDealsGH stock.
 *
 *   node src/scripts/enableBeceChecker.js
 */
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Package from '../models/Package.js';
import { syncCheckerPackageAvailability } from '../services/checkerService.js';

if (process.env.SCRIPT_DNS) {
  dns.setServers(process.env.SCRIPT_DNS.split(',').map((s) => s.trim()).filter(Boolean));
}

const run = async () => {
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 20000 });

  const before = await Package.find({ serviceType: 'result_checker' })
    .select('name checkerType isActive adminPaused isAvailable')
    .lean();
  console.log('Before:', JSON.stringify(before, null, 2));

  const result = await Package.updateMany(
    { serviceType: 'result_checker', checkerType: /^(BECE|WASSCE)$/i, isActive: true },
    { $set: { adminPaused: false } }
  );
  console.log(`Unpaused checkers: matched=${result.matchedCount} modified=${result.modifiedCount}`);

  const sync = await syncCheckerPackageAvailability();
  console.log('Stock sync:', JSON.stringify(sync, null, 2));

  const after = await Package.find({ serviceType: 'result_checker' })
    .select('name checkerType isActive adminPaused isAvailable')
    .lean();
  console.log('After:', JSON.stringify(after, null, 2));

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('FAILED:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
