import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import Order from '../models/Order.js';
import Package from '../models/Package.js';
import User from '../models/User.js';
import PromoCode from '../models/PromoCode.js';
import PromoRedemption from '../models/PromoRedemption.js';
import { generateUniquePromoCode, createBulkPromoCodes } from '../services/promoService.js';
import Slider from '../models/Slider.js';
import { getSiteSettings, setSiteSettingsFields } from '../services/siteSettingsService.js';
import AuditLog from '../models/AuditLog.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { protect, adminOnly, noCache, requirePermission } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { adminLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { promoBulkSchema, orderStatusUpdateSchema, orderBulkStatusUpdateSchema } from '../schemas/zodSchemas.js';
import { sliderUpload } from '../middleware/upload.js';
import { reorderCategoryPackages } from '../utils/packageSort.js';
import { pauseUpdate, resumeUpdate } from '../utils/packageAvailability.js';
import { fulfillOrder } from '../services/orderService.js';
import { syncOrderProviderStatus, maybeSendVerificationEmail } from '../services/orderProviderStatusService.js';
import { purgeAllOrders } from '../services/orderPurgeService.js';
import {
  serializeApiProviderSettingsForAdmin,
  updateApiProviderSettings,
  testProviderConnection,
  fetchTopDealsGhBalance,
  fetchSmartDataHubBalance,
  getQueuedOrders,
} from '../services/apiProviderService.js';
import { retryQueuedProviderOrders } from '../services/orderRetryService.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { isSafeHttpUrl } from '../utils/providerUrl.js';
import { encrypt } from '../utils/encryption.js';
import { env } from '../config/env.js';

const router = Router();

router.use(protect, adminOnly, adminLimiter, noCache);

if (env.cloudinary.cloudName) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

const emitPackageUpdate = (req, data) => {
  req.app.get('io')?.emit('package:updated', data);
};

const PAID_ORDER_FILTER = { paymentStatus: 'paid' };

// Analytics
router.get(
  '/analytics',
  requirePermission('analytics'),
  asyncHandler(async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, ordersToday, revenue, pending, failed, delivered, customers] =
      await Promise.all([
        Order.countDocuments(PAID_ORDER_FILTER),
        Order.countDocuments({ ...PAID_ORDER_FILTER, createdAt: { $gte: today } }),
        Order.aggregate([{ $match: PAID_ORDER_FILTER }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
        Order.countDocuments({ ...PAID_ORDER_FILTER, deliveryStatus: 'pending' }),
        Order.countDocuments({ ...PAID_ORDER_FILTER, deliveryStatus: 'failed' }),
        Order.countDocuments({ ...PAID_ORDER_FILTER, deliveryStatus: 'delivered' }),
        User.countDocuments({ role: 'user' }),
      ]);

    res.json({
      success: true,
      analytics: {
        totalOrders,
        ordersToday,
        revenue: revenue[0]?.total || 0,
        pendingOrders: pending,
        failedOrders: failed,
        deliveredOrders: delivered,
        customers,
      },
    });
  })
);

// Packages
router.get('/packages', requirePermission('packages'), asyncHandler(async (_req, res) => {
  const packages = await Package.find()
    .sort({ category: 1, displayOrder: 1 })
    .lean();
  res.json({ success: true, packages });
}));

router.post('/packages', requirePermission('packages'), asyncHandler(async (req, res) => {
  const { displayOrder: _displayOrder, ...body } = req.body;
  if (!(Number(body.price) > 0)) {
    throw new AppError('Package price must be greater than 0.', 400);
  }
  const pkg = await Package.create(body);
  await reorderCategoryPackages(pkg.category);
  const ordered = await Package.findById(pkg._id);
  emitPackageUpdate(req, { packageId: pkg._id.toString(), action: 'created' });
  req.app.get('io')?.emit('packages:refresh');
  await logAudit({ user: req.user, action: 'CREATE', resource: 'Package', resourceId: pkg._id, req });
  res.status(201).json({ success: true, package: ordered });
}));

