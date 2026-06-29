import { createServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import connectDB from './config/db.js';
import { createApp } from './app.js';
import { autoSeedIfEmpty } from './scripts/autoSeed.js';
import { retryQueuedProviderOrders } from './services/orderRetryService.js';

const QUEUED_ORDER_RETRY_MS = 3 * 60 * 1000;

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
});

export default app;
