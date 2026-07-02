import mongoose from 'mongoose';
import PromoCode from '../models/PromoCode.js';
import PromoRedemption from '../models/PromoRedemption.js';
import { generateReference } from '../utils/reference.js';
import { AppError } from '../middleware/errorHandler.js';

const PROMO_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateUniquePromoCode = async (length = 8) => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    let code = '';
    for (let i = 0; i < length; i += 1) {
      code += PROMO_CODE_CHARS[Math.floor(Math.random() * PROMO_CODE_CHARS.length)];
    }
    const exists = await PromoCode.findOne({ code });
    if (!exists) return code;
  }
  throw new AppError('Could not generate a unique promo code. Try again.', 500);
};

const randomPromoCode = (length = 8) => {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += PROMO_CODE_CHARS[Math.floor(Math.random() * PROMO_CODE_CHARS.length)];
  }
  return code;
};

export const createBulkPromoCodes = async ({ count = 1, ...settings }) => {
  const total = Math.min(Math.max(Number(count) || 1, 1), 100);
  const seen = new Set();
  const ready = [];

  while (ready.length < total) {
    const code = randomPromoCode();
    if (seen.has(code)) continue;
    seen.add(code);
    ready.push({ ...settings, code });
  }

  const existing = await PromoCode.find({ code: { $in: ready.map((p) => p.code) } })
    .select('code')
    .lean();
  const taken = new Set(existing.map((p) => p.code));
  const final = ready.filter((p) => !taken.has(p.code));

  while (final.length < total) {
    let code = randomPromoCode();
    while (seen.has(code) || taken.has(code)) {
      code = randomPromoCode();
    }
    seen.add(code);
    final.push({ ...settings, code });
  }

  return PromoCode.insertMany(final.slice(0, total));
};

export const validatePromoCode = async ({ code, packageId, category, email, phone, userId }) => {
  const promo = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });

  if (!promo) {
    throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
  }

  if (new Date() > promo.expiryDate) {
    throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
  }

  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
    throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
  }

  if (promo.productCategories.length > 0 && !promo.productCategories.includes(category)) {
    throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
  }

  if (promo.productIds.length > 0 && !promo.productIds.some((id) => id.toString() === packageId)) {
    throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
  }

  if (promo.onePerEmail) {
    const existing = await PromoRedemption.findOne({ promoCode: promo._id, email: email.toLowerCase() });
    if (existing) throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
  }

  if (promo.onePerPhone) {
    const existing = await PromoRedemption.findOne({ promoCode: promo._id, phone });
    if (existing) throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
  }

  if (promo.onePerAccount && userId) {
    const existing = await PromoRedemption.findOne({ promoCode: promo._id, user: userId });
    if (existing) throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
  }

  let discount = 0;
  let isFree = false;

  if (promo.discountType === 'free') {
    isFree = true;
    discount = 100;
  } else if (promo.discountType === 'percentage') {
    discount = promo.discountValue;
  } else {
    discount = promo.discountValue;
  }

  return { promo, discount, isFree, discountType: promo.discountType };
};

export const redeemPromoCode = async ({ promo, email, phone, userId, orderId, session }) => {
  return redeemPromoCodeAtomic({ promo, email, phone, userId, orderId, session });
};

export const redeemPromoCodeAtomic = async ({ promo, email, phone, userId, orderId, session }) => {
  const opts = session ? { session } : {};

  if (promo.usageLimit !== null) {
    const updated = await PromoCode.findOneAndUpdate(
      {
        _id: promo._id,
        isActive: true,
        $expr: { $lt: ['$usageCount', '$usageLimit'] },
      },
      { $inc: { usageCount: 1 } },
      { new: true, ...opts }
    );
    if (!updated) {
      throw new AppError('Invalid or expired promo code.', 400, 'INVALID_PROMO');
    }
  } else {
    await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usageCount: 1 } }, opts);
  }

  const reference = generateReference('PRM');
  try {
    await PromoRedemption.create(
      [{ reference, promoCode: promo._id, code: promo.code, email, phone, user: userId, order: orderId }],
      opts
    );
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('Promo code already used for this order.', 400, 'PROMO_ALREADY_REDEEMED');
    }
    throw err;
  }
};

export const calculatePromoPrice = (packagePrice, promoResult) => {
  if (promoResult.isFree) {
    return { packagePrice, promoDiscount: packagePrice, finalPrice: 0, isFreeOrder: true };
  }

  if (promoResult.discountType === 'percentage') {
    const discount = Math.round((packagePrice * promoResult.discount / 100) * 100) / 100;
    return { packagePrice, promoDiscount: discount, finalPrice: Math.max(0, packagePrice - discount), isFreeOrder: false };
  }

  const discount = Math.min(promoResult.discount, packagePrice);
  return { packagePrice, promoDiscount: discount, finalPrice: Math.max(0, packagePrice - discount), isFreeOrder: false };
};
