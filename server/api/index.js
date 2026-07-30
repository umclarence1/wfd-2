import connectDB from '../src/config/db.js';
import { validateProductionEnv } from '../src/config/validateEnv.js';
import { createApp } from '../src/app.js';
import { autoSeedIfEmpty } from '../src/scripts/autoSeed.js';
import { migrateSiteSettingsOnBoot } from '../src/services/siteSettingsService.js';
import { purgeAllOrders, purgeAllCheckers } from '../src/services/orderPurgeService.js';
import { retryQueuedProviderOrders } from '../src/services/orderRetryService.js';
import { syncOpenProviderOrders } from '../src/services/orderProviderStatusService.js';
import { notifyStaleMtnPendingOrders } from '../src/services/mtnPendingNoticeService.js';
import { syncCheckerPackageAvailability } from '../src/services/checkerService.js';

const BACKGROUND_JOB_MS = 90 * 1000;
let lastBackgroundJob = 0;

const maybeRunBackgroundJobs = () => {
  const now = Date.now();
  if (now - lastBackgroundJob < BACKGROUND_JOB_MS) return;
  lastBackgroundJob = now;
  retryQueuedProviderOrders(null).catch((err) => {
    console.error('[ORDER_RETRY] Background retry failed:', err.message);
  });
  syncOpenProviderOrders(null).catch((err) => {
    console.error('[PROVIDER_SYNC] Background sync failed:', err.message);
  });
  notifyStaleMtnPendingOrders(null).catch((err) => {
    console.error('[MTN_PENDING_NOTICE] Background job failed:', err.message);
  });
  syncCheckerPackageAvailability().catch((err) => {
    console.error('[CHECKER_STOCK] Sync failed:', err.message);
  });
};

let app;
let readyPromise;

const bootstrap = async () => {
  await connectDB();
  validateProductionEnv();
  await migrateSiteSettingsOnBoot();
  await autoSeedIfEmpty();

  if (process.env.CLEAR_ALL_ORDERS === 'true') {
    const result = await purgeAllOrders();
    console.log('[PURGE] All orders cleared:', result);
  }

  if (process.env.CLEAR_ALL_CHECKERS === 'true') {
    const result = await purgeAllCheckers();
    console.log('[PURGE] All checkers cleared:', result);
  }

  app = createApp();
  return app;
};

const getApp = () => {
  if (!readyPromise) {
    readyPromise = bootstrap();
  }
  return readyPromise;
};

export default async (req, res) => {
  try {
    maybeRunBackgroundJobs();
    const expressApp = await getApp();
    return expressApp(req, res);
  } catch (err) {
    console.error('[API] Bootstrap failed:', err);
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: err.message || 'API failed to start.',
        hint: 'Check MONGODB_URI and Atlas network access (0.0.0.0/0).',
      });
    }
  }
};
