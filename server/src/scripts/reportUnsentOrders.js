/**
 * Report paid orders that were never submitted to a provider API.
 *
 *   node src/scripts/reportUnsentOrders.js                # yesterday (UTC)
 *   node src/scripts/reportUnsentOrders.js 2026-07-30     # a specific day
 *   node src/scripts/reportUnsentOrders.js 2026-07-28 2026-07-31   # range [from, to)
 *
 * "Reached the API" means the order has a providerReference AND is not flagged
 * metadata.queuedForProvider. Anything else never made it to the provider.
 * Ghana is UTC+0, so UTC day boundaries match local days.
 */
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Order from '../models/Order.js';

if (process.env.SCRIPT_DNS) {
  dns.setServers(process.env.SCRIPT_DNS.split(',').map((s) => s.trim()).filter(Boolean));
}

const startOfUtcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const parseArgs = () => {
  const hoursArg = process.argv.find((a) => a.startsWith('--hours='));
  if (hoursArg) {
    const hours = Number(hoursArg.split('=')[1]) || 1;
    return { from: new Date(Date.now() - hours * 3600000), to: new Date(Date.now() + 60000) };
  }
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (args.length >= 2) return { from: new Date(`${args[0]}T00:00:00Z`), to: new Date(`${args[1]}T00:00:00Z`) };
  if (args.length === 1) {
    const from = new Date(`${args[0]}T00:00:00Z`);
    return { from, to: new Date(from.getTime() + 86400000) };
  }
  const to = startOfUtcDay(new Date());
  return { from: new Date(to.getTime() - 86400000), to };
};

const pad = (v, n) => String(v ?? '').padEnd(n).slice(0, n);

