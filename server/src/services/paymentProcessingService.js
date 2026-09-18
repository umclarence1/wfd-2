import Order from '../models/Order.js';
import PromoCode from '../models/PromoCode.js';
import { fulfillPaidOrderImmediately } from './immediateFulfillmentService.js';
import { retryQueuedProviderOrders } from './orderRetryService.js';
import { redeemPromoCodeAtomic } from './promoService.js';
import {
  createOrderFromPendingPayment,
  findPendingPayment,
} from './pendingPaymentService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logSecurityEvent } from './securityLogger.js';
import { publishOrderUpdate } from './orderWebhookService.js';
import {
  isOrderSubmittedToProvider,
  shouldNeverResubmitToProvider,
} from '../utils/fulfillmentLock.js';

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
    // Only retry fulfillment if never submitted to the provider — avoids duplicate API orders.
    if (!shouldNeverResubmitToProvider(order)) {
      if (order.deliveryStatus === 'failed' || order.deliveryStatus === 'pending') {
        order.deliveryStatus = 'processing';
        await order.save();
      }
      try {
        order = (await fulfillPaidOrderImmediately(order._id, io)) || order;
      } catch (err) {
        console.error('[PAYMENT] Re-fulfillment failed:', order.reference, err.message);
      }
      if (order && !isOrderSubmittedToProvider(order) && order.serviceType !== 'result_checker') {
        retryQueuedProviderOrders(io).catch(() => {});
      }
    }
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
  try {
    refreshed = (await fulfillPaidOrderImmediately(order._id, io)) || order;
  } catch (err) {
    console.error('[PAYMENT] Immediate fulfillment error:', order.reference, err.message);
    refreshed = await Order.findById(order._id);
  }

  if (refreshed && !isOrderSubmittedToProvider(refreshed) && refreshed.serviceType !== 'result_checker') {
    if (!refreshed.metadata?.queuedForProvider) {
      refreshed.metadata = {
        ...(refreshed.metadata || {}),
        queuedForProvider: true,
        queueReason: refreshed.metadata?.queueReason || 'awaiting_provider_submit',
      };
      await refreshed.save();
    }
    retryQueuedProviderOrders(io).catch(() => {});
  }

  return { order: refreshed || order, duplicate: false };
};
