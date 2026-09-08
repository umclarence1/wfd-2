import PendingPayment from '../models/PendingPayment.js';
import Order from '../models/Order.js';
import { generateReference } from '../utils/reference.js';
import { AppError } from '../middleware/errorHandler.js';

const CHECKOUT_TTL_MS = 30 * 60 * 1000;

export const createPendingPayment = async (validated, user, idempotencyKey) => {
  if (idempotencyKey) {
    const existingOrder = await Order.findOne({ idempotencyKey }).lean();
    if (existingOrder) {
      return { kind: 'order', doc: existingOrder };
    }

    const existingPending = await PendingPayment.findOne({ idempotencyKey });
    if (existingPending) {
      return { kind: 'pending', doc: existingPending };
    }
  }

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

  const paymentReference = generateReference('PAY');

  try {
    const pending = await PendingPayment.create({
      paymentReference,
      idempotencyKey: idempotencyKey || undefined,
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
      expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
    });
    return { kind: 'pending', doc: pending };
  } catch (err) {
    if (err.code === 11000 && idempotencyKey) {
      const existingPending = await PendingPayment.findOne({ idempotencyKey });
      if (existingPending) return { kind: 'pending', doc: existingPending };
      const existingOrder = await Order.findOne({ idempotencyKey });
      if (existingOrder) return { kind: 'order', doc: existingOrder };
    }
    throw err;
  }
};

export const createOrderFromPendingPayment = async (pending) => {
  const reference = generateReference('ORD');

  try {
    const order = await Order.create({
      reference,
      user: pending.user || null,
      email: pending.email,
      phone: pending.phone,
      package: pending.package,
      packageName: pending.packageName,
      category: pending.category,
      serviceType: pending.serviceType,
      packagePrice: pending.packagePrice,
      quantity: pending.quantity,
      paystackCharge: pending.paystackCharge,
      totalAmount: pending.totalAmount,
      promoCode: pending.promoCode,
      promoDiscount: pending.promoDiscount,
      isFreeOrder: false,
      paymentReference: pending.paymentReference,
      idempotencyKey: pending.idempotencyKey || undefined,
      paymentStatus: 'pending',
      deliveryStatus: 'pending',
    });
    await PendingPayment.deleteOne({ _id: pending._id });
    return order;
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Order.findOne({ paymentReference: pending.paymentReference });
      if (existing) {
        await PendingPayment.deleteOne({ _id: pending._id }).catch(() => {});
        return existing;
      }
    }
    throw err;
  }
};

export const findPendingPayment = async (paymentReference) => {
  const pending = await PendingPayment.findOne({ paymentReference });
  if (!pending) return null;
  if (pending.expiresAt && pending.expiresAt.getTime() < Date.now()) {
    await PendingPayment.deleteOne({ _id: pending._id });
    return null;
  }
  return pending;
};

export const resolveOrderForPayment = async (paymentReference) => {
  const order = await Order.findOne({ paymentReference });
  if (order) return order;

  const pending = await findPendingPayment(paymentReference);
  if (!pending) {
    throw new AppError('Checkout not found or expired. Please try again.', 404);
  }

  return createOrderFromPendingPayment(pending);
};
