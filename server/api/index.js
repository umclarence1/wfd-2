import connectDB from '../src/config/db.js';
import { validateProductionEnv } from '../src/config/validateEnv.js';
import { createApp } from '../src/app.js';
import { autoSeedIfEmpty } from '../src/scripts/autoSeed.js';
import { purgeAllOrders, purgeAllCheckers } from '../src/services/orderPurgeService.js';

let app;
let readyPromise;

const bootstrap = async () => {
  await connectDB();
  validateProductionEnv();
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