router.put('/packages/:id', requirePermission('packages'), asyncHandler(async (req, res) => {
  const existing = await Package.findById(req.params.id);
  if (!existing) throw new AppError('Package not found.', 404);

  const {
    displayOrder: _displayOrder,
    isAvailable: _isAvailable,
    adminPaused: _adminPaused,
    ...updates
  } = req.body;
  if (updates.price !== undefined && !(Number(updates.price) > 0)) {
    throw new AppError('Package price must be greater than 0.', 400);
  }
  const pkg = await Package.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

  const sizeOrPriceChanged =
    updates.dataAmount !== undefined ||
    updates.price !== undefined ||
    updates.category !== undefined;

  if (sizeOrPriceChanged) {
    await reorderCategoryPackages(existing.category);
    if (updates.category && updates.category !== existing.category) {
      await reorderCategoryPackages(updates.category);
    }
  }

  const refreshed = await Package.findById(pkg._id);
  emitPackageUpdate(req, { packageId: pkg._id.toString(), action: 'updated', isAvailable: refreshed.isAvailable });
  req.app.get('io')?.emit('packages:refresh');
  await logAudit({ user: req.user, action: 'UPDATE', resource: 'Package', resourceId: pkg._id, details: updates, req });
  res.json({ success: true, package: refreshed });
}));

router.delete('/packages/:id', requirePermission('packages'), asyncHandler(async (req, res) => {
  const pkg = await Package.findByIdAndDelete(req.params.id);
  if (!pkg) throw new AppError('Package not found.', 404);
  await reorderCategoryPackages(pkg.category);
  emitPackageUpdate(req, { packageId: req.params.id, action: 'deleted' });
  req.app.get('io')?.emit('packages:refresh');
  await logAudit({ user: req.user, action: 'DELETE', resource: 'Package', resourceId: req.params.id, req });
  res.json({ success: true });
}));

router.patch('/packages/:id/availability', requirePermission('packages'), asyncHandler(async (req, res) => {
  if (typeof req.body.isAvailable !== 'boolean') {
    throw new AppError('isAvailable must be true or false.', 400);
  }

  const update = req.body.isAvailable ? resumeUpdate : pauseUpdate;
  const pkg = await Package.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!pkg) throw new AppError('Package not found.', 404);

  await logAudit({
    user: req.user,
    action: 'UPDATE',
    resource: 'Package',
    resourceId: pkg._id,
    details: { adminPaused: pkg.adminPaused, isAvailable: pkg.isAvailable },
    req,
  });

  emitPackageUpdate(req, { packageId: pkg._id.toString(), isAvailable: pkg.isAvailable, adminPaused: pkg.adminPaused });
  req.app.get('io')?.emit('packages:refresh');
  res.json({ success: true, package: pkg });
}));

router.patch('/packages/category/:category/availability', requirePermission('packages'), asyncHandler(async (req, res) => {
  const category = decodeURIComponent(req.params.category);
  if (typeof req.body.isAvailable !== 'boolean') {
    throw new AppError('isAvailable must be true or false.', 400);
  }

  const update = req.body.isAvailable ? resumeUpdate : pauseUpdate;
  const result = await Package.updateMany({ category }, { $set: update });

  if (result.matchedCount === 0) {
    throw new AppError('No packages found for this category.', 404);
  }

  await logAudit({
    user: req.user,
    action: 'UPDATE',
    resource: 'Package',
    details: { category, isAvailable: req.body.isAvailable, modifiedCount: result.modifiedCount },
    req,
  });

  req.app.get('io')?.emit('packages:refresh');
  res.json({ success: true, category, isAvailable: req.body.isAvailable, modifiedCount: result.modifiedCount });
}));

// Orders
router.get('/orders', requirePermission('orders'), asyncHandler(async (req, res) => {
  const { status, search, category, network, page = 1, limit = 100 } = req.query;
  const filter = { ...PAID_ORDER_FILTER };
  if (status) filter.deliveryStatus = status;
  if (search) {
    const safe = escapeRegex(String(search).slice(0, 100));
    filter.$or = [
      { reference: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { phone: { $regex: safe, $options: 'i' } },
      { packageName: { $regex: safe, $options: 'i' } },
    ];
  }

  const networkKey = String(network || category || '').toLowerCase();
  if (networkKey === 'mtn') {
    filter.category = { $in: ['MTN', 'MTN AFA'] };
  } else if (networkKey === 'telecel') {
    filter.category = 'Telecel';
  } else if (networkKey === 'airteltigo') {
    filter.category = { $in: ['AirtelTigo', 'AirtelTigo Big Time'] };
  } else if (category) {
    filter.category = category;
  }

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .populate('package', 'name category')
    .populate('checker', 'serialNumber pin checkerType');

  const total = await Order.countDocuments(filter);
  res.json({ success: true, orders, pagination: { page: Number(page), limit: Number(limit), total } });
}));

router.delete('/orders/purge-all', requirePermission('orders'), asyncHandler(async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Only admins can purge all orders.', 403, 'FORBIDDEN');
  }
  if (req.body?.confirm !== 'DELETE_ALL_ORDERS') {
    throw new AppError('Send { "confirm": "DELETE_ALL_ORDERS" } to purge all orders.', 400);
  }

  const result = await purgeAllOrders();

  await logAudit({
    user: req.user,
    action: 'DELETE',
    resource: 'Order',
    details: { purgeAll: true, ...result },
    req,
  });

  res.json({ success: true, message: 'All orders cleared.', ...result });
}));

