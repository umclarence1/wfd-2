import Order from '../models/Order.js';
import PromoRedemption from '../models/PromoRedemption.js';
import PromoCode from '../models/PromoCode.js';
import Checker from '../models/Checker.js';
import { syncCheckerPackageAvailability } from './checkerService.js';

export const purgeAllOrders = async () => {
  const orderCount = await Order.countDocuments();
  const redemptionResult = await PromoRedemption.deleteMany({});
  const checkerResult = await Checker.updateMany(
    { status: 'used' },
    { $set: { status: 'unused', order: null }, $unset: { usedAt: 1 } }
  );
  const promoReset = await PromoCode.updateMany({}, { $set: { usageCount: 0 } });
  const orderResult = await Order.deleteMany({});

  return {
    ordersDeleted: orderResult.deletedCount,
    redemptionsDeleted: redemptionResult.deletedCount,
    checkersReset: checkerResult.modifiedCount,
    promosReset: promoReset.modifiedCount,
    previousOrderCount: orderCount,
  };
};

export const purgeAllCheckers = async () => {
  const checkerCount = await Checker.countDocuments();
  const result = await Checker.deleteMany({});
  await syncCheckerPackageAvailability();

  return {
    checkersDeleted: result.deletedCount,
    previousCheckerCount: checkerCount,
  };
};
