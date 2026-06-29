import connectDB from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { autoSeedIfEmpty } from '../src/scripts/autoSeed.js';

await connectDB();
await autoSeedIfEmpty();

const app = createApp();
export default app;
