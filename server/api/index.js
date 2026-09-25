import connectDB from '../src/config/db.js';
import { validateProductionEnv } from '../src/config/validateEnv.js';
import { createApp } from '../src/app.js';
import { autoSeedIfEmpty } from '../src/scripts/autoSeed.js';
import { migrateSiteSettingsOnBoot } from '../src/services/siteSettingsService.js';
import { syncOpenProviderOrders } from '../src/services/orderProviderStatusService.js';
import { notifyStaleMtnPendingOrders } from '../src/services/mtnPendingNoticeService.js';
import { syncCheckerPackageAvailability } from '../src/services/checkerService.js';
import { syncTopDealsPackageIds } from '../src/services/topdealsPackageSyncService.js';

const BACKGROUND_JOB_MS = 60 * 1000;
let lastBackgroundJob = 0;

const maybeRunBackgroundJobs = () => {
  const now = Date.now();
  if (now - lastBackgroundJob < BACKGROUND_JOB_MS) return;
  lastBackgroundJob = now;
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
let deferredBootstrapStarted = false;

/** Heavy boot work — must not block checkout / Paystack on serverless cold starts. */
const runDeferredBootstrap = () => {
  if (deferredBootstrapStarted) return;
  deferredBootstrapStarted = true;

  (async () => {
    try {
      await syncTopDealsPackageIds();
    } catch (err) {
      console.error('[TOPDEALS_PKG_SYNC] Deferred sync failed:', err.message);
    }

    try {
      await autoSeedIfEmpty();
    } catch (err) {
      console.error('[AUTO_SEED] Deferred boot failed:', err.message);
    }

    try {
      await syncCheckerPackageAvailability();
    } catch (err) {
      console.error('[CHECKER_STOCK] Deferred sync failed:', err.message);
    }
  })().catch((err) => {
    console.error('[BOOT] Deferred bootstrap failed:', err.message);
  });
};

const bootstrap = async () => {
  await connectDB();
  validateProductionEnv();
  await migrateSiteSettingsOnBoot();

  // Destructive wipe flags are CLI-only — never run on serverless boot.
  if (process.env.CLEAR_ALL_ORDERS === 'true' || process.env.CLEAR_ALL_CHECKERS === 'true') {
    console.warn(
      '[PURGE] CLEAR_ALL_ORDERS / CLEAR_ALL_CHECKERS are ignored in the API bootstrap. Use a one-shot admin action or CLI script instead.'
    );
  }

  app = createApp();
  runDeferredBootstrap();
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
    const expressApp = await getApp();
    // Must run after bootstrap — these hit Mongo and fail on a cold start otherwise.
    maybeRunBackgroundJobs();
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
