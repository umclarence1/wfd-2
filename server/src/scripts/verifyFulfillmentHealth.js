import dotenv from 'dotenv';
import dns from 'dns/promises';
import mongoose from 'mongoose';
import { isTopDealsGhConfigured, getProviderCredentials } from '../services/apiProviderService.js';
import { testTopDealsGhConnection } from '../services/providers/topdealsghProvider.js';
import { PROVIDER_IDS } from '../config/apiProviders.js';
import { isOrderSubmittedToProvider } from '../utils/fulfillmentLock.js';
import Package from '../models/Package.js';
import Order from '../models/Order.js';

dotenv.config();

const buildDirectUri = async (srvUri) => {
  const match = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
  if (!match) return srvUri;
  const [, user, pass, host, dbName] = match;
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  const records = await dns.resolveSrv(`_mongodb._tcp.${host}`);
  const hosts = records.map((r) => `${r.name}:${r.port}`).join(',');
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hosts}/${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;
};

const main = async () => {
  const report = { ok: true, checks: [], issues: [] };

  const add = (name, pass, detail) => {
    report.checks.push({ name, pass, detail });
    if (!pass) {
      report.ok = false;
      report.issues.push(`${name}: ${detail}`);
    }
  };

  try {
    const uri = process.env.MONGODB_URI?.startsWith('mongodb+srv://')
      ? await buildDirectUri(process.env.MONGODB_URI)
      : process.env.MONGODB_URI;
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    add('mongodb', true, 'Connected');
  } catch (err) {
    add('mongodb', false, err.message);
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const topdealsOk = await isTopDealsGhConfigured();
  add('topdeals_credentials', topdealsOk, topdealsOk ? 'API key + secret set' : 'Missing credentials');

  if (topdealsOk) {
    const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
    const conn = await testTopDealsGhConnection(creds);
    add('topdeals_api', conn.success === true, conn.message);
  }

  const activePackages = await Package.find({
    serviceType: 'data_bundle',
    isActive: true,
    adminPaused: { $ne: true },
  }).select('name category dataAmount providerPackageId').lean();

  const withoutId = activePackages.filter((p) => !p.providerPackageId);
  add(
    'package_ids',
    withoutId.length === 0,
    `${activePackages.length - withoutId.length}/${activePackages.length} data packages mapped to TopDeals`
  );

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentPaid = await Order.find({
    paymentStatus: 'paid',
    serviceType: { $in: ['data_bundle', 'afa_registration'] },
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const notSubmitted = recentPaid.filter((o) => !isOrderSubmittedToProvider(o));
  const submitted = recentPaid.length - notSubmitted.length;

  add(
    'recent_orders_7d',
    notSubmitted.length === 0,
    `${submitted}/${recentPaid.length} recent data/AFA orders submitted to TopDeals; ${notSubmitted.length} still pending`
  );

  if (notSubmitted.length) {
    report.stuckOrders = notSubmitted.slice(0, 10).map((o) => ({
      reference: o.reference,
      category: o.category,
      createdAt: o.createdAt,
      queueReason: o.metadata?.queueReason,
      queued: o.metadata?.queuedForProvider,
      error: o.metadata?.lastProviderError || o.metadata?.lastFulfillmentError,
    }));
  }

  const queuedCount = await Order.countDocuments({
    paymentStatus: 'paid',
    'metadata.queuedForProvider': true,
    'metadata.submittedToProvider': { $ne: true },
    serviceType: { $in: ['data_bundle', 'afa_registration'] },
  });
  add('queued_now', queuedCount === 0, `${queuedCount} order(s) waiting in queue`);

  await mongoose.disconnect();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
