import { createServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { validateProductionEnv } from './config/validateEnv.js';
import connectDB from './config/db.js';
import { createApp } from './app.js';
import { autoSeedIfEmpty } from './scripts/autoSeed.js';
import { migrateSiteSettingsOnBoot } from './services/siteSettingsService.js';
import { retryQueuedProviderOrders } from './services/orderRetryService.js';
import { syncOpenProviderOrders } from './services/orderProviderStatusService.js';
import { notifyStaleMtnPendingOrders } from './services/mtnPendingNoticeService.js';

const QUEUED_ORDER_RETRY_MS = 3 * 60 * 1000;
const PROVIDER_STATUS_SYNC_MS = 2 * 60 * 1000;
const MTN_PENDING_NOTICE_MS = 2 * 60 * 1000;

const io = new Server({
  cors: {
    origin: env.nodeEnv === 'production'
      ? env.clientUrl
      : (origin, cb) => cb(null, !origin || /^http:\/\/localhost:\d+$/.test(origin)),
    credentials: true,
  },
});

io.on('connection', (socket) => {
  socket.on('join:admin', () => socket.join('admin'));
  socket.on('join:packages', () => socket.join('packages'));
});

const app = createApp(io);
const server = createServer(app);
io.attach(server);

await connectDB();
validateProductionEnv();
await migrateSiteSettingsOnBoot();
await autoSeedIfEmpty();

server.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);

  setInterval(async () => {
    try {
      const summary = await retryQueuedProviderOrders(io);
      if (summary.delivered > 0) {
        console.log(`[ORDER_RETRY] Delivered ${summary.delivered} queued provider order(s).`);
      }
    } catch (err) {
      console.error('[ORDER_RETRY] Background retry failed:', err.message);
    }
  }, QUEUED_ORDER_RETRY_MS);

  setInterval(async () => {
    try {
      const summary = await syncOpenProviderOrders(io);
      if (summary.synced > 0 || summary.verificationEmails > 0) {
        console.log(
          `[PROVIDER_SYNC] checked=${summary.checked} synced=${summary.synced} verificationEmails=${summary.verificationEmails}`
        );
      }
    } catch (err) {
      console.error('[PROVIDER_SYNC] Background sync failed:', err.message);
    }
  }, PROVIDER_STATUS_SYNC_MS);

  setInterval(async () => {
    try {
      const summary = await notifyStaleMtnPendingOrders(io);
      if (summary.emailed > 0 || summary.sms > 0) {
        console.log(
          `[MTN_PENDING_NOTICE] emailed=${summary.emailed} sms=${summary.sms} errors=${summary.errors}`
        );
      }
    } catch (err) {
      console.error('[MTN_PENDING_NOTICE] Background job failed:', err.message);
    }
  }, MTN_PENDING_NOTICE_MS);
});

export default app;
