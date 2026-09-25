import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Package from '../models/Package.js';
import { getSiteSettings } from './siteSettingsService.js';
import { generateReference } from '../utils/reference.js';
import { validateNetworkPhone } from '../utils/validation.js';
import { checkoutPhoneBlockedMessage, isCheckoutPhoneBlocked } from '../utils/blockedCheckoutPhones.js';
import { generateCheckoutEmail } from '../utils/checkoutEmail.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculatePaystackCharge, calculateTotal } from '../services/paystackService.js';
import { validatePromoCode, redeemPromoCode, calculatePromoPrice } from '../services/promoService.js';
import { resolveCheckerInStock } from '../services/checkerService.js';
import { submitDataBundleOrder, submitAFARegistration } from '../services/providerService.js';
import { applyProviderFulfillment } from './providerFulfillment.js';
import {
  isApiForwardingEnabled,
  isTopDealsGhConfigured,
  getProviderCredentials,
} from './apiProviderService.js';
import { PROVIDER_IDS } from '../config/apiProviders.js';
import {
  resolveTopDealsGhPackageId,
  submitTopDealsGhCheckerPurchase,
} from './providers/topdealsghProvider.js';
import Checker from '../models/Checker.js';
import { QUEUE_REASONS, isWalletOrConfigQueueReason } from '../utils/providerQueue.js';
import {
  claimFulfillmentWithRetry,
  hasConfirmedProviderSubmission,
  isOrderSubmittedToProvider,
  markManualFulfillment,
  markOrderSubmittedToProvider,
  repairStaleProviderSubmission,
  releaseFulfillmentLock,
  shouldNeverResubmitToProvider,
} from '../utils/fulfillmentLock.js';
import { isRealProviderReference } from '../utils/providerReference.js';
import {
  sendOrderConfirmationEmail,
  sendCheckerDeliveryEmail,
} from '../services/emailService.js';
import { isCheckoutEmail } from '../utils/checkoutEmail.js';
import { sendCheckerDeliverySMS } from './smsService.js';
import { publishOrderUpdate } from './orderWebhookService.js';
import { fulfillPaidOrderImmediately } from './immediateFulfillmentService.js';
import {
  ensureFulfillmentIdempotencyKey,
  reconcileTopDealsOrderBeforePurchase,
} from './topdealsReconcileService.js';
import { appendFulfillmentEvent, FULFILLMENT_EVENTS, logFulfillmentEvent } from './fulfillmentAudit.js';

export const getFreshPackage = async (packageId) => {
  const pkg = await Package.findById(packageId);
  if (!pkg || !pkg.isActive) {
    throw new AppError('Package not found.', 404, 'PACKAGE_NOT_FOUND');
  }
  if (pkg.adminPaused) {
    throw new AppError('This package is currently unavailable. Please select another package.', 400, 'UNAVAILABLE');
  }
  if (pkg.serviceType === 'result_checker') {
    const settings = await getSiteSettings(true);
    if (settings?.checkersSalesEnabled !== true) {
      throw new AppError('Result checkers are currently out of stock.', 400, 'OUT_OF_STOCK');
    }
  }
  // Checkers use TopDealsGH live stock; other packages use local isAvailable.
  if (pkg.serviceType !== 'result_checker' && !pkg.isAvailable) {
    throw new AppError('This package is currently unavailable. Please select another package.', 400, 'UNAVAILABLE');
  }
  return pkg;
};

export const validateOrderInput = async (body, user) => {
  const { packageId, phone, promoCode, quantity: rawQty } = body;
  const quantity = Math.max(1, Math.min(5, Number(rawQty) || 1));

  const pkg = await getFreshPackage(packageId);

  if (pkg.serviceType === 'result_checker') {
    const settings = await getSiteSettings(true);
    if (settings?.checkersSalesEnabled !== true) {
      throw new AppError('Result checkers are currently out of stock.', 400, 'OUT_OF_STOCK');
    }
    const inStock = await resolveCheckerInStock(pkg.checkerType, quantity);
    if (!inStock) {
      throw new AppError('Result checkers are currently out of stock.', 400, 'OUT_OF_STOCK');
    }
  } else if (quantity !== 1) {
    throw new AppError('Quantity selection is only available for result checkers.', 400);
  }

  const phoneResult = validateNetworkPhone(phone, pkg.category);
  if (!phoneResult.valid) throw new AppError(phoneResult.error, 400);

  const checkoutEmail = generateCheckoutEmail(phoneResult.normalized);

  const unitPrice = pkg.price;

  let promoResult = null;
  if (promoCode) {
    const settings = await getSiteSettings(true);
    if (!settings?.promoCheckoutEnabled) {
      throw new AppError('Promo codes are not available at this time.', 400, 'PROMO_DISABLED');
    }

    promoResult = await validatePromoCode({
      code: promoCode,
      packageId,
      category: pkg.category,
      email: checkoutEmail,
      phone: phoneResult.normalized,
      userId: user?._id,
    });
  }

  const baseLine = unitPrice * quantity;
  const pricing = promoResult
    ? calculatePromoPrice(baseLine, promoResult)
    : { packagePrice: baseLine, promoDiscount: 0, finalPrice: baseLine, isFreeOrder: false };

  const paystackCharge = pricing.isFreeOrder ? 0 : calculatePaystackCharge(pricing.finalPrice);
  const totalAmount = pricing.isFreeOrder ? 0 : Math.round((pricing.finalPrice + paystackCharge) * 100) / 100;

  return {
    pkg,
    phone: phoneResult.normalized,
    email: checkoutEmail,
    promoResult,
    pricing,
    paystackCharge,
    totalAmount,
    quantity,
    unitPrice,
  };
};

