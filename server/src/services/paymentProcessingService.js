import Order from '../models/Order.js';
import PromoCode from '../models/PromoCode.js';
import { fulfillOrder } from './orderService.js';
import { retryQueuedProviderOrders } from './orderRetryService.js';
import { redeemPromoCodeAtomic } from './promoService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logSecurityEvent } from './securityLogger.js';
import { publishOrderUpdate } from './orderWebhookService.js';

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
    const previousPaymentStatus = order.paymentStatus;
    order.paymentStatus = 'failed';
    order.failureReason = 'Payment amount missing';
    await order.save();
    await publishOrderUpdate(order, {
      io,
      trigger: 'payment.failed',
      event: 'order.payment.failed',
      previousPaymentStatus,
    });
    logSecurityEvent('payment_amount_missing', { paymentReference });
    throw new AppError('Payment amount missing.', 400);
  }

  if (Math.abs(Number(amountPaid) - order.totalAmount) > 0.01) {
    const previousPaymentStatus = order.paymentStatus;
    order.paymentStatus = 'failed';
    order.failureReason = 'Payment amount mismatch';
    await order.save();
    await publishOrderUpdate(order, {
      io,
      trigger: 'payment.failed',
      event: 'order.payment.failed',
      previousPaymentStatus,
    });
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

  await publishOrderUpdate(order, {
    io,
    trigger: 'payment.paid',
    event: 'order.payment.paid',
    previousPaymentStatus: 'pending',
    previousDeliveryStatus: order.deliveryStatus,
  });

  await fulfillOrder(order._id, io);
  retryQueuedProviderOrders(io).catch(() => {});
  return { order, duplicate: false };
};
