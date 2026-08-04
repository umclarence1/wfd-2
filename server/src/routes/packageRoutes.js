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
import { resolveCheckerInStock, syncCheckerPackageAvailability } from '../services/checkerService.js';
import { withPublicAvailability } from '../utils/packageAvailability.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, serviceType } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (serviceType) filter.serviceType = serviceType;

    // Local DB only — do not wait on TopDealsGH here (that was making /packages 2–3s+).
    // Checker stock is mirrored onto Package.isAvailable by background sync.
    const packages = await Package.find(filter)
      .sort({ displayOrder: 1, price: 1 })
      .select(
        'name category serviceType dataAmount price description displayOrder isActive isAvailable adminPaused checkerType afaType'
      )
      .lean();

    const withStock = packages.map((pkg) => {
      if (pkg.serviceType === 'result_checker') {
        const inStock = pkg.adminPaused ? false : pkg.isAvailable !== false;
        return withPublicAvailability(pkg, { inStock });
      }
      return withPublicAvailability(pkg);
    });

    // Refresh stock in the background so the next request stays accurate.
    if (packages.some((pkg) => pkg.serviceType === 'result_checker')) {
      syncCheckerPackageAvailability().catch((err) => {
        console.error('[CHECKER_STOCK] Background sync failed:', err.message);
      });
    }

    // Short CDN/browser cache — packages change rarely; stock is still enforced at checkout.
    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
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
