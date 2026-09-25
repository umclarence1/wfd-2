import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Order from '../models/Order.js';
import {
  claimFulfillment,
  hasConfirmedProviderSubmission,
  isOrderSubmittedToProvider,
  isWithinProviderPurchaseCooldown,
  repairStaleProviderSubmission,
  releaseFulfillmentLock,
} from '../utils/fulfillmentLock.js';
import { isRealProviderReference } from '../utils/providerReference.js';

let mongo;

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Order.syncIndexes();
});

test.after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const createPaidOrder = async (overrides = {}) =>
  Order.create({
    reference: `ORD-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: 'test@checkout.wilberforcedataservice.com',
    phone: '0241234567',
    package: new mongoose.Types.ObjectId(),
    packageName: '1GB Test',
    category: 'MTN',
    serviceType: 'data_bundle',
    packagePrice: 5,
    totalAmount: 5.1,
    paymentStatus: 'paid',
    deliveryStatus: 'processing',
    paymentReference: `PAY-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides,
  });

test('isRealProviderReference rejects local ORD-/PAY- values', () => {
  assert.equal(isRealProviderReference('ORD-20260924-ABCDE12345', 'ORD-20260924-OTHER1234'), false);
  assert.equal(isRealProviderReference('PAY-20260924-ABCDE12345', 'ORD-20260924-ABCDE12345'), false);
  assert.equal(isRealProviderReference('ORD-1790240499830-2008', 'ORD-20260924-ABCDE12345'), true);
  assert.equal(isRealProviderReference('TD-998877', 'ORD-20260924-ABCDE12345'), true);
});

test('stale submitted flag without TopDeals id is repaired', async () => {
  const order = await createPaidOrder({
    providerReference: 'ORD-20260924-LOCALREF01',
    metadata: { submittedToProvider: true },
  });
  assert.equal(isOrderSubmittedToProvider(order), false);
  assert.equal(repairStaleProviderSubmission(order), true);
  assert.equal(order.metadata.submittedToProvider, false);
  assert.equal(order.providerReference, undefined);
});

test('only one concurrent claim succeeds', async () => {
  const order = await createPaidOrder();
  const [a, b] = await Promise.all([claimFulfillment(order._id), claimFulfillment(order._id)]);
  const winners = [a, b].filter(Boolean);
  assert.equal(winners.length, 1);
  await releaseFulfillmentLock(order._id);
});

test('confirmed TopDeals id prevents second claim', async () => {
  const order = await createPaidOrder({
    metadata: { topdealsOrderId: 'TD-12345', submittedToProvider: true },
    providerReference: 'TD-12345',
    providerResponse: { orderId: 'TD-12345', success: true },
  });
  assert.equal(hasConfirmedProviderSubmission(order), true);
  const claimed = await claimFulfillment(order._id);
  assert.equal(claimed, null);
});

test('uncertain submission uses extended cooldown window', async () => {
  const order = await createPaidOrder({
    metadata: {
      providerPurchaseAttemptedAt: new Date().toISOString(),
      requiresReconciliation: true,
    },
  });
  assert.equal(isWithinProviderPurchaseCooldown(order), true);
});

test('duplicate payment reference uniqueness on order model', async () => {
  const payRef = `PAY-DUP-${Date.now()}`;
  await createPaidOrder({ paymentReference: payRef });
  await assert.rejects(
    () => createPaidOrder({ paymentReference: payRef, reference: `ORD-DUP-${Date.now()}` }),
    (err) => err.code === 11000
  );
});
