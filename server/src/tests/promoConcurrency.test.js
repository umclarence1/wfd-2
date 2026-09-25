import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PromoCode from '../models/PromoCode.js';
import { redeemPromoCodeAtomic } from '../services/promoService.js';

let mongo;

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('single-use promo allows only one atomic redemption', async () => {
  const promo = await PromoCode.create({
    code: 'ONCE1234',
    description: 'test',
    discountType: 'fixed',
    discountValue: 1,
    expiryDate: new Date(Date.now() + 86400000),
    usageLimit: 1,
    usageCount: 0,
    isActive: true,
  });

  const orderA = new mongoose.Types.ObjectId();
  const orderB = new mongoose.Types.ObjectId();

  const first = redeemPromoCodeAtomic({
    promo,
    email: 'a@test.com',
    phone: '0241111111',
    orderId: orderA,
  });
  const second = redeemPromoCodeAtomic({
    promo,
    email: 'b@test.com',
    phone: '0242222222',
    orderId: orderB,
  });

  const results = await Promise.allSettled([first, second]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);

  const refreshed = await PromoCode.findById(promo._id);
  assert.equal(refreshed.usageCount, 1);
});