router.patch('/orders/bulk-status', requirePermission('orders'), validateBody(orderBulkStatusUpdateSchema), asyncHandler(async (req, res) => {
  const { orderIds, deliveryStatus, paymentStatus } = req.body;
  const updates = {};
  if (deliveryStatus) updates.deliveryStatus = deliveryStatus;
  if (paymentStatus) updates.paymentStatus = paymentStatus;

  const before = deliveryStatus === 'verification'
    ? await Order.find({ _id: { $in: orderIds } }).select('deliveryStatus')
    : [];
  const beforeMap = new Map(before.map((o) => [String(o._id), o.deliveryStatus]));

  const result = await Order.updateMany({ _id: { $in: orderIds } }, updates);
  const orders = await Order.find({ _id: { $in: orderIds } });

  for (const order of orders) {
    if (deliveryStatus === 'verification') {
      try {
        const previous = beforeMap.get(String(order._id));
        const emailed = await maybeSendVerificationEmail(order, previous, { force: true });
        if (emailed) await order.save();
      } catch (emailErr) {
        console.error('[VERIFICATION_EMAIL] Bulk update email failed:', emailErr.message);
      }
    }
    req.app.get('io')?.emit('order:updated', {
      reference: order.reference,
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
    });
  }

  await logAudit({
    user: req.user,
    action: 'UPDATE',
    resource: 'Order',
    details: { bulk: true, count: result.modifiedCount, deliveryStatus, paymentStatus },
    req,
  });

  res.json({ success: true, modifiedCount: result.modifiedCount, orders });
}));

router.patch('/orders/:id/status', requirePermission('orders'), validateBody(orderStatusUpdateSchema), asyncHandler(async (req, res) => {
  const updates = {};
  const deliveryStatus = req.body.deliveryStatus || req.body.status;
  if (deliveryStatus) updates.deliveryStatus = deliveryStatus;
  if (req.body.paymentStatus) updates.paymentStatus = req.body.paymentStatus;

  const existing = await Order.findById(req.params.id);
  if (!existing) throw new AppError('Order not found.', 404);
  const previousDelivery = existing.deliveryStatus;

  const order = await Order.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!order) throw new AppError('Order not found.', 404);

  // Never fail the status change because email delivery broke.
  if (deliveryStatus === 'verification') {
    try {
      const emailed = await maybeSendVerificationEmail(order, previousDelivery, { force: true });
      if (emailed) await order.save();
    } catch (emailErr) {
      console.error('[VERIFICATION_EMAIL] Failed after status update:', emailErr.message);
    }
  }

  req.app.get('io')?.emit('order:updated', {
    reference: order.reference,
    deliveryStatus: order.deliveryStatus,
    paymentStatus: order.paymentStatus,
  });
  res.json({ success: true, order });
}));

router.post('/orders/:id/resubmit', requirePermission('orders'), asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found.', 404);
  order.retryCount += 1;
  order.deliveryStatus = 'pending';
  await order.save();
  await fulfillOrder(order._id, req.app.get('io'));
  res.json({ success: true, message: 'Order resubmitted.' });
}));

router.post('/orders/:id/sync-provider', requirePermission('orders'), asyncHandler(async (req, res) => {
  const result = await syncOrderProviderStatus(req.params.id, req.app.get('io'));
  res.json({ success: true, ...result });
}));

// Promos
router.get('/promos', requirePermission('promos'), asyncHandler(async (_req, res) => {
  const promos = await PromoCode.find().sort({ createdAt: -1 });
  res.json({ success: true, promos });
}));

