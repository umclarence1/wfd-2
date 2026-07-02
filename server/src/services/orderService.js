import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Package from '../models/Package.js';
import SiteSettings from '../models/SiteSettings.js';
import { generateReference } from '../utils/reference.js';
import { validateNetworkPhone, validateGhanaCard, validateEmail } from '../utils/validation.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculatePaystackCharge, calculateTotal } from '../services/paystackService.js';
import { validatePromoCode, redeemPromoCode, calculatePromoPrice } from '../services/promoService.js';
import { assignChecker, checkStock, syncCheckerPackageAvailability } from '../services/checkerService.js';
import { submitDataBundleOrder, submitAFARegistration } from '../services/providerService.js';
import { applyProviderFulfillment } from './providerFulfillment.js';
import {
  sendCheckerDeliveryEmail,
  sendOrderConfirmationEmail,
} from '../services/emailService.js';
import {
  sendCheckerDeliverySMS,
  sendOrderConfirmationSMS,
} from '../services/smsService.js';

export const getFreshPackage = async (packageId) => {
  const pkg = await Package.findById(packageId);
  if (!pkg || !pkg.isActive) {
    throw new AppError('Package not found.', 404, 'PACKAGE_NOT_FOUND');
  }
  if (!pkg.isAvailable) {
    throw new AppError('This package is currently unavailable. Please select another package.', 400, 'UNAVAILABLE');
  }
  return pkg;
};

export const validateOrderInput = async (body, user) => {
  const { packageId, phone, email, promoCode, afaDetails } = body;

  const emailResult = validateEmail(email);
  if (!emailResult.valid) throw new AppError(emailResult.error, 400);

  const pkg = await getFreshPackage(packageId);

  if (pkg.serviceType === 'result_checker') {
    const inStock = await checkStock(pkg.checkerType);
    if (!inStock) {
      throw new AppError('This checker is currently out of stock. Please check back later.', 400, 'OUT_OF_STOCK');
    }
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

  let promoResult = null;
  if (promoCode) {
    const settings = await SiteSettings.findOne().lean();
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

  const pricing = promoResult
    ? calculatePromoPrice(pkg.price, promoResult)
    : { packagePrice: pkg.price, promoDiscount: 0, finalPrice: pkg.price, isFreeOrder: false };

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
  };
};

export const createOrder = async (validated, user, idempotencyKey) => {
  const { pkg, phone, email, promoResult, pricing, paystackCharge, totalAmount, afaDetails } = validated;

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
      packageName: pkg.name,
      category: pkg.category,
      serviceType: pkg.serviceType,
      packagePrice: pricing.finalPrice,
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

    if (order.deliveryStatus === 'delivered' || order.deliveryStatus === 'processing') {
      await session.abortTransaction();
      return order;
    }

    order.deliveryStatus = 'processing';
    await order.save({ session });

    const pkg = await Package.findById(order.package).session(session);
    if (!pkg || !pkg.isAvailable) {
      order.deliveryStatus = 'failed';
      order.failureReason = 'Package no longer available';
      await order.save({ session });
      await session.commitTransaction();
      return order;
    }

    let providerResponse;

    if (order.serviceType === 'result_checker') {
      const checker = await assignChecker(pkg.checkerType, order._id, session);
      order.checker = checker._id;
      order.deliveryStatus = 'delivered';
      order.providerReference = checker.serialNumber;

      const settings = await SiteSettings.findOne();
      const supportContact = settings?.contactPhone || '0595399837';

      await session.commitTransaction();

      await syncCheckerPackageAvailability();
      if (io) io.emit('packages:refresh');

      await Promise.allSettled([
        sendCheckerDeliveryEmail(order.email, {
          checkerType: checker.checkerType,
          serialNumber: checker.serialNumber,
          pin: checker.pin,
          orderReference: order.reference,
          supportContact,
        }),
        sendCheckerDeliverySMS(order.phone, {
          checkerType: checker.checkerType,
          serialNumber: checker.serialNumber,
          pin: checker.pin,
          orderReference: order.reference,
          supportContact,
        }),
      ]);
    } else if (order.serviceType === 'data_bundle') {
      providerResponse = await submitDataBundleOrder(order, pkg);
      const { shouldNotify } = applyProviderFulfillment(order, providerResponse, {
        successStatus: 'delivered',
      });

      await order.save({ session });
      await session.commitTransaction();

      if (shouldNotify) {
        await Promise.allSettled([
          sendOrderConfirmationEmail(order.email, order),
          sendOrderConfirmationSMS(order.phone, order),
        ]);
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
      order.failureReason = err.message;
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
