import { Router } from 'express';
import Slider from '../models/Slider.js';
import SiteSettings from '../models/SiteSettings.js';
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
    const {
      providerApiKeyEncrypted,
      contactEmail,
      apiProviderSettings,
      paystackPublicKey,
      ...publicSettings
    } = settings;

    res.json({
      success: true,
      settings: {
        ...publicSettings,
        paystackPublicKey: paystackPublicKey || process.env.PAYSTACK_PUBLIC_KEY || '',
      },
    });
  })
);

router.get(
  '/promos',
  noCache,
  asyncHandler(async (_req, res) => {
    const settings = await SiteSettings.findOne().lean();
    if (!settings?.promoCheckoutEnabled) {
      return res.json({ success: true, promos: [], promoCheckoutEnabled: false });
    }

    res.json({
      success: true,
      promoCheckoutEnabled: true,
      message: 'Promo codes can be applied at checkout when enabled by the store.',
      promos: [],
    });
  })
);

export default router;
