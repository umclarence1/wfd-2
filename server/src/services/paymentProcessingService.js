import Order from '../models/Order.js';
import PromoCode from '../models/PromoCode.js';
import { fulfillPaidOrderImmediately } from './immediateFulfillmentService.js';
import { redeemPromoCodeAtomic } from './promoService.js';
import {
  createOrderFromPendingPayment,
  findPendingPayment,
} from './pendingPaymentService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logSecurityEvent } from './securityLogger.js';
import { FULFILLMENT_EVENTS, logFulfillmentEvent } from './fulfillmentAudit.js';
import { publishOrderUpdate } from './orderWebhookService.js';
import ProcessedWebhook from '../models/ProcessedWebhook.js';
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
  fulfill = true,
}) => {
  let order = await Order.findOne({ paymentReference });
  let createdFromPending = false;

  try {
    await ProcessedWebhook.create({
      reference: paymentReference,
      event: 'charge.success',
      status: 'processing',
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const existing = await Order.findOne({ paymentReference });
      if (existing?.paymentStatus === 'paid') {
        logFulfillmentEvent(existing.reference, FULFILLMENT_EVENTS.DUPLICATE_PAYMENT_IGNORED, {
          paymentReference,
        });
        return { order: existing, duplicate: true };
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const pending = await findPendingPayment(paymentReference, { allowExpired: true });
    if (!pending) {
      const existing = await Order.findOne({ paymentReference });
      return { order: existing, duplicate: true };
    }
  }

  if (order?.paymentStatus === 'paid') {
    logSecurityEvent('duplicate_payment_webhook', { paymentReference });
    logFulfillmentEvent(order.reference, FULFILLMENT_EVENTS.DUPLICATE_PAYMENT_IGNORED, {
      paymentReference,
    });
    return { order, duplicate: true };
  }

  if (order && order.paymentStatus !== 'paid') {
    logSecurityEvent('legacy_unpaid_order_on_payment', { paymentReference, orderId: order._id });
    await Order.deleteOne({ _id: order._id, paymentStatus: { $ne: 'paid' } });
    order = null;
  }

  const pending = await findPendingPayment(paymentReference, { allowExpired: true });
  if (!pending) {
    throw new AppError('Checkout not found. Payment received — contact support with your payment reference.', 404);
  }
  validatePaidAmount(amountPaid, pending.totalAmount, paymentReference);
  order = await createOrderFromPendingPayment(pending, { paystackTransactionId });
  createdFromPending = true;

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

  let refreshed = order;
  if (fulfill) {
    try {
      refreshed = (await fulfillPaidOrderImmediately(order._id, io)) || order;
    } catch (err) {
      console.error('[PAYMENT] Immediate fulfillment error:', order.reference, err.message);
      refreshed = await Order.findById(order._id);
    }
  }

  return { order: refreshed || order, duplicate: false };
};
