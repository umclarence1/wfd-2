import Order from '../models/Order.js';
import PromoCode from '../models/PromoCode.js';
import { fulfillOrder } from './orderService.js';
import { retryQueuedProviderOrders } from './orderRetryService.js';
import { redeemPromoCodeAtomic } from './promoService.js';
import {
  createOrderFromPendingPayment,
  findPendingPayment,
} from './pendingPaymentService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logSecurityEvent } from './securityLogger.js';
import { publishOrderUpdate } from './orderWebhookService.js';
import { isRealProviderReference } from '../utils/providerReference.js';

const AMOUNT_TOLERANCE = 0.02;

const validatePaidAmount = (amountPaid, expectedTotal, paymentReference) => {
  if (amountPaid == null || !Number.isFinite(Number(amountPaid))) {
    logSecurityEvent('payment_amount_missing', { paymentReference });
    throw new AppError('Payment amount missing.', 400);
  }

  if (Math.abs(Number(amountPaid) - Number(expectedTotal)) > AMOUNT_TOLERANCE) {
    logSecurityEvent('payment_amount_mismatch', {
      paymentReference,
      expected: expectedTotal,
      received: amountPaid,
    });
    throw new AppError('Payment amount mismatch.', 400);
  }
};

export const markOrderPaidFromPaystack = async ({
  paymentReference,
  paystackTransactionId,
  amountPaid,
  io,
}) => {
  let order = await Order.findOne({ paymentReference });
  let createdFromPending = false;

  if (order?.paymentStatus === 'paid') {
    logSecurityEvent('duplicate_payment_webhook', { paymentReference });
    if (
      order.deliveryStatus === 'failed'
      || order.deliveryStatus === 'pending'
      || order.metadata?.queuedForProvider
    ) {
      if (order.deliveryStatus === 'failed' || order.deliveryStatus === 'pending') {
        order.deliveryStatus = 'processing';
        await order.save();
      }
      try {
        await fulfillOrder(order._id, io);
      } catch (err) {
        console.error('[PAYMENT] Re-fulfillment failed:', order.reference, err.message);
      }
    }
    retryQueuedProviderOrders(io).catch(() => {});
    return { order, duplicate: true };
  }

  if (!order) {
    const pending = await findPendingPayment(paymentReference);
    if (!pending) {
      throw new AppError('Checkout not found or expired. Please try again.', 404);
    }
    validatePaidAmount(amountPaid, pending.totalAmount, paymentReference);
    order = await createOrderFromPendingPayment(pending, { paystackTransactionId });
    createdFromPending = true;
  } else {
    validatePaidAmount(amountPaid, order.totalAmount, paymentReference);
    order = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: 'paid' } },
      {
        paymentStatus: 'paid',
        deliveryStatus: 'processing',
        paystackTransactionId: paystackTransactionId?.toString(),
      },
      { new: true }
    );
  }

  if (!order) {
    const existing = await Order.findOne({ paymentReference });
    if (existing?.paymentStatus === 'paid') {
      return { order: existing, duplicate: true };
    }
    throw new AppError('Order not found for payment reference.', 404);
  }

  if (createdFromPending) {
    await publishOrderUpdate(order, {
      io,
      trigger: 'order.created',
      event: 'order.created',
      force: true,
    });
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

  try {
    await fulfillOrder(order._id, io);
  } catch (err) {
    console.error('[PAYMENT] Fulfillment error after Paystack payment:', order.reference, err.message);
  }

  // Second pass — cover race where first fulfill returned early.
  const afterFulfill = await Order.findById(order._id);
  if (
    afterFulfill?.paymentStatus === 'paid'
    && !isRealProviderReference(afterFulfill.providerReference, afterFulfill.reference)
    && afterFulfill.serviceType !== 'result_checker'
  ) {
    try {
      await fulfillOrder(afterFulfill._id, io);
    } catch (err) {
      console.error('[PAYMENT] Second fulfillment attempt failed:', afterFulfill.reference, err.message);
    }
  }

  retryQueuedProviderOrders(io).catch(() => {});

  const refreshed = await Order.findById(order._id);
  return { order: refreshed || order, duplicate: false };
};
