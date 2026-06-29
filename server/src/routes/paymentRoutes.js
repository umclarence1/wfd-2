import { Router } from 'express';
import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyWebhookSignature } from '../services/paystackService.js';
import { fulfillOrder } from '../services/orderService.js';
import { redeemPromoCode } from '../services/promoService.js';
import PromoCode from '../models/PromoCode.js';

const router = Router();

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ success: false, message: 'Invalid signature.' });
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const order = await Order.findOne({ paymentReference: reference });

      if (order && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.paystackTransactionId = event.data.id?.toString();
        await order.save();

        if (order.promoCode) {
          const promo = await PromoCode.findOne({ code: order.promoCode });
          if (promo) {
            await redeemPromoCode({
              promo,
              email: order.email,
              phone: order.phone,
              userId: order.user,
              orderId: order._id,
            });
          }
        }

        await fulfillOrder(order._id, req.app.get('io'));
      }
    }

    res.sendStatus(200);
  })
);

export default router;
