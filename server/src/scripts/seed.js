import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Package from '../models/Package.js';
import Slider from '../models/Slider.js';
import SiteSettings from '../models/SiteSettings.js';
import { DEFAULT_API_PROVIDER_SETTINGS } from '../config/apiProviders.js';

dotenv.config();

const MTN_BUNDLES = ['10GB', '15GB', '20GB', '25GB', '30GB', '35GB', '40GB', '45GB', '50GB', '100GB', '150GB'];
const PRICES = { '10GB': 5, '15GB': 7, '20GB': 10, '25GB': 12, '30GB': 14, '35GB': 16, '40GB': 18, '45GB': 20, '50GB': 22, '100GB': 40, '150GB': 55 };

const seed = async () => {
  await connectDB();
  console.log('Seeding database...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@wds.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      isEmailVerified: true,
    });
    console.log(`Admin created: ${adminEmail}`);
  }

  const packageCount = await Package.countDocuments();
  if (packageCount === 0) {
    const packages = [];

    MTN_BUNDLES.forEach((size, i) => {
      packages.push({
        name: `MTN ${size}`,
        category: 'MTN',
        dataAmount: size,
        price: PRICES[size],
        serviceType: 'data_bundle',
        displayOrder: i,
      });
    });

    ['10GB', '20GB', '50GB'].forEach((size, i) => {
      packages.push({
        name: `Telecel ${size}`,
        category: 'Telecel',
        dataAmount: size,
        price: PRICES[size] || 10,
        serviceType: 'data_bundle',
        displayOrder: i,
      });
    });

    ['10GB', '20GB', '50GB'].forEach((size, i) => {
      packages.push({
        name: `AT Big Time ${size}`,
        category: 'AirtelTigo Big Time',
        dataAmount: size,
        price: PRICES[size] || 10,
        serviceType: 'data_bundle',
        displayOrder: i,
      });
    });

    ['5GB', '10GB', '20GB'].forEach((size, i) => {
      packages.push({
        name: `AirtelTigo ${size}`,
        category: 'AirtelTigo',
        dataAmount: size,
        price: (PRICES[size] || 8) - 1,
        serviceType: 'data_bundle',
        displayOrder: i,
      });
    });

    packages.push(
      { name: 'MTN AFA Registration', category: 'MTN AFA', price: 25, serviceType: 'afa_registration', afaType: 'new', displayOrder: 0 },
      { name: 'BECE Result Checker', category: 'BECE Checker', price: 17, serviceType: 'result_checker', checkerType: 'BECE', displayOrder: 0 },
      { name: 'WASSCE Result Checker', category: 'WASSCE Checker', price: 17, serviceType: 'result_checker', checkerType: 'WASSCE', displayOrder: 0 }
    );

    await Package.insertMany(packages);
    console.log(`Created ${packages.length} packages`);
  }

  const sliderSlides = [
    {
      title: 'MTN Data Bundles',
      description: 'Get instant MTN, Telecel & AirtelTigo data bundles at unbeatable prices.',
      imageUrl: '/images/slider/slide-1.jpg',
      buttonText: 'Buy Data Now',
      buttonUrl: '/services/data/mtn',
      displayOrder: 0,
    },
    {
      title: 'Fast. Easy. Delivered.',
      description: 'Purchase data bundles online and receive them within seconds — no hassle.',
      imageUrl: '/images/slider/slide-2.jpg',
      buttonText: 'Browse Services',
      buttonUrl: '/services',
      displayOrder: 1,
    },
    {
      title: 'Stay Connected Always',
      description: 'Top up your phone with affordable bundles from Ghana\'s leading networks.',
      imageUrl: '/images/slider/slide-3.jpg',
      buttonText: 'Get Started',
      buttonUrl: '/services/data/mtn',
      displayOrder: 2,
    },
    {
      title: 'BECE & WASSCE Result Checkers',
      description: 'Students — get authentic result checkers delivered instantly via email and SMS.',
      imageUrl: '/images/slider/slide-4.jpg',
      buttonText: 'Get Checker',
      buttonUrl: '/services/checkers',
      displayOrder: 3,
    },
  ];

  await Slider.deleteMany({});
  await Slider.insertMany(sliderSlides);
  console.log(`Seeded ${sliderSlides.length} slider slides`);

  console.log('Skipping local checker inventory — stock comes from TopDealsGH API.');

  const settings = await SiteSettings.findOne();
  if (!settings) {
    await SiteSettings.create({
      settingsKey: process.env.SITE_SETTINGS_KEY?.trim() || 'wilberforcedataservice.com',
      siteName: 'Wilberforce Data Service',
      tagline: 'Fast, reliable digital services in Ghana',
      contactEmail: '',
      contactPhone: '0595399837',
      address: 'Sunyani',
      apiProviderSettings: DEFAULT_API_PROVIDER_SETTINGS(),
    });
    console.log('Created site settings (TopDealsGH defaults)');
  }

  console.log('Seed completed!');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
