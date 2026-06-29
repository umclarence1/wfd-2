import { Router } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { v2 as cloudinary } from 'cloudinary';
import Order from '../models/Order.js';
import Package from '../models/Package.js';
import User from '../models/User.js';
import Checker from '../models/Checker.js';
import PromoCode from '../models/PromoCode.js';
import { generateUniquePromoCode, createBulkPromoCodes } from '../services/promoService.js';
import Slider from '../models/Slider.js';
import SiteSettings from '../models/SiteSettings.js';
import AuditLog from '../models/AuditLog.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { protect, adminOnly, noCache } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import {
  getCheckerStats,
  uploadCheckersFromExcel,
  syncCheckerPackageAvailability,
} from '../services/checkerService.js';
import { reorderCategoryPackages } from '../utils/packageSort.js';
import { fulfillOrder } from '../services/orderService.js';
import {
  serializeApiProviderSettingsForAdmin,
  updateApiProviderSettings,
  testProviderConnection,
  fetchDatamaxBalance,
  fetchSmartDataHubBalance,
  getQueuedOrders,
} from '../services/apiProviderService.js';
import { retryQueuedProviderOrders } from '../services/orderRetryService.js';
import { encrypt } from '../utils/encryption.js';
import { env } from '../config/env.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect, adminOnly, noCache);

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

// Analytics
router.get(
  '/analytics',
  asyncHandler(async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, ordersToday, revenue, pending, failed, delivered, customers] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Order.countDocuments({ deliveryStatus: 'pending' }),
      Order.countDocuments({ deliveryStatus: 'failed' }),
      Order.countDocuments({ deliveryStatus: 'delivered' }),
      User.countDocuments({ role: 'user' }),
    ]);

    const checkerStats = await getCheckerStats();

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
        checkers: checkerStats,
      },
    });
  })
);

// Packages
router.get('/packages', asyncHandler(async (_req, res) => {
  const packages = await Package.find().sort({ category: 1, displayOrder: 1 });
  res.json({ success: true, packages });
}));

router.post('/packages', asyncHandler(async (req, res) => {
  const { displayOrder: _displayOrder, ...body } = req.body;
  const pkg = await Package.create(body);
  await reorderCategoryPackages(pkg.category);
  const ordered = await Package.findById(pkg._id);
  emitPackageUpdate(req, { packageId: pkg._id.toString(), action: 'created' });
  req.app.get('io')?.emit('packages:refresh');
  await logAudit({ user: req.user, action: 'CREATE', resource: 'Package', resourceId: pkg._id, req });
  res.status(201).json({ success: true, package: ordered });
}));

router.put('/packages/:id', asyncHandler(async (req, res) => {
  const existing = await Package.findById(req.params.id);
  if (!existing) throw new AppError('Package not found.', 404);

  const { displayOrder: _displayOrder, ...updates } = req.body;
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
  res.json({ success: true, package: refreshed });
}));

router.delete('/packages/:id', asyncHandler(async (req, res) => {
  const pkg = await Package.findByIdAndDelete(req.params.id);
  if (!pkg) throw new AppError('Package not found.', 404);
  await reorderCategoryPackages(pkg.category);
  emitPackageUpdate(req, { packageId: req.params.id, action: 'deleted' });
  req.app.get('io')?.emit('packages:refresh');
  await logAudit({ user: req.user, action: 'DELETE', resource: 'Package', resourceId: req.params.id, req });
  res.json({ success: true });
}));

router.patch('/packages/:id/availability', asyncHandler(async (req, res) => {
  const pkg = await Package.findByIdAndUpdate(
    req.params.id,
    { isAvailable: req.body.isAvailable },
    { new: true }
  );
  if (!pkg) throw new AppError('Package not found.', 404);
  emitPackageUpdate(req, { packageId: pkg._id.toString(), isAvailable: pkg.isAvailable });
  req.app.get('io')?.emit('packages:refresh');
  res.json({ success: true, package: pkg });
}));

