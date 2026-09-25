import { createServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { validateProductionEnv } from './config/validateEnv.js';
import connectDB from './config/db.js';
import { createApp } from './app.js';
import { autoSeedIfEmpty } from './scripts/autoSeed.js';
import { migrateSiteSettingsOnBoot } from './services/siteSettingsService.js';
import { notifyStaleMtnPendingOrders } from './services/mtnPendingNoticeService.js';

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
      const summary = await notifyStaleMtnPendingOrders(io);
      if (summary.emailed > 0) {
        console.log(
          `[MTN_PENDING_NOTICE] emailed=${summary.emailed} errors=${summary.errors}`
        );
      }
    } catch (err) {
      console.error('[MTN_PENDING_NOTICE] Background job failed:', err.message);
    }
  }, MTN_PENDING_NOTICE_MS);
});

export default app;
