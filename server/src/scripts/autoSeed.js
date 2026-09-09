import User from '../models/User.js';
import Package from '../models/Package.js';
import Order from '../models/Order.js';
import Slider from '../models/Slider.js';
import SiteSettings from '../models/SiteSettings.js';
import { ensureSiteSettings } from '../services/siteSettingsService.js';
import {
  buildMtnExpressPackages,
  MTN_EXPRESS_BUNDLES,
  MTN_EXPRESS_DEFAULT_PRICES,
} from '../config/mtnExpressPackages.js';
import { ensureCheckerPackages, syncCheckerPackageAvailability } from '../services/checkerService.js';

const MTN_BUNDLES = ['10GB', '15GB', '20GB', '25GB', '30GB', '35GB', '40GB', '45GB', '50GB', '100GB', '150GB'];
const PRICES = { '10GB': 5, '15GB': 7, '20GB': 10, '25GB': 12, '30GB': 14, '35GB': 16, '40GB': 18, '45GB': 20, '50GB': 22, '100GB': 40, '150GB': 55 };

const buildInitialPackages = () => {
  const packages = [];
  MTN_BUNDLES.forEach((size, i) => {
    packages.push({ name: `MTN ${size}`, category: 'MTN', dataAmount: size, price: PRICES[size], serviceType: 'data_bundle', displayOrder: i, isActive: true, isAvailable: true });
  });
  buildMtnExpressPackages().forEach((pkg) => packages.push(pkg));
  ['10GB', '20GB', '50GB'].forEach((size, i) => {
    packages.push({ name: `Telecel ${size}`, category: 'Telecel', dataAmount: size, price: PRICES[size] || 10, serviceType: 'data_bundle', displayOrder: i, isActive: true, isAvailable: true });
  });
  ['10GB', '20GB', '50GB'].forEach((size, i) => {
    packages.push({ name: `AT Big Time ${size}`, category: 'AirtelTigo Big Time', dataAmount: size, price: PRICES[size] || 10, serviceType: 'data_bundle', displayOrder: i, isActive: true, isAvailable: true });
  });
  ['5GB', '10GB', '20GB'].forEach((size, i) => {
    packages.push({ name: `AirtelTigo ${size}`, category: 'AirtelTigo', dataAmount: size, price: (PRICES[size] || 8) - 1, serviceType: 'data_bundle', displayOrder: i, isActive: true, isAvailable: true });
  });
  packages.push(
    { name: 'MTN AFA Registration', category: 'MTN AFA', price: 25, serviceType: 'afa_registration', afaType: 'new', displayOrder: 0, isActive: true, isAvailable: true },
    { name: 'BECE Result Checker', category: 'BECE Checker', price: 17, serviceType: 'result_checker', checkerType: 'BECE', displayOrder: 0, isActive: true, isAvailable: true },
    { name: 'WASSCE Result Checker', category: 'WASSCE Checker', price: 17, serviceType: 'result_checker', checkerType: 'WASSCE', displayOrder: 0, isActive: true, isAvailable: true }
  );
  return packages;
};

/** Ensure all MTN EXPRESS bundle sizes exist (fulfilled via Smart Data Hub as MTN). */
const ensureMtnExpressPackages = async () => {
  const existing = await Package.find({ category: 'MTN EXPRESS' }).lean();
  if (!existing.length) {
    const packages = buildMtnExpressPackages();
    await Package.insertMany(packages);
    console.log(`Created ${packages.length} MTN EXPRESS packages`);
    return;
  }

  const existingSizes = new Set(existing.map((p) => p.dataAmount));
  const missing = MTN_EXPRESS_BUNDLES.filter((size) => !existingSizes.has(size));
  if (missing.length) {
    const toInsert = buildMtnExpressPackages().filter((p) => missing.includes(p.dataAmount));
    await Package.insertMany(toInsert);
    console.log(`Added ${toInsert.length} missing MTN EXPRESS package(s)`);
  }

  for (const size of MTN_EXPRESS_BUNDLES) {
    const price = MTN_EXPRESS_DEFAULT_PRICES[size];
    await Package.updateOne(
      { category: 'MTN EXPRESS', dataAmount: size },
      { $set: { price, name: `MTN EXPRESS ${size}`, isActive: true, adminPaused: false } }
    );
  }
};

