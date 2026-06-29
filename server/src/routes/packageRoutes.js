import { Router } from 'express';
import Package from '../models/Package.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { noCache } from '../middleware/auth.js';
import { getPaymentBreakdown } from '../services/orderService.js';
import { validatePromoCode } from '../services/promoService.js';
import { checkStock } from '../services/checkerService.js';

const router = Router();

router.get(
  '/',
  noCache,
  asyncHandler(async (req, res) => {
    const { category, serviceType } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (serviceType) filter.serviceType = serviceType;

    const packages = await Package.find(filter).sort({ displayOrder: 1, price: 1 }).lean();

    const withStock = await Promise.all(
      packages.map(async (pkg) => {
        if (pkg.serviceType === 'result_checker') {
          const inStock = await checkStock(pkg.checkerType);
          return { ...pkg, inStock, isAvailable: pkg.isAvailable && inStock };
        }
        return { ...pkg, inStock: true };
      })
    );

    res.json({ success: true, packages: withStock });
  })
);

router.get(
  '/categories',
  noCache,
  asyncHandler(async (_req, res) => {
    const categories = await Package.distinct('category', { isActive: true });
    res.json({ success: true, categories });
  })
);

router.get(
  '/:id',
  noCache,
  asyncHandler(async (req, res) => {
    const pkg = await Package.findById(req.params.id).lean();
    if (!pkg || !pkg.isActive) {
      return res.status(404).json({ success: false, message: 'Package not found.' });
    }

    if (pkg.serviceType === 'result_checker') {
      const inStock = await checkStock(pkg.checkerType);
      pkg.inStock = inStock;
      pkg.isAvailable = pkg.isAvailable && inStock;
    }

    res.json({ success: true, package: pkg });
  })
);

router.post(
  '/:id/breakdown',
  noCache,
  asyncHandler(async (req, res) => {
    const pkg = await Package.findById(req.params.id);
    if (!pkg || !pkg.isActive || !pkg.isAvailable) {
      return res.status(400).json({ success: false, message: 'Package unavailable.' });
    }

    if (pkg.serviceType === 'result_checker') {
      const inStock = await checkStock(pkg.checkerType);
      if (!inStock) {
        return res.status(400).json({
          success: false,
          message: 'This checker is currently out of stock. Please check back later.',
          code: 'OUT_OF_STOCK',
        });
      }
    }

    let promoResult = null;
    if (req.body.promoCode) {
      try {
        promoResult = await validatePromoCode({
          code: req.body.promoCode,
          packageId: pkg._id,
          category: pkg.category,
          email: req.body.email || 'guest@example.com',
          phone: req.body.phone || '0000000000',
        });
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid or expired promo code.' });
      }
    }

    const breakdown = getPaymentBreakdown(pkg.price, promoResult);
    res.json({ success: true, breakdown, package: { id: pkg._id, name: pkg.name, price: pkg.price } });
  })
);

export default router;