export const createOrder = async (validated, user, idempotencyKey) => {
  const {
    pkg,
    phone,
    email,
    promoResult,
    pricing,
    paystackCharge,
    totalAmount,
    quantity = 1,
  } = validated;

  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey }).lean();
    if (existing) return existing;
  }

  const reference = generateReference('ORD');
  const paymentReference = generateReference('PAY');

  try {
    const order = await Order.create({
      reference,
      user: user?._id || null,
      email,
      phone,
      package: pkg._id,
      packageName: quantity > 1 ? `${pkg.name} × ${quantity}` : pkg.name,
      category: pkg.category,
      serviceType: pkg.serviceType,
      packagePrice: pricing.finalPrice,
      quantity,
      paystackCharge,
      totalAmount,
      promoCode: promoResult?.promo.code || null,
      promoDiscount: pricing.promoDiscount,
      isFreeOrder: pricing.isFreeOrder,
      paymentReference,
      idempotencyKey: idempotencyKey || undefined,
    });
    return order;
  } catch (err) {
    if (err.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey });
      if (existing) return existing;
    }
    throw err;
  }
};

const submitDataBundleWithPackageRetry = async (order, pkg) => {
  let providerResponse = await submitDataBundleOrder(order, pkg);
  if (
    providerResponse.success !== true
    && !providerResponse.alreadySubmitted
    && providerResponse.queueReason === 'package_unmatched'
  ) {
    try {
      const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
      const topdealsId = await resolveTopDealsGhPackageId(creds, pkg);
      if (topdealsId && topdealsId !== pkg.providerPackageId) {
        await Package.updateOne({ _id: pkg._id }, { $set: { providerPackageId: topdealsId } });
        pkg.providerPackageId = topdealsId;
        providerResponse = await submitDataBundleOrder(order, pkg);
      }
    } catch (err) {
      providerResponse = {
        ...providerResponse,
        message: err.message || providerResponse.message,
      };
    }
  }
  return providerResponse;
};

/** One TopDeals purchase per order. A second send happens only from admin Resubmit. */
const blockRepeatProviderPurchase = async (order, { adminResubmit = false } = {}) => {
  if (adminResubmit) return false;
  if (!order.metadata?.providerPurchaseAttemptedAt) return false;
  return true;
};

/** Provider HTTP calls must run outside MongoDB transactions (Atlas aborts long txns). */
const markSentOrderDelivered = async (order) => {
  if (!order || order.deliveryStatus === 'delivered') return order;
  const sent =
    hasConfirmedProviderSubmission(order)
    || isRealProviderReference(order.providerReference, order.reference)
    || order.providerResponse?.success === true
    || order.providerResponse?.alreadySubmitted === true;
  if (!sent) return null;
  order.deliveryStatus = 'delivered';
  markManualFulfillment(order);
  if (!isOrderSubmittedToProvider(order) && order.providerReference) {
    markOrderSubmittedToProvider(order, order.providerReference, order.providerId);
  }
  await order.save();
  return order;
};