router.post('/promos/bulk', requirePermission('promos'), validateBody(promoBulkSchema), asyncHandler(async (req, res) => {
  const { count, ...rest } = req.body;
  const body = { ...rest };

  const promos = await createBulkPromoCodes({
    count,
    description: body.description || '',
    discountType: body.discountType || 'fixed',
    discountValue: Number(body.discountValue),
    expiryDate: new Date(body.expiryDate),
    usageLimit: body.usageLimit != null && body.usageLimit !== '' ? Number(body.usageLimit) : null,
    productCategories: body.productCategories || [],
    isActive: body.isActive !== false,
  });

  await logAudit({ user: req.user, action: 'CREATE', resource: 'PromoCode', details: { bulk: true, count: promos.length }, req });
  res.status(201).json({ success: true, promos, count: promos.length });
}));

router.post('/promos', requirePermission('promos'), asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.code) {
    body.code = String(body.code).trim().toUpperCase();
  } else {
    body.code = await generateUniquePromoCode();
  }

  try {
    const promo = await PromoCode.create(body);
    await logAudit({ user: req.user, action: 'CREATE', resource: 'PromoCode', resourceId: promo._id, req });
    res.status(201).json({ success: true, promo });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('A promo code with this code already exists.', 400);
    }
    throw err;
  }
}));

router.put('/promos/:id', requirePermission('promos'), asyncHandler(async (req, res) => {
  const promo = await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!promo) throw new AppError('Promo not found.', 404);
  await logAudit({ user: req.user, action: 'UPDATE', resource: 'PromoCode', resourceId: promo._id, req });
  res.json({ success: true, promo });
}));

router.delete('/promos/:id', requirePermission('promos'), asyncHandler(async (req, res) => {
  await PromoCode.findByIdAndDelete(req.params.id);
  await logAudit({ user: req.user, action: 'DELETE', resource: 'PromoCode', resourceId: req.params.id, req });
  res.json({ success: true });
}));

// Users
router.get('/users', requirePermission('users'), asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const filter = { role: 'user' };
  if (search) {
    const safe = escapeRegex(String(search).slice(0, 100));
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await User.countDocuments(filter);
  res.json({ success: true, users, pagination: { page: Number(page), limit: Number(limit), total } });
}));

router.patch('/users/:id/suspend', requirePermission('users'), asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isSuspended: req.body.isSuspended }, { new: true });
  res.json({ success: true, user });
}));

router.patch('/users/:id/ban', requirePermission('users'), asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: req.body.isBanned }, { new: true });
  res.json({ success: true, user });
}));

// Sliders
router.get('/sliders', requirePermission('sliders'), asyncHandler(async (_req, res) => {
  const sliders = await Slider.find().sort({ displayOrder: 1 });
  res.json({ success: true, sliders });
}));

router.post('/sliders', requirePermission('sliders'), sliderUpload.single('image'), asyncHandler(async (req, res) => {
  let imageUrl = req.body.imageUrl;

  if (req.file && env.cloudinary.cloudName) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ folder: 'wds/sliders' }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }).end(req.file.buffer);
    });
    imageUrl = result.secure_url;
  }

  const slider = await Slider.create({ ...req.body, imageUrl });
  req.app.get('io')?.emit('sliders:updated');
  res.status(201).json({ success: true, slider });
}));

router.put('/sliders/:id', requirePermission('sliders'), sliderUpload.single('image'), asyncHandler(async (req, res) => {
  const updates = { ...req.body };

  if (req.file && env.cloudinary.cloudName) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ folder: 'wds/sliders' }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }).end(req.file.buffer);
    });
    updates.imageUrl = result.secure_url;
  }

  const slider = await Slider.findByIdAndUpdate(req.params.id, updates, { new: true });
  req.app.get('io')?.emit('sliders:updated');
  res.json({ success: true, slider });
}));

router.delete('/sliders/:id', requirePermission('sliders'), asyncHandler(async (req, res) => {
  await Slider.findByIdAndDelete(req.params.id);
  req.app.get('io')?.emit('sliders:updated');
  res.json({ success: true });
}));

router.patch('/sliders/reorder', requirePermission('sliders'), asyncHandler(async (req, res) => {
  const { items } = req.body;
  await Promise.all(items.map(({ id, displayOrder }) => Slider.findByIdAndUpdate(id, { displayOrder })));
  req.app.get('io')?.emit('sliders:updated');
  res.json({ success: true });
}));

