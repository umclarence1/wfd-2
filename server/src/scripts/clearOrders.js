import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { purgeAllOrders } from '../services/orderPurgeService.js';

dotenv.config();

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('Connected to MongoDB');

  const result = await purgeAllOrders();
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
  console.log('Done — order history cleared for production.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
