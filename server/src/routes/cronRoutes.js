import { Router } from 'express';
import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { cronAuth } from '../middleware/cronAuth.js';
import { retryQueuedProviderOrders } from '../services/orderRetryService.js';
import { syncOpenProviderOrders } from '../services/orderProviderStatusService.js';
import { runOrderFulfillmentRepair } from '../services/fixStuckOrdersService.js';
import { isRealProviderReference } from '../utils/providerReference.js';

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

/** Paid data/AFA orders from the last N days that never got a real TopDeals id. */
router.get(
  '/unsent-orders',
  asyncHandler(async (req, res) => {
    const days = Math.min(60, Math.max(1, Number(req.query.days) || 14));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const paid = await Order.find({
      paymentStatus: 'paid',
      serviceType: { $in: ['data_bundle', 'afa_registration'] },
      createdAt: { $gte: since },
    })
      .select('phone packageName category reference paymentReference deliveryStatus providerReference providerResponse metadata createdAt failureReason quantity')
      .sort({ createdAt: -1 })
      .lean();

    const gbOf = (o) => {
      const name = o.packageName || '';
      const m = name.match(/\d+(?:\.\d+)?\s*GB/i);
      return m ? m[0].toUpperCase() : (name || '—');
    };

    const orders = paid
      .filter((o) => {
        if (o.metadata?.topdealsOrderId) return false;
        if (o.providerResponse?.success === true || o.providerResponse?.alreadySubmitted === true) return false;
        if (o.providerResponse?.orderId) return false;
        if (isRealProviderReference(o.providerReference, o.reference)) return false;
        return true;
      })
      .map((o) => ({
        phone: o.phone || null,
        gb: gbOf(o),
        network: o.category || null,
        reference: o.reference,
        paymentReference: o.paymentReference || null,
        deliveryStatus: o.deliveryStatus,
        createdAt: o.createdAt,
        reason:
          o.metadata?.queueReason
          || o.metadata?.lastFulfillmentError
          || o.metadata?.lastProviderError
          || o.failureReason
          || (o.metadata?.manuallyFulfilled ? 'marked_delivered_locked' : null)
          || (o.metadata?.providerPurchaseAttemptedAt ? 'attempted_no_provider_id' : 'never_submitted'),
      }));

    res.json({
      success: true,
      days,
      count: orders.length,
      orders,
    });
  })
);

export default router;