// Settings
router.get('/settings', requirePermission('settings'), asyncHandler(async (_req, res) => {
  const settings = await getSiteSettings();
  res.json({ success: true, settings });
}));

router.put('/settings', requirePermission('settings'), asyncHandler(async (req, res) => {
  if (req.body.announcementBanner?.link) {
    if (!isSafeHttpUrl(req.body.announcementBanner.link)) {
      throw new AppError('Announcement link must be a valid http(s) URL.', 400);
    }
  }
  const allowed = [
    'siteName', 'tagline', 'logo', 'favicon', 'contactEmail', 'contactPhone', 'whatsapp',
    'address', 'socialLinks', 'maintenanceMode', 'maintenanceMessage', 'announcementBanner',
    'paystackPublicKey', 'stats',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (req.body.providerApiKey) {
    updates.providerApiKeyEncrypted = encrypt(req.body.providerApiKey);
  }

  const settings = await setSiteSettingsFields(updates);
  await logAudit({ user: req.user, action: 'UPDATE', resource: 'SiteSettings', req });
  req.app.get('io')?.emit('settings:updated');
  res.json({ success: true, settings });
}));

router.patch('/settings/promo-checkout', requirePermission('promo_checkout'), asyncHandler(async (req, res) => {
  const enabled = Boolean(req.body.enabled);
  const settings = await setSiteSettingsFields({ promoCheckoutEnabled: enabled });
  await logAudit({ user: req.user, action: 'UPDATE', resource: 'SiteSettings', details: { promoCheckoutEnabled: enabled }, req });
  req.app.get('io')?.emit('settings:updated');
  res.json({ success: true, promoCheckoutEnabled: settings.promoCheckoutEnabled });
}));

// API provider routing (data bundles + AFA only)
router.get('/api-providers', requirePermission('api_providers'), asyncHandler(async (_req, res) => {
  const config = await serializeApiProviderSettingsForAdmin();
  res.json({ success: true, config });
}));

router.put('/api-providers', requirePermission('api_providers'), asyncHandler(async (req, res) => {
  const config = await updateApiProviderSettings(req.body);
  await logAudit({ user: req.user, action: 'UPDATE', resource: 'ApiProviderSettings', details: req.body, req });

  let autoRetry = null;
  if (req.body.forwardingEnabled === true || req.body.networkProviders) {
    autoRetry = await retryQueuedProviderOrders(req.app.get('io'));
  }

  res.json({ success: true, config, autoRetry });
}));

router.post('/api-providers/test/:providerId', requirePermission('api_providers'), asyncHandler(async (req, res) => {
  const result = await testProviderConnection(req.params.providerId);
  res.json({ success: result.success, ...result });
}));

router.get('/api-providers/topdealsgh/balance', requirePermission('api_providers'), asyncHandler(async (req, res) => {
  const result = await fetchTopDealsGhBalance();
  const autoRetry = await retryQueuedProviderOrders(req.app.get('io'));
  res.json({ success: true, ...result, autoRetry });
}));

router.get('/api-providers/datamax/balance', requirePermission('api_providers'), asyncHandler(async (req, res) => {
  const result = await fetchTopDealsGhBalance();
  const autoRetry = await retryQueuedProviderOrders(req.app.get('io'));
  res.json({ success: true, ...result, autoRetry });
}));

router.get('/api-providers/smart-data-hub/balance', requirePermission('api_providers'), asyncHandler(async (req, res) => {
  const result = await fetchSmartDataHubBalance();
  const autoRetry = await retryQueuedProviderOrders(req.app.get('io'));
  res.json({ success: true, ...result, autoRetry });
}));

router.post('/api-providers/retry-queued', requirePermission('api_providers'), asyncHandler(async (req, res) => {
  const summary = await retryQueuedProviderOrders(req.app.get('io'));
  res.json({ success: true, ...summary });
}));

router.get('/api-providers/queued', requirePermission('api_providers'), asyncHandler(async (_req, res) => {
  const orders = await getQueuedOrders();
  res.json({ success: true, orders });
}));

// Audit logs
router.get('/audit-logs', requirePermission('settings'), asyncHandler(async (req, res) => {
  const logs = await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('user', 'name email');
  res.json({ success: true, logs });
}));

export default router;
