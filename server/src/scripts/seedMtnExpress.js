import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Package from '../models/Package.js';
import { buildMtnExpressPackages } from '../config/mtnExpressPackages.js';

dotenv.config();

const seedMtnExpress = async () => {
  await connectDB();

  const existing = await Package.countDocuments({ category: 'MTN EXPRESS' });
  if (existing > 0) {
    console.log(`MTN EXPRESS already has ${existing} package(s) — skipping.`);
    process.exit(0);
  }

  const packages = buildMtnExpressPackages();
  await Package.insertMany(packages);
  console.log(`Created ${packages.length} MTN EXPRESS packages.`);
  process.exit(0);
};

seedMtnExpress().catch((err) => {
  console.error(err);
  process.exit(1);
});
