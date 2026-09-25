import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { cronAuth } from '../middleware/cronAuth.js';
import { retryQueuedProviderOrders } from '../services/orderRetryService.js';
import { syncOpenProviderOrders } from '../services/orderProviderStatusService.js';
import { runOrderFulfillmentRepair } from '../services/fixStuckOrdersService.js';

const router = Router();

router.use(cronAuth);

router.get(
  '/retry-orders',
  asyncHandler(async (req, res) => {
    const summary = await retryQueuedProviderOrders(req.app.get('io'));
    res.json({ success: true, ...summary });
  })
);

router.get(
  '/sync-provider-orders',
  asyncHandler(async (req, res) => {
    const summary = await syncOpenProviderOrders(req.app.get('io'));
    res.json({ success: true, ...summary });
  })
);

router.get(
  '/fix-stuck-orders',
  asyncHandler(async (req, res) => {
    const summary = await runOrderFulfillmentRepair(req.app.get('io'), { submit: false });
    res.json({ success: true, ...summary });
  })
);

export default router;
