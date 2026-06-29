import Order from '../models/Order.js';

export const findQueuedProviderOrders = (limit = 25) =>
  Order.find({
    paymentStatus: 'paid',
    deliveryStatus: 'pending',
    'metadata.queuedForProvider': true,
    serviceType: { $in: ['data_bundle', 'afa_registration'] },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

export const getQueuedProviderOrders = (limit = 50) =>
  findQueuedProviderOrders(limit).select(
    'reference deliveryStatus serviceType createdAt metadata failureReason category'
  );
