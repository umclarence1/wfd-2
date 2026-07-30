import Order from '../models/Order.js';
import PromoCode from '../models/PromoCode.js';
import { fulfillOrder } from './orderService.js';
import { retryQueuedProviderOrders } from './orderRetryService.js';
import { redeemPromoCodeAtomic } from './promoService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logSecurityEvent } from './securityLogger.js';

export const markOrderPaidFromPaystack = async ({
  paymentReference,
  paystackTransactionId,
  amountPaid,
  io,
}) => {
  const order = await Order.findOneAndUpdate(
    { paymentReference, paymentStatus: { $ne: 'paid' } },
    {
      paymentStatus: 'paid',
      paystackTransactionId: paystackTransactionId?.toString(),
    },
    { new: true }
  );

  if (!order) {
    const existing = await Order.findOne({ paymentReference });
    if (existing?.paymentStatus === 'paid') {
      logSecurityEvent('duplicate_payment_webhook', { paymentReference });
      return { order: existing, duplicate: true };
    }
    throw new AppError('Order not found for payment reference.', 404);
  }

  if (amountPaid == null || !Number.isFinite(Number(amountPaid))) {
    order.paymentStatus = 'failed';
    order.failureReason = 'Payment amount missing';
    await order.save();
    logSecurityEvent('payment_amount_missing', { paymentReference });
    throw new AppError('Payment amount missing.', 400);
  }

  if (Math.abs(Number(amountPaid) - order.totalAmount) > 0.01) {
    order.paymentStatus = 'failed';
    order.failureReason = 'Payment amount mismatch';
    await order.save();
    logSecurityEvent('payment_amount_mismatch', {
      paymentReference,
      expected: order.totalAmount,
      received: amountPaid,
    });
    throw new AppError('Payment amount mismatch.', 400);
  }

  if (order.promoCode) {
    const promo = await PromoCode.findOne({ code: order.promoCode, isActive: true });
    if (promo) {
      await redeemPromoCodeAtomic({
        promo,
        email: order.email,
        phone: order.phone,
        userId: order.user,
        orderId: order._id,
      });
    }
  }

  await fulfillOrder(order._id, io);
  retryQueuedProviderOrders(io).catch(() => {});
  return { order, duplicate: false };
};
