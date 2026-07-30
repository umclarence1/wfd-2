import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyWebhookSignature } from '../services/paystackService.js';
import { markOrderPaidFromPaystack } from '../services/paymentProcessingService.js';
import { webhookLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post(
  '/webhook',
  webhookLimiter,
  asyncHandler(async (req, res) => {
    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ success: false, message: 'Invalid signature.' });
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const reference = event.data?.reference;
      if (!reference) {
        return res.status(400).json({ success: false, message: 'Missing payment reference.' });
      }
      if (event.data?.amount == null) {
        return res.status(400).json({ success: false, message: 'Missing payment amount.' });
      }
      const amountPaid = event.data.amount / 100;

      await markOrderPaidFromPaystack({
        paymentReference: reference,
        paystackTransactionId: event.data?.id,
        amountPaid,
        io: req.app.get('io'),
      });
    }

    res.sendStatus(200);
  })
);

export default router;
