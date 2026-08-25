import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Package from '../models/Package.js';
import {
  buildMtnExpressPackages,
  MTN_EXPRESS_BUNDLES,
  MTN_EXPRESS_DEFAULT_PRICES,
} from '../config/mtnExpressPackages.js';

dotenv.config();

const seedMtnExpress = async () => {
  await connectDB();

  const existing = await Package.find({ category: 'MTN EXPRESS' }).lean();

  if (existing.length === 0) {
    const packages = buildMtnExpressPackages();
    await Package.insertMany(packages);
    console.log(`Created ${packages.length} MTN EXPRESS packages.`);
    process.exit(0);
  }

  let updated = 0;
  for (const size of MTN_EXPRESS_BUNDLES) {
    const price = MTN_EXPRESS_DEFAULT_PRICES[size];
    const result = await Package.updateOne(
      { category: 'MTN EXPRESS', dataAmount: size },
      { $set: { price, name: `MTN EXPRESS ${size}` } }
    );
    if (result.modifiedCount) updated += 1;
  }

  const existingSizes = new Set(existing.map((p) => p.dataAmount));
  const missing = MTN_EXPRESS_BUNDLES.filter((size) => !existingSizes.has(size));
  if (missing.length) {
    const toInsert = buildMtnExpressPackages().filter((p) => missing.includes(p.dataAmount));
    await Package.insertMany(toInsert);
    console.log(`Added ${toInsert.length} missing MTN EXPRESS package(s).`);
  }

  console.log(`Synced MTN EXPRESS prices (${updated} updated, ${existing.length} total).`);
  process.exit(0);
};

seedMtnExpress().catch((err) => {
  console.error(err);
  process.exit(1);
});
