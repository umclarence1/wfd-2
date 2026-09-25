import Order from '../models/Order.js';
import { getSiteSettings, setSiteSettingsFields } from './siteSettingsService.js';

export const ORDER_FULFILLMENT_REPAIR_VERSION = 3;

export const providerAcceptedOrder = (order) => {
  if (!order) return false;
  if (order.metadata?.submittedToProvider === true) return true;
  const pr = order.providerResponse;
  if (pr?.success === true || pr?.alreadySubmitted === true) return true;
  if (pr?.raw?.success === true && order.metadata?.fulfilledAt) return true;
  return false;
};

export const neverSubmittedToProvider = (order) =>
  order.paymentStatus === 'paid'
  && order.deliveryStatus !== 'delivered'
  && order.metadata?.manuallyFulfilled !== true
  && !providerAcceptedOrder(order);

/**
 * One-time (versioned) repair: unblock never-submitted orders and submit once.
 * Idempotent — safe to call multiple times before version bump.
 */
export const runOrderFulfillmentRepair = async (io = null, { submit = true } = {}) => {
  const settings = await getSiteSettings();
  const currentVersion = settings?.orderFulfillmentRepairVersion || 0;
  if (currentVersion >= ORDER_FULFILLMENT_REPAIR_VERSION) {
    return { skipped: true, reason: 'already_repaired', version: currentVersion };
  }

  const summary = {
    deliveredMarkedManual: 0,
    markedSubmitted: 0,
    clearedStaleRefs: 0,
    requeued: 0,
    submitted: 0,
    submitErrors: 0,
    stillNeverSubmitted: 0,
    references: { markedSubmitted: [], requeued: [], submitted: [], failed: [] },
  };

  const clearedStale = await Order.updateMany(
    {
      paymentStatus: 'paid',
      'metadata.submittedToProvider': { $ne: true },
      providerReference: { $exists: true, $nin: [null, ''] },
      $or: [
        { providerResponse: { $exists: false } },
        { 'providerResponse.success': { $ne: true } },
        { 'providerResponse.alreadySubmitted': { $ne: true } },
      ],
    },
    {
      $unset: { providerReference: '', providerResponse: '' },
      $set: {
        'metadata.queuedForProvider': true,
        'metadata.fulfillmentAbandoned': false,
        deliveryStatus: 'processing',
      },
    }
  );
  summary.clearedStaleRefs = clearedStale.modifiedCount;

  const delivered = await Order.updateMany(
    { paymentStatus: 'paid', deliveryStatus: 'delivered', 'metadata.manuallyFulfilled': { $ne: true } },
    {
      $set: { 'metadata.manuallyFulfilled': true, 'metadata.queuedForProvider': false },
      $unset: { 'metadata.autoFulfillmentStopped': '' },
    }
  );
  summary.deliveredMarkedManual = delivered.modifiedCount;

  const paidOrders = await Order.find({
    paymentStatus: 'paid',
    serviceType: { $in: ['data_bundle', 'afa_registration', 'result_checker'] },
  }).lean();

  const toSubmit = [];

  for (const order of paidOrders) {
    if (order.metadata?.manuallyFulfilled || order.deliveryStatus === 'delivered') continue;

    if (providerAcceptedOrder(order) && order.metadata?.submittedToProvider !== true) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            'metadata.submittedToProvider': true,
            'metadata.submittedToProviderAt': new Date().toISOString(),
            'metadata.queuedForProvider': false,
            'metadata.fulfillmentAbandoned': false,
          },
          $unset: { 'metadata.autoFulfillmentStopped': '' },
        }
      );
      summary.markedSubmitted += 1;
      summary.references.markedSubmitted.push(order.reference);
      continue;
    }

    if (neverSubmittedToProvider(order)) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            'metadata.queuedForProvider': true,
            'metadata.fulfillmentAbandoned': false,
            'metadata.submittedToProvider': false,
            deliveryStatus: 'processing',
            failureReason: 'Payment received — submitting to provider.',
          },
          $unset: {
            'metadata.autoFulfillmentStopped': '',
            'metadata.fulfillmentInProgress': '',
            'metadata.fulfillmentInProgressAt': '',
          },
        }
      );
      summary.requeued += 1;
      summary.references.requeued.push(order.reference);
      toSubmit.push(order);
    }
  }

  // Do not purchase here. A second automatic POST is what created duplicate TopDeals orders.
  void submit;
  void io;
  void toSubmit;

  summary.stillNeverSubmitted = await Order.countDocuments({
    paymentStatus: 'paid',
    deliveryStatus: 'processing',
    'metadata.manuallyFulfilled': { $ne: true },
    'metadata.submittedToProvider': { $ne: true },
    serviceType: { $in: ['data_bundle', 'afa_registration'] },
  });

  await setSiteSettingsFields({ orderFulfillmentRepairVersion: ORDER_FULFILLMENT_REPAIR_VERSION });

  return { skipped: false, version: ORDER_FULFILLMENT_REPAIR_VERSION, ...summary };
};