router.patch('/packages/category/:category/availability', asyncHandler(async (req, res) => {
  const category = decodeURIComponent(req.params.category);
  if (typeof req.body.isAvailable !== 'boolean') {
    throw new AppError('isAvailable must be true or false.', 400);
  }

  const result = await Package.updateMany(
    { category },
    { $set: { isAvailable: req.body.isAvailable } }
  );

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
router.get('/orders', asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.deliveryStatus = status;
  if (search) {
    filter.$or = [
      { reference: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
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

router.patch('/orders/:id/status', asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, { deliveryStatus: req.body.status }, { new: true });
  if (!order) throw new AppError('Order not found.', 404);
  req.app.get('io')?.emit('order:updated', { reference: order.reference, deliveryStatus: order.deliveryStatus });
  res.json({ success: true, order });
}));

router.post('/orders/:id/resubmit', asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found.', 404);
  order.retryCount += 1;
  order.deliveryStatus = 'pending';
  await order.save();
  await fulfillOrder(order._id, req.app.get('io'));
  res.json({ success: true, message: 'Order resubmitted.' });
}));

// Checkers
router.get('/checkers/stats', asyncHandler(async (_req, res) => {
  const stats = await getCheckerStats();
  res.json({ success: true, stats });
}));

router.get('/checkers', asyncHandler(async (req, res) => {
  const { status, type, search, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.checkerType = type;
  if (search) filter.serialNumber = { $regex: search, $options: 'i' };

  const checkers = await Checker.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Checker.countDocuments(filter);
  res.json({ success: true, checkers, pagination: { page: Number(page), limit: Number(limit), total } });
}));

router.post('/checkers/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Excel file required.', 400);

  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const report = await uploadCheckersFromExcel(rows);
  await logAudit({ user: req.user, action: 'UPLOAD', resource: 'Checker', details: report, req });
  req.app.get('io')?.emit('packages:refresh');
  res.json({ success: true, report });
}));

router.post('/checkers', asyncHandler(async (req, res) => {
  const checkerType = String(req.body.checkerType || '').trim().toUpperCase();
  const serialNumber = String(req.body.serialNumber || '').trim();
  const pin = String(req.body.pin || '').trim();
  const year = String(req.body.year || '').trim();

  if (!checkerType || !serialNumber || !pin || !year) {
    throw new AppError('Checker type, serial number, PIN, and year are required.', 400);
  }
  if (!['BECE', 'WASSCE'].includes(checkerType)) {
    throw new AppError('Checker type must be BECE or WASSCE.', 400);
  }

  const existing = await Checker.findOne({ serialNumber });
  if (existing) {
    throw new AppError('A checker with this serial number already exists.', 409);
  }

  const checker = await Checker.create({
    checkerType,
    serialNumber,
    pin,
    year,
    status: 'unused',
  });

  await syncCheckerPackageAvailability();
  await logAudit({ user: req.user, action: 'CREATE', resource: 'Checker', resourceId: checker._id, req });
  req.app.get('io')?.emit('packages:refresh');
  res.status(201).json({ success: true, checker });
}));

router.delete('/checkers/:id', asyncHandler(async (req, res) => {
  const checker = await Checker.findById(req.params.id);
  if (!checker) throw new AppError('Checker not found.', 404);
  if (checker.status === 'used') {
    throw new AppError('Cannot delete a checker that has already been used.', 400);
  }

  await Checker.findByIdAndDelete(req.params.id);
  await syncCheckerPackageAvailability();
  req.app.get('io')?.emit('packages:refresh');
  res.json({ success: true });
}));

// Promos
router.get('/promos', asyncHandler(async (_req, res) => {
  const promos = await PromoCode.find().sort({ createdAt: -1 });
  res.json({ success: true, promos });
}));

router.post('/promos/bulk', asyncHandler(async (req, res) => {
  const { count, ...rest } = req.body;
  const body = { ...rest };

  if (!body.expiryDate) {
    throw new AppError('Expiry date is required.', 400);
  }
  if (!body.discountType) body.discountType = 'fixed';
  if (body.discountValue == null || Number(body.discountValue) <= 0) {
    throw new AppError('A valid discount value is required.', 400);
  }

  const promos = await createBulkPromoCodes({
    count,
    description: body.description || '',
    discountType: body.discountType,
    discountValue: Number(body.discountValue),
    expiryDate: new Date(body.expiryDate),
    usageLimit: body.usageLimit != null && body.usageLimit !== '' ? Number(body.usageLimit) : null,
    productCategories: body.productCategories || [],
    isActive: body.isActive !== false,
  });

  res.status(201).json({ success: true, promos, count: promos.length });
}));

