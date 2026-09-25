import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProviderFulfillment } from '../services/providerFulfillment.js';
import { isOrderSubmittedToProvider } from '../utils/fulfillmentLock.js';

const baseOrder = () => ({
  reference: 'ORD-20260924-TESTREF01',
  deliveryStatus: 'processing',
  metadata: {},
  markModified: () => {},
});

test('uncertain provider response does not mark submitted', () => {
  const order = baseOrder();
  const result = applyProviderFulfillment(
    order,
    {
      uncertain: true,
      success: false,
      message: 'timeout',
      providerId: 'topdealsgh',
    },
    { successStatus: 'processing' }
  );
  assert.equal(result.queued, false);
  assert.equal(order.metadata.requiresReconciliation, true);
  assert.equal(isOrderSubmittedToProvider(order), false);
});

test('success with TopDeals orderId marks submitted', () => {
  const order = baseOrder();
  applyProviderFulfillment(
    order,
    {
      success: true,
      orderId: 'TD-998877',
      providerId: 'topdealsgh',
      message: 'ok',
    },
    { successStatus: 'processing' }
  );
  assert.equal(isOrderSubmittedToProvider(order), true);
  assert.equal(order.metadata.topdealsOrderId, 'TD-998877');
  assert.equal(order.deliveryStatus, 'delivered');
  assert.equal(order.metadata.providerSubmissionLocked, true);
});

test('success without trackable id is still marked delivered', () => {
  const order = baseOrder();
  applyProviderFulfillment(
    order,
    {
      success: true,
      reference: order.reference,
      providerId: 'topdealsgh',
      message: 'ok',
    },
    { successStatus: 'processing' }
  );
  assert.equal(order.deliveryStatus, 'delivered');
  assert.equal(order.metadata.providerSubmissionLocked, true);
  assert.equal(order.metadata.submittedToProvider, true);
});
