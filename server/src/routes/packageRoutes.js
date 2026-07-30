import { Router } from 'express';
import Package from '../models/Package.js';
import { getSiteSettings } from '../services/siteSettingsService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { noCache } from '../middleware/auth.js';
import { promoLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { packageBreakdownSchema } from '../schemas/zodSchemas.js';
import { getPaymentBreakdown } from '../services/orderService.js';
import { validatePromoCode } from '../services/promoService.js';
import { resolveCheckerInStock, getCheckerStockMap } from '../services/checkerService.js';
import { withPublicAvailability } from '../utils/packageAvailability.js';

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

    const hasChecker = packages.some((pkg) => pkg.serviceType === 'result_checker');
    // One cached TopDealsGH /checker call (60s TTL) — mirrors out-of-stock on the storefront.
    const stockMap = hasChecker ? await getCheckerStockMap() : null;

    const withStock = packages.map((pkg) => {
      if (pkg.serviceType === 'result_checker') {
        const type = String(pkg.checkerType || '').toUpperCase();
        const inStock = pkg.adminPaused ? false : stockMap?.[type] === true;
        return withPublicAvailability(pkg, { inStock });
      }
      return withPublicAvailability(pkg);
    });

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
      const inStock = await resolveCheckerInStock(pkg.checkerType);
      return res.json({ success: true, package: withPublicAvailability(pkg, { inStock }) });
    }

    res.json({ success: true, package: withPublicAvailability(pkg) });
  })
);

router.post(
  '/:id/breakdown',
  noCache,
  promoLimiter,
  validateBody(packageBreakdownSchema),
  asyncHandler(async (req, res) => {
    const pkg = await Package.findById(req.params.id);
    if (!pkg || !pkg.isActive || pkg.adminPaused) {
      return res.status(400).json({ success: false, message: 'Package unavailable.' });
    }

    if (pkg.serviceType === 'result_checker') {
      const inStock = await resolveCheckerInStock(pkg.checkerType);
      if (!inStock) {
        return res.status(400).json({
          success: false,
          message: 'This checker is currently out of stock. Please check back later.',
          code: 'OUT_OF_STOCK',
        });
      }
    } else if (!pkg.isAvailable) {
      return res.status(400).json({ success: false, message: 'Package unavailable.' });
    }

    let promoResult = null;
    if (req.body.promoCode) {
      const settings = await getSiteSettings(true);
      if (!settings?.promoCheckoutEnabled) {
        return res.status(400).json({ success: false, message: 'Promo codes are not available at this time.' });
      }

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