export const autoSeedIfEmpty = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  let admin = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
  if (!admin) {
    if (isProduction) {
      if (!adminEmail || !adminPassword || adminPassword === 'Admin@123456') {
        throw new Error(
          'No admin user found. Set strong ADMIN_EMAIL and ADMIN_PASSWORD before first production boot.'
        );
      }
    }

    const email = adminEmail || 'admin@wds.com';
    const password = adminPassword || 'Admin@123456';

    console.log('Empty database detected — running auto-seed...');
    admin = await User.create({
      name: 'Admin',
      email,
      password,
      role: 'admin',
      isEmailVerified: true,
    });
    console.log(`Admin created: ${email}`);
  }

  if ((await Package.countDocuments()) === 0) {
    await Package.insertMany(buildInitialPackages());
    console.log('Created initial packages');
  }

  if ((await Package.countDocuments({ category: 'MTN' })) === 0) {
    const mtnPackages = MTN_BUNDLES.map((size, i) => ({
      name: `MTN ${size}`,
      category: 'MTN',
      dataAmount: size,
      price: PRICES[size],
      serviceType: 'data_bundle',
      displayOrder: i,
      isActive: true,
      isAvailable: true,
      adminPaused: false,
    }));
    await Package.insertMany(mtnPackages);
    console.log(`Created ${mtnPackages.length} MTN packages`);
  }

  await ensureMtnExpressPackages();

  await Package.updateMany(
    { category: 'MTN AFA', afaType: 'new', name: { $ne: 'MTN AFA Registration' } },
    { $set: { name: 'MTN AFA Registration' } }
  );

  if ((await Slider.countDocuments()) === 0) {
    await Slider.insertMany([
      { title: 'MTN Data Bundles', description: 'Get instant MTN, Telecel & AirtelTigo data bundles at unbeatable prices.', imageUrl: '/images/slider/slide-1.jpg', buttonText: 'Buy Data Now', buttonUrl: '/services/data/mtn', displayOrder: 0 },
      { title: 'Fast. Easy. Delivered.', description: 'Purchase data bundles online and receive them within seconds.', imageUrl: '/images/slider/slide-2.jpg', buttonText: 'Browse Services', buttonUrl: '/services', displayOrder: 1 },
      { title: 'Stay Connected Always', description: 'Top up your phone with affordable bundles from Ghana\'s leading networks.', imageUrl: '/images/slider/slide-3.jpg', buttonText: 'Get Started', buttonUrl: '/services/data/mtn', displayOrder: 2 },
      { title: 'BECE & WASSCE Result Checkers', description: 'Students — get authentic result checkers delivered instantly.', imageUrl: '/images/slider/slide-4.jpg', buttonText: 'Get Checker', buttonUrl: '/services/checkers', displayOrder: 3 },
    ]);
  }

  // Checkers are fulfilled via TopDealsGH stock/API — do not seed local PIN inventory.
  await ensureCheckerPackages();
  try {
    await syncCheckerPackageAvailability();
  } catch (err) {
    console.error('[CHECKER_STOCK] Boot sync failed:', err.message);
  }

  // Remove abandoned unpaid orders (checkout intent only — no order until Paystack confirms).
  const removedUnpaid = await Order.deleteMany({
    paymentStatus: { $ne: 'paid' },
    isFreeOrder: { $ne: true },
  });
  if (removedUnpaid.deletedCount) {
    console.log(`Removed ${removedUnpaid.deletedCount} unpaid order(s) from legacy checkout flow.`);
  }

  // Paid orders should never sit at pending/failed in admin.
  const repairedPaid = await Order.updateMany(
    { paymentStatus: 'paid', deliveryStatus: { $in: ['pending', 'failed'] } },
    {
      $set: {
        deliveryStatus: 'processing',
        failureReason: 'Payment received — your order is being processed.',
      },
    }
  );
  if (repairedPaid.modifiedCount) {
    console.log(`Set ${repairedPaid.modifiedCount} paid order(s) to processing.`);
  }

  await Package.updateMany(
    { category: 'MTN AFA', afaType: { $in: ['renewal', 'status_check'] } },
    { isActive: false, isAvailable: false }
  );

  const existingSettings = await ensureSiteSettings();
  if (!existingSettings) {
    await SiteSettings.create({
      siteName: 'Wilberforce Data Service',
      tagline: 'Fast, reliable digital services in Ghana',
      contactEmail: '',
      contactPhone: '0595399837',
      address: 'Sunyani',
    });
  } else {
    if (/smartdeals/i.test(existingSettings.tagline || '') || existingSettings.siteName === 'wilberforcedataservice') {
      if (/smartdeals/i.test(existingSettings.tagline || '')) {
        existingSettings.tagline = 'Fast, reliable digital services in Ghana';
      }
      if (existingSettings.siteName === 'wilberforcedataservice') {
        existingSettings.siteName = 'Wilberforce Data Service';
      }
    }
    if (['+233 24 000 0000', '+233 XX XXX XXXX'].includes(existingSettings.contactPhone)) {
      existingSettings.contactPhone = '0595399837';
    }
    if (existingSettings.address === 'Accra, Ghana') {
      existingSettings.address = 'Sunyani';
    }
    await existingSettings.save();
  }

  console.log('Auto-seed completed.');
};