const run = async () => {
  const { from, to } = parseArgs();
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 20000 });

  const window = { createdAt: { $gte: from, $lt: to } };
  console.log(`Window (UTC): ${from.toISOString()}  ->  ${to.toISOString()}\n`);

  const totalPaid = await Order.countDocuments({ ...window, paymentStatus: 'paid' });
  const totalAll = await Order.countDocuments(window);

  const lastArg = process.argv.find((a) => a.startsWith('--last='));
  if (lastArg) {
    const n = Number(lastArg.split('=')[1]) || 10;
    const recent = await Order.find({}).sort({ createdAt: -1 }).limit(n).lean();
    console.log(`--- LAST ${recent.length} ORDERS (newest first) ---\n`);
    for (const o of recent) {
      console.log(`${o.reference}  ${new Date(o.createdAt).toISOString()}`);
      console.log(`  phone=${o.phone}  ${o.category} ${o.packageName}  GHS ${o.totalAmount}`);
      console.log(`  payment=${o.paymentStatus}  delivery=${o.deliveryStatus}`);
      console.log(`  providerId=${JSON.stringify(o.providerId)}  providerReference=${JSON.stringify(o.providerReference)}`);
      console.log(`  queued=${JSON.stringify(o.metadata?.queuedForProvider)}  fulfilledAt=${JSON.stringify(o.metadata?.fulfilledAt)}`);
      console.log(`  providerResponse=${JSON.stringify(o.providerResponse)?.slice(0, 400)}`);
      console.log('');
    }
    await mongoose.disconnect();
    return;
  }

  if (process.argv.includes('--all')) {
    const paid = await Order.find({ ...window, paymentStatus: 'paid' })
      .sort({ createdAt: 1 })
      .select('phone packageName category quantity deliveryStatus createdAt')
      .lean();
    console.log(`--- ALL PAID ORDERS (${paid.length}) ---`);
    for (const o of paid) {
      const qty = (o.quantity || 1) > 1 ? ` x${o.quantity}` : '';
      console.log(`${o.phone} — ${o.packageName}${qty}`);
    }
    await mongoose.disconnect();
    return;
  }

  // Never reached a provider: queued, or no provider reference at all.
  const notSent = await Order.find({
    ...window,
    paymentStatus: 'paid',
    $or: [
      { 'metadata.queuedForProvider': true },
      { providerReference: { $in: [null, ''] } },
      { providerReference: { $exists: false } },
      // Mock fulfilment: marked delivered but never actually submitted to a provider.
      { providerReference: /^MOCK-/i },
      { 'providerResponse.mocked': true },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  console.log(`Orders created in window: ${totalAll}   (paid: ${totalPaid})`);

  const breakdown = await Order.aggregate([
    { $match: window },
    {
      $group: {
        _id: {
          paymentStatus: '$paymentStatus',
          deliveryStatus: '$deliveryStatus',
          serviceType: '$serviceType',
          // $ifNull is required: a missing field compares equal to null in aggregation.
          hasProviderRef: {
            $gt: [{ $strLenCP: { $ifNull: ['$providerReference', ''] } }, 0],
          },
          queued: { $eq: ['$metadata.queuedForProvider', true] },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  console.log('\n--- STATUS BREAKDOWN (all orders in window) ---');
  console.log(pad('PAYMENT', 10) + pad('DELIVERY', 14) + pad('SERVICE', 20) + pad('PROV_REF', 10) + pad('QUEUED', 8) + 'COUNT');
  for (const row of breakdown) {
    const k = row._id;
    console.log(
      pad(k.paymentStatus, 10) + pad(k.deliveryStatus, 14) + pad(k.serviceType, 20) +
      pad(k.hasProviderRef ? 'yes' : 'NO', 10) + pad(k.queued ? 'yes' : 'no', 8) + row.count
    );
  }

  console.log(`\nPAID but never sent to a provider API: ${notSent.length}\n`);

  if (notSent.length) {
    console.log(
      pad('CREATED (UTC)', 20) + pad('PHONE', 14) + pad('NETWORK', 12) +
      pad('PACKAGE', 26) + pad('QTY', 4) + pad('GHS', 8) +
      pad('DELIVERY', 12) + 'REASON'
    );
    console.log('-'.repeat(130));
    for (const o of notSent) {
      const reason = o.metadata?.queuedForProvider
        ? `queued: ${o.metadata?.queueReason || 'unknown'}`
        : o.failureReason || 'no provider reference';
      console.log(
        pad(new Date(o.createdAt).toISOString().slice(0, 16).replace('T', ' '), 20) +
        pad(o.phone, 14) + pad(o.category, 12) + pad(o.packageName, 26) +
        pad(o.quantity, 4) + pad(o.totalAmount, 8) + pad(o.deliveryStatus, 12) + reason
      );
    }

    console.log('\n--- RAW DETAIL (verifies why each was flagged) ---');
    for (const o of notSent) {
      console.log(
        `${o.reference}: providerReference=${JSON.stringify(o.providerReference)} ` +
        `providerId=${JSON.stringify(o.providerId)} ` +
        `queuedForProvider=${JSON.stringify(o.metadata?.queuedForProvider)} ` +
        `retryCount=${o.retryCount ?? 0} ` +
        `providerResponse=${JSON.stringify(o.providerResponse)?.slice(0, 300)}`
      );
    }

    const money = notSent.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    console.log(`\nTotal value affected: GHS ${money.toFixed(2)}`);

    console.log('\n--- PHONE NUMBERS ONLY ---');
    console.log([...new Set(notSent.map((o) => o.phone))].join('\n'));

    console.log('\n--- REFERENCES (for retry) ---');
    console.log(notSent.map((o) => o.reference).join(', '));

    console.log('\n--- BREAKDOWN BY NETWORK ---');
    const byNet = {};
    for (const o of notSent) byNet[o.category] = (byNet[o.category] || 0) + 1;
    for (const [k, v] of Object.entries(byNet)) console.log(`  ${k}: ${v}`);
  }

  // Sent to the API but still not delivered — separate problem, shown for context.
  const sentNotDelivered = await Order.countDocuments({
    ...window,
    paymentStatus: 'paid',
    providerReference: { $nin: [null, ''] },
    'metadata.queuedForProvider': { $ne: true },
    deliveryStatus: { $in: ['pending', 'processing', 'verification', 'failed'] },
  });
  console.log(`\n(For context: ${sentNotDelivered} paid orders DID reach the API but are not yet delivered.)`);

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('FAILED:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