router.post('/promos', asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.code) {
    body.code = String(body.code).trim().toUpperCase();
  } else {
    body.code = await generateUniquePromoCode();
  }

  try {
    const promo = await PromoCode.create(body);
    res.status(201).json({ success: true, promo });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('A promo code with this code already exists.', 400);
    }
    throw err;
  }
}));

router.put('/promos/:id', asyncHandler(async (req, res) => {
  const promo = await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!promo) throw new AppError('Promo not found.', 404);
  res.json({ success: true, promo });
}));

router.delete('/promos/:id', asyncHandler(async (req, res) => {
  await PromoCode.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// Users
router.get('/users', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const filter = { role: 'user' };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await User.countDocuments(filter);
  res.json({ success: true, users, pagination: { page: Number(page), limit: Number(limit), total } });
}));

router.patch('/users/:id/suspend', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isSuspended: req.body.isSuspended }, { new: true });
  res.json({ success: true, user });
}));

router.patch('/users/:id/ban', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: req.body.isBanned }, { new: true });
  res.json({ success: true, user });
}));

// Sliders
router.get('/sliders', asyncHandler(async (_req, res) => {
  const sliders = await Slider.find().sort({ displayOrder: 1 });
  res.json({ success: true, sliders });
}));

router.post('/sliders', upload.single('image'), asyncHandler(async (req, res) => {
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

router.put('/sliders/:id', upload.single('image'), asyncHandler(async (req, res) => {
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

router.delete('/sliders/:id', asyncHandler(async (req, res) => {
  await Slider.findByIdAndDelete(req.params.id);
  req.app.get('io')?.emit('sliders:updated');
  res.json({ success: true });
}));

router.patch('/sliders/reorder', asyncHandler(async (req, res) => {
  const { items } = req.body;
  await Promise.all(items.map(({ id, displayOrder }) => Slider.findByIdAndUpdate(id, { displayOrder })));
  req.app.get('io')?.emit('sliders:updated');
  res.json({ success: true });
}));

// Settings
router.get('/settings', asyncHandler(async (_req, res) => {
  let settings = await SiteSettings.findOne();
  if (!settings) settings = await SiteSettings.create({});
  res.json({ success: true, settings });
}));

router.put('/settings', asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (updates.providerApiKey) {
    updates.providerApiKeyEncrypted = encrypt(updates.providerApiKey);
    delete updates.providerApiKey;
  }

  let settings = await SiteSettings.findOneAndUpdate({}, updates, { new: true, upsert: true });
  req.app.get('io')?.emit('settings:updated');
  res.json({ success: true, settings });
}));

// API provider routing (data bundles + AFA only)
router.get('/api-providers', asyncHandler(async (_req, res) => {
  const config = await serializeApiProviderSettingsForAdmin();
  res.json({ success: true, config });
}));

router.put('/api-providers', asyncHandler(async (req, res) => {
  const config = await updateApiProviderSettings(req.body);
  await logAudit({ user: req.user, action: 'UPDATE', resource: 'ApiProviderSettings', details: req.body, req });

  let autoRetry = null;
  if (req.body.forwardingEnabled === true || req.body.networkProviders) {
    autoRetry = await retryQueuedProviderOrders(req.app.get('io'));
  }

  res.json({ success: true, config, autoRetry });
}));

router.post('/api-providers/test/:providerId', asyncHandler(async (req, res) => {
  const result = await testProviderConnection(req.params.providerId);
  res.json({ success: result.success, ...result });
}));

router.get('/api-providers/datamax/balance', asyncHandler(async (req, res) => {
  const result = await fetchDatamaxBalance();
  const autoRetry = await retryQueuedProviderOrders(req.app.get('io'));
  res.json({ success: true, ...result, autoRetry });
}));

router.get('/api-providers/smart-data-hub/balance', asyncHandler(async (req, res) => {
  const result = await fetchSmartDataHubBalance();
  const autoRetry = await retryQueuedProviderOrders(req.app.get('io'));
  res.json({ success: true, ...result, autoRetry });
}));

router.post('/api-providers/retry-queued', asyncHandler(async (req, res) => {
  const summary = await retryQueuedProviderOrders(req.app.get('io'));
  res.json({ success: true, ...summary });
}));

router.get('/api-providers/queued', asyncHandler(async (_req, res) => {
  const orders = await getQueuedOrders();
  res.json({ success: true, orders });
}));

// Audit logs
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const logs = await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('user', 'name email');
  res.json({ success: true, logs });
}));

export default router;
