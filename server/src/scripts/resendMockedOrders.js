/**
 * Re-submit paid orders that were mock-fulfilled (or never reached a provider).
 *
 *   node src/scripts/resendMockedOrders.js --list
 *   node src/scripts/resendMockedOrders.js --ref=ORD-20260731-XXXX
 *   node src/scripts/resendMockedOrders.js --all
 *
 * Requires SITE_SETTINGS_KEY to match production so network routing resolves
 * the same way the live server does.
 */
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Order from '../models/Order.js';
import { fulfillOrder } from '../services/orderService.js';
import { fetchTopDealsGhBalance } from '../services/apiProviderService.js';

if (process.env.SCRIPT_DNS) {
  dns.setServers(process.env.SCRIPT_DNS.split(',').map((s) => s.trim()).filter(Boolean));
}

const UNSENT_FILTER = {
  paymentStatus: 'paid',
  $or: [
    { 'metadata.queuedForProvider': true },
    { providerReference: { $in: [null, ''] } },
    { providerReference: { $exists: false } },
    { providerReference: /^MOCK-/i },
    { 'providerResponse.mocked': true },
  ],
};

const arg = (name) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : null;
};

const wallet = async (label) => {
  try {
    const b = await fetchTopDealsGhBalance();
    console.log(`  [wallet ${label}] GHS ${b.balance}`);
    return Number(b.balance);
  } catch (err) {
    console.log(`  [wallet ${label}] unavailable: ${err.message}`);
    return null;
  }
};

const run = async () => {
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 20000 });
  console.log(`nodeEnv=${env.nodeEnv}  settingsKey=${env.siteSettingsKey}\n`);

  const ref = arg('ref');
  const since = arg('since');
  const query = ref
    ? { reference: ref }
    : { ...UNSENT_FILTER, ...(since ? { createdAt: { $gte: new Date(`${since}T00:00:00Z`) } } : {}) };
  const orders = await Order.find(query).sort({ createdAt: 1 });

  if (!orders.length) {
    console.log('No matching orders.');
    await mongoose.disconnect();
    return;
  }

  if (process.argv.includes('--list')) {
    for (const o of orders) {
      console.log(
        `${o.reference}  ${o.phone}  ${o.packageName}  GHS ${o.totalAmount}  ` +
        `delivery=${o.deliveryStatus}  ref=${o.providerReference || '(none)'}`
      );
    }
    console.log(`\n${orders.length} order(s).`);
    await mongoose.disconnect();
    return;
  }

  if (!ref && !process.argv.includes('--all')) {
    console.log('Refusing to run: pass --ref=<reference>, --all, or --list.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const before = await wallet('before');
  console.log('');

  for (const order of orders) {
    console.log(`>>> ${order.reference}  ${order.phone}  ${order.packageName}  GHS ${order.totalAmount}`);
    const oldRef = order.providerReference;

    // Clear mock/no-op fulfilment so fulfillOrder does not short-circuit.
    order.providerReference = undefined;
    order.providerResponse = undefined;
    order.deliveryStatus = 'pending';
    order.failureReason = undefined;
    order.metadata = {
      ...(order.metadata || {}),
      queuedForProvider: false,
      resentAt: new Date().toISOString(),
      previousMockReference: oldRef || null,
    };
    order.markModified('metadata');
    await order.save();

    try {
      const updated = await fulfillOrder(order._id, null);
      const fresh = await Order.findById(order._id).lean();
      const mocked =
        fresh?.providerResponse?.mocked === true || /^MOCK-/i.test(fresh?.providerReference || '');
      console.log(
        `    delivery=${fresh?.deliveryStatus}  providerRef=${fresh?.providerReference || '(none)'}  ` +
        `${mocked ? '*** STILL MOCKED ***' : 'REAL'}`
      );
      if (fresh?.failureReason) console.log(`    failureReason=${fresh.failureReason}`);
    } catch (err) {
      console.log(`    FAILED: ${err.message}`);
    }
  }

  console.log('');
  const after = await wallet('after');
  if (before != null && after != null) {
    console.log(`\nWallet change: GHS ${(before - after).toFixed(2)} spent.`);
  }

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('FAILED:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
