import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Package from '../models/Package.js';
import { getSiteSettings } from './siteSettingsService.js';
import { generateReference } from '../utils/reference.js';
import { validateNetworkPhone, validateGhanaCard, validateEmail } from '../utils/validation.js';
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
import { submitTopDealsGhCheckerPurchase } from './providers/topdealsghProvider.js';
import Checker from '../models/Checker.js';
import { QUEUE_REASONS } from '../utils/providerQueue.js';
import {
  sendOrderConfirmationEmail,
} from '../services/emailService.js';

export const getFreshPackage = async (packageId) => {
  const pkg = await Package.findById(packageId);
  if (!pkg || !pkg.isActive) {
    throw new AppError('Package not found.', 404, 'PACKAGE_NOT_FOUND');
  }
  if (pkg.adminPaused) {
    throw new AppError('This package is currently unavailable. Please select another package.', 400, 'UNAVAILABLE');
  }
  // Checkers use TopDealsGH live stock; other packages use local isAvailable.
  if (pkg.serviceType !== 'result_checker' && !pkg.isAvailable) {
    throw new AppError('This package is currently unavailable. Please select another package.', 400, 'UNAVAILABLE');
  }
  return pkg;
};

export const validateOrderInput = async (body, user) => {
  const { packageId, phone, email, promoCode, afaDetails, quantity: rawQty } = body;
  const quantity = Math.max(1, Math.min(5, Number(rawQty) || 1));

  const emailResult = validateEmail(email);
  if (!emailResult.valid) throw new AppError(emailResult.error, 400);

  const pkg = await getFreshPackage(packageId);

  if (pkg.serviceType === 'result_checker') {
    const inStock = await resolveCheckerInStock(pkg.checkerType, quantity);
    if (!inStock) {
      throw new AppError(
        `Only a limited number of checkers are left. Please choose quantity 1–5 based on stock.`,
        400,
        'OUT_OF_STOCK'
      );
    }
  } else if (quantity !== 1) {
    throw new AppError('Quantity selection is only available for result checkers.', 400);
  }

  const phoneResult = validateNetworkPhone(phone, pkg.category);
  if (!phoneResult.valid) throw new AppError(phoneResult.error, 400);

  if (pkg.serviceType === 'afa_registration') {
    if (!afaDetails?.fullName || afaDetails.fullName.trim().length < 3) {
      throw new AppError('Full name must be at least 3 characters.', 400);
    }
    const cardResult = validateGhanaCard(afaDetails.ghanaCard);
    if (!cardResult.valid) throw new AppError(cardResult.error, 400);
    if (!afaDetails.location?.trim()) throw new AppError('Location is required.', 400);
  }

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
      email,
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
    email: emailResult.normalized,
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
    afaDetails,
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
      afaDetails: pkg.serviceType === 'afa_registration' ? afaDetails : undefined,
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

export const fulfillOrder = async (orderId, io) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order || order.paymentStatus !== 'paid') {
      await session.abortTransaction();
      return;
    }

    if (
      order.deliveryStatus === 'delivered'
      || (order.deliveryStatus === 'processing' && !order.metadata?.queuedForProvider)
      || (order.providerReference && !order.metadata?.queuedForProvider)
    ) {
      await session.abortTransaction();
      return order;
    }

    const isMtnData =
      order.serviceType === 'data_bundle' &&
      String(order.category || '').toUpperCase() === 'MTN';

    // MTN data stays pending until delivered/failed so the 1h30m notice can fire.
    order.deliveryStatus = isMtnData ? 'pending' : 'processing';
    await order.save({ session });

    const pkg = await Package.findById(order.package).session(session);
    if (!pkg || !pkg.isActive || pkg.adminPaused) {
      order.deliveryStatus = 'failed';
      order.failureReason = 'Package no longer available';
      await order.save({ session });
      await session.commitTransaction();
      return order;
    }
    if (pkg.serviceType !== 'result_checker' && !pkg.isAvailable) {
      order.deliveryStatus = 'failed';
      order.failureReason = 'Package no longer available';
      await order.save({ session });
      await session.commitTransaction();
      return order;
    }

    let providerResponse;

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
          order.deliveryStatus = 'processing';
          order.metadata = {
            ...(order.metadata || {}),
            queuedForProvider: true,
            queueReason: result.queueReason || QUEUE_REASONS.INSUFFICIENT_BALANCE,
            providerId: PROVIDER_IDS.TOPDEALSGH,
          };
          order.failureReason = result.message || 'Queued for TopDealsGH retry.';
          await order.save({ session });
          await session.commitTransaction();
          if (io) io.emit('order:updated', { reference: order.reference, deliveryStatus: order.deliveryStatus });
          return order;
        }

        if (!result.success || !result.serial || !result.pin) {
          throw new AppError(result.message || 'Checker purchase failed.', 502);
        }

        const [created] = await Checker.create(
          [
            {
              checkerType: pkg.checkerType,
              serialNumber: result.serial,
              pin: result.pin,
              status: 'used',
              order: order._id,
              year: String(new Date().getFullYear()),
              usedAt: new Date(),
            },
          ],
          { session }
        );
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
        providerId: PROVIDER_IDS.TOPDEALSGH,
        source: 'topdealsgh_agent_api',
        // TopDealsGH delivers serial/PIN to the customer; we do not SMS/email checkers.
      };

      await order.save({ session });
      await session.commitTransaction();
    } else if (order.serviceType === 'data_bundle') {
      providerResponse = await submitDataBundleOrder(order, pkg);
      const isMtn =
        String(order.category || '').toUpperCase() === 'MTN';
      const { shouldNotify } = applyProviderFulfillment(order, providerResponse, {
        // MTN stays pending until TopDeals marks delivered/failed (1h30m notice uses pending).
        successStatus: isMtn ? 'pending' : 'processing',
      });

      await order.save({ session });
      await session.commitTransaction();

      // Confirmation email only — no purchase SMS (SMS is costly per recipient).
      if (shouldNotify) {
        await Promise.allSettled([sendOrderConfirmationEmail(order.email, order)]);
      }
    } else if (order.serviceType === 'afa_registration') {
      providerResponse = await submitAFARegistration(order, pkg);
      const { shouldNotify } = applyProviderFulfillment(order, providerResponse, {
        successStatus: 'processing',
      });

      await order.save({ session });
      await session.commitTransaction();

      if (shouldNotify) {
        await sendOrderConfirmationEmail(order.email, order);
      }
    }

    if (io) io.emit('order:updated', { reference: order.reference, deliveryStatus: order.deliveryStatus });
    if (io) io.emit('package:updated', { packageId: pkg._id.toString() });

    return order;
  } catch (err) {
    await session.abortTransaction();
    const order = await Order.findById(orderId);
    if (order) {
      order.deliveryStatus = 'failed';
      order.failureReason = 'We could not complete your order. Please try again or contact support.';
      await order.save();
    }
    throw err;
  } finally {
    session.endSession();
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
    await fulfillOrder(order._id, io);
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
