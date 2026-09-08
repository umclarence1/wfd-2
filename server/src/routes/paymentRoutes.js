import { Router } from 'express';
import { verifyWebhookSignature } from '../services/paystackService.js';
import { markOrderPaidFromPaystack } from '../services/paymentProcessingService.js';

/** Paystack webhook — also mounted early in app.js (before API rate limiter). */
export const handlePaystackWebhook = (req, res) => {
  if (!verifyWebhookSignature(req)) {
    console.error(
      '[PAYSTACK_WEBHOOK] Invalid signature for',
      req.headers['x-paystack-signature'] ? 'signed request' : 'unsigned request'
    );
    return res.status(401).json({ success: false, message: 'Invalid signature.' });
  }

  const event = req.body || {};
  const io = req.app.get('io');

  res.sendStatus(200);

  if (event.event !== 'charge.success') {
    return undefined;
  }

  const reference = event.data?.reference;
  if (!reference) {
    console.error('[PAYSTACK_WEBHOOK] charge.success missing reference');
    return undefined;
  }
  if (event.data?.amount == null) {
    console.error('[PAYSTACK_WEBHOOK] charge.success missing amount:', reference);
    return undefined;
  }

  const amountPaid = event.data.amount / 100;

  markOrderPaidFromPaystack({
    paymentReference: reference,
    paystackTransactionId: event.data?.id,
    amountPaid,
    io,
  }).catch((err) => {
    console.error('[PAYSTACK_WEBHOOK] Failed to process payment:', reference, err.message);
  });

  return undefined;
};

const router = Router();
export default router;