export const fulfillOrder = async (orderId, io, { adminResubmit = false } = {}) => {
  const pre = await Order.findById(orderId);
  const alreadySent = await markSentOrderDelivered(pre);
  if (alreadySent) return alreadySent;
  if (pre && repairStaleProviderSubmission(pre)) {
    await pre.save();
  }

  const claimed = await claimFulfillmentWithRetry(orderId);
  if (!claimed) {
    return Order.findById(orderId);
  }

  try {
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus !== 'paid') return order;
    if (repairStaleProviderSubmission(order)) {
      await order.save();
    }
    if (shouldNeverResubmitToProvider(order)) {
      const delivered = await markSentOrderDelivered(order);
      return delivered || order;
    }

    if (isRealProviderReference(order.providerReference, order.reference)) {
      const delivered = await markSentOrderDelivered(order);
      return delivered || order;
    }

    const previousPaymentStatus = order.paymentStatus;
    const previousDeliveryStatus = order.deliveryStatus;

    order.deliveryStatus = 'processing';
    await order.save();

    const pkg = await Package.findById(order.package);
    if (!pkg) {
      order.metadata = {
        ...(order.metadata || {}),
        queuedForProvider: false,
        pendingProviderRetry: false,
        lastFulfillmentError: 'package_missing',
      };
      order.failureReason = 'Payment received — package record is missing, so the API was not called.';
      await order.save();
      await publishOrderUpdate(order, {
        io,
        trigger: 'fulfillment',
        previousPaymentStatus,
        previousDeliveryStatus,
      });
      return order;
    }

    if (order.serviceType === 'result_checker') {
      const qty = Math.max(1, Math.min(5, Number(order.quantity) || 1));

      if (!(await isApiForwardingEnabled()) || !(await isTopDealsGhConfigured())) {
        throw new AppError(
          'Result checkers are fulfilled via TopDealsGH. Configure API keys under Admin → API Providers.',
          503
        );
      }

      const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
      const purchased = [];
      const providerRefs = [];

      for (let i = 0; i < qty; i += 1) {
        const result = await submitTopDealsGhCheckerPurchase(creds, {
          type: String(pkg.checkerType || '').toLowerCase(),
          email: order.email,
          phone: order.phone,
        });

        if (result.queued) {
          const queueReason = result.queueReason || QUEUE_REASONS.INSUFFICIENT_BALANCE;
          const walletQueue = isWalletOrConfigQueueReason(queueReason);
          order.metadata = {
            ...(order.metadata || {}),
          queuedForProvider: false,
          queueReason: walletQueue ? queueReason : undefined,
          pendingProviderRetry: false,
          automaticRetryDisabled: true,
          providerId: PROVIDER_IDS.TOPDEALSGH,
        };
        order.failureReason = walletQueue
          ? result.message || 'TopDeals wallet is low. Use admin Resubmit after the wallet is funded.'
          : result.message || 'TopDeals did not accept the checker order. Use admin Resubmit to send it again.';
          await order.save();
          await publishOrderUpdate(order, {
            io,
            trigger: walletQueue ? 'fulfillment.queued' : 'fulfillment',
            previousPaymentStatus,
            previousDeliveryStatus,
          });
          return order;
        }

        if (!result.success || !result.serial || !result.pin) {
          throw new AppError(result.message || 'Checker purchase failed.', 502);
        }

        const created = await Checker.create({
          checkerType: pkg.checkerType,
          serialNumber: result.serial,
          pin: result.pin,
          status: 'used',
          order: order._id,
          year: String(new Date().getFullYear()),
          usedAt: new Date(),
        });
        purchased.push(created);
        if (result.orderId) providerRefs.push(result.orderId);
      }

      order.checker = purchased[0]._id;
      order.checkers = purchased.map((c) => c._id);
      order.deliveryStatus = 'delivered';
      order.providerReference = providerRefs.join(', ') || purchased.map((c) => c.serialNumber).join(', ');
      order.metadata = {
        ...(order.metadata || {}),
        queuedForProvider: false,
        submittedToProvider: true,
        submittedToProviderAt: new Date().toISOString(),
        providerId: PROVIDER_IDS.TOPDEALSGH,
        source: 'topdealsgh_agent_api',
      };

      await order.save();

      const checkerPayload = {
        checkerType: pkg.checkerType,
        checkers: purchased.map((c) => ({
          serialNumber: c.serialNumber,
          pin: c.pin,
        })),
        serialNumber: purchased[0].serialNumber,
        pin: purchased[0].pin,
        orderReference: order.reference,
      };

      const deliveryTasks = [sendCheckerDeliverySMS(order.phone, checkerPayload)];
      if (!isCheckoutEmail(order.email)) {
        deliveryTasks.push(sendCheckerDeliveryEmail(order.email, checkerPayload));
      }
      await Promise.allSettled(deliveryTasks);
    } else if (order.serviceType === 'data_bundle') {
      ensureFulfillmentIdempotencyKey(order);
      if (await blockRepeatProviderPurchase(order, { adminResubmit })) {
        return order;
      }

      const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
      const reconciled = await reconcileTopDealsOrderBeforePurchase(order, creds);
      if (reconciled.action === 'reconciled' || reconciled.action === 'already_submitted') {
        await order.save();
        return order;
      }

      order.metadata = {
        ...(order.metadata || {}),
        providerPurchaseAttemptedAt: new Date().toISOString(),
      };
      appendFulfillmentEvent(order, FULFILLMENT_EVENTS.PROVIDER_SUBMIT_START, {
        provider: PROVIDER_IDS.TOPDEALSGH,
      });
      logFulfillmentEvent(order.reference, FULFILLMENT_EVENTS.PROVIDER_SUBMIT_START, {
        provider: PROVIDER_IDS.TOPDEALSGH,
      });
      await order.save();

      const providerResponse = await submitDataBundleWithPackageRetry(order, pkg);
      const { shouldNotify } = applyProviderFulfillment(order, providerResponse, {
        successStatus: 'processing',
      });
      await order.save();
      if (shouldNotify && !isCheckoutEmail(order.email)) {
        await Promise.allSettled([sendOrderConfirmationEmail(order.email, order)]);
      }
    } else if (order.serviceType === 'afa_registration') {
      ensureFulfillmentIdempotencyKey(order);
      if (await blockRepeatProviderPurchase(order, { adminResubmit })) {
        return order;
      }
      const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
      const reconciled = await reconcileTopDealsOrderBeforePurchase(order, creds);
      if (reconciled.action === 'reconciled' || reconciled.action === 'already_submitted') {
        await order.save();
        return order;
      }
      order.metadata = {
        ...(order.metadata || {}),
        providerPurchaseAttemptedAt: new Date().toISOString(),
      };
      await order.save();

      const providerResponse = await submitAFARegistration(order, pkg);
      const { shouldNotify } = applyProviderFulfillment(order, providerResponse, {
        successStatus: 'processing',
      });
      await order.save();
      if (shouldNotify && !isCheckoutEmail(order.email)) {
        await sendOrderConfirmationEmail(order.email, order);
      }
    }

    if (io) io.emit('package:updated', { packageId: pkg._id.toString() });
    await publishOrderUpdate(order, {
      io,
      trigger: 'fulfillment',
      previousPaymentStatus,
      previousDeliveryStatus,
    });

    return order;
  } catch (err) {
    const order = await Order.findById(orderId);
    if (order && order.paymentStatus === 'paid' && !shouldNeverResubmitToProvider(order)) {
      order.deliveryStatus = 'processing';
      order.metadata = {
        ...(order.metadata || {}),
        queuedForProvider: false,
        pendingProviderRetry: false,
        automaticRetryDisabled: Boolean(order.metadata?.providerPurchaseAttemptedAt),
        lastFulfillmentError: err.message,
        lastFulfillmentAt: new Date().toISOString(),
      };
      order.failureReason = order.metadata?.providerPurchaseAttemptedAt
        ? 'TopDeals call did not confirm. It will not be sent again automatically. Resubmit only if TopDeals has no matching order.'
        : err.message || 'Payment received — the provider call did not start.';
      order.retryCount = (order.retryCount || 0) + 1;
      await order.save();
      await publishOrderUpdate(order, {
        io,
        trigger: 'fulfillment',
        previousDeliveryStatus: order.deliveryStatus,
      });
    }
    return order;
  } finally {
    await releaseFulfillmentLock(orderId);
  }
};

