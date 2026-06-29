import { Router } from 'express';
import Slider from '../models/Slider.js';
import SiteSettings from '../models/SiteSettings.js';
import PromoCode from '../models/PromoCode.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { noCache } from '../middleware/auth.js';

const router = Router();

router.get(
  '/sliders',
  noCache,
  asyncHandler(async (_req, res) => {
    const sliders = await Slider.find({ isActive: true }).sort({ displayOrder: 1 }).lean();
    res.json({ success: true, sliders });
  })
);

router.get(
  '/settings',
  noCache,
  asyncHandler(async (_req, res) => {
    let settings = await SiteSettings.findOne().lean();
    if (!settings) {
      settings = await SiteSettings.create({});
    }
    const { providerApiKeyEncrypted, contactEmail, ...publicSettings } = settings;
    res.json({ success: true, settings: publicSettings });
  })
);

router.get(
  '/promos',
  noCache,
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const promos = await PromoCode.find({
      isActive: true,
      expiryDate: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .select('code description discountType discountValue expiryDate usageLimit usageCount createdAt')
      .lean();

    res.json({
      success: true,
      promos: promos.filter((promo) => promo.usageLimit === null || promo.usageCount < promo.usageLimit),
    });
  })
);

export default router;
