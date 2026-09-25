import { Router } from 'express';
import { verifyWebhookSignature } from '../services/paystackService.js';
import { markOrderPaidFromPaystack } from '../services/paymentProcessingService.js';

/** Paystack webhook — also mounted early in app.js (before API rate limiter). */
export const handlePaystackWebhook = async (req, res) => {
  if (!verifyWebhookSignature(req)) {
    console.error(
      '[PAYSTACK_WEBHOOK] Invalid signature for',
      req.headers['x-paystack-signature'] ? 'signed request' : 'unsigned request'
    );
    return res.status(401).json({ success: false, message: 'Invalid signature.' });
  }

  const event = req.body || {};
  const io = req.app.get('io');

  if (event.event === 'charge.success') {
    const reference = event.data?.reference;
    if (!reference) {
      console.error('[PAYSTACK_WEBHOOK] charge.success missing reference');
    } else if (event.data?.amount == null) {
      console.error('[PAYSTACK_WEBHOOK] charge.success missing amount:', reference);
    } else {
      try {
        await markOrderPaidFromPaystack({
          paymentReference: reference,
          paystackTransactionId: event.data?.id,
          amountPaid: event.data.amount / 100,
          io,
        });
      } catch (err) {
        console.error('[PAYSTACK_WEBHOOK] Failed to process payment:', reference, err.message);
      }
    }
  }

  if (!res.headersSent) res.sendStatus(200);
  return undefined;
};

const router = Router();
export default router;