export const processFreeOrder = async (order, promoResult, user, io) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    order.paymentStatus = 'paid';
    order.isFreeOrder = true;
    await order.save({ session });

    if (promoResult) {
      await redeemPromoCode({
        promo: promoResult.promo,
        email: order.email,
        phone: order.phone,
        userId: user?._id,
        orderId: order._id,
        session,
      });
    }

    await session.commitTransaction();

    await publishOrderUpdate(order, {
      io,
      trigger: 'payment.paid',
      event: 'order.payment.paid',
      previousPaymentStatus: 'pending',
      previousDeliveryStatus: order.deliveryStatus,
    });

    await fulfillPaidOrderImmediately(order._id, io);
    return order;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const getPaymentBreakdown = (packagePrice, promoResult = null) => {
  const pricing = promoResult
    ? calculatePromoPrice(packagePrice, promoResult)
    : { finalPrice: packagePrice, isFreeOrder: false, promoDiscount: 0 };

  if (pricing.isFreeOrder || pricing.finalPrice === 0) {
    return {
      packagePrice,
      promoDiscount: pricing.promoDiscount,
      paystackCharge: 0,
      totalPayable: 0,
      isFreeOrder: true,
    };
  }

  const totals = calculateTotal(pricing.finalPrice);
  return {
    packagePrice,
    promoDiscount: pricing.promoDiscount,
    discountedPrice: pricing.finalPrice,
    paystackCharge: totals.paystackCharge,
    totalPayable: totals.totalAmount,
    isFreeOrder: false,
  };
};
