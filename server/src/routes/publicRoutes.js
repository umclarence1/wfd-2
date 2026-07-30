import { Router } from 'express';
import Slider from '../models/Slider.js';
import { getSiteSettings } from '../services/siteSettingsService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { noCache } from '../middleware/auth.js';
import { toPublicSiteSettings } from '../utils/customerSafe.js';

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
    const settings = await getSiteSettings(true);
    const {
      providerApiKeyEncrypted,
      contactEmail,
      apiProviderSettings,
      paystackPublicKey,
      providerApiUrl,
      ...publicSettings
    } = settings;

    res.json({
      success: true,
      settings: toPublicSiteSettings({
        ...publicSettings,
        paystackPublicKey: paystackPublicKey || process.env.PAYSTACK_PUBLIC_KEY || '',
      }),
    });
  })
);

router.get(
  '/promos',
  noCache,
  asyncHandler(async (_req, res) => {
    const settings = await getSiteSettings(true);
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
