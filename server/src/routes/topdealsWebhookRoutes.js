import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { webhookLimiter } from '../middleware/rateLimit.js';
import {
  getTopDealsWebhookSecrets,
  verifyTopDealsWebhookSignature,
} from '../services/topdealsWebhookAuth.js';
import { applyTopDealsWebhook } from '../services/topdealsWebhookService.js';

const router = Router();

router.post(
  '/topdeals',
  webhookLimiter,
  asyncHandler(async (req, res) => {
    const secrets = await getTopDealsWebhookSecrets();
    if (!secrets.length) {
      console.error('[TOPDEALS_WEBHOOK] Secret not configured');
      return res.status(503).json({
        success: false,
        message: 'TopDealsGH webhook secret is not configured.',
      });
    }

    if (!verifyTopDealsWebhookSignature(req, secrets)) {
      console.warn('[TOPDEALS_WEBHOOK] Invalid signature', {
        event: req.headers['x-topdeals-event'],
        hasRawBody: Boolean(req.rawBody),
        bodyKeys: Object.keys(req.body || {}),
      });
      return res.status(401).json({ success: false, message: 'Invalid signature.' });
    }

    const payload = req.body || {};
    const result = await applyTopDealsWebhook(payload, req.app.get('io'));

    // Always 200 once signature is valid so TopDealsGH does not retry forever for unknown orders.
    res.status(200).json({
      success: true,
      event: payload.event || req.headers['x-topdeals-event'] || null,
      ...result,
    });
  })
);

/** Lightweight readiness check (no secrets exposed). */
router.get('/topdeals', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'TopDealsGH webhook endpoint is live. Use POST with X-TopDeals-Signature.',
  });
});

export default router;
