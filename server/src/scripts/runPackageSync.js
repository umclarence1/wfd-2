import dotenv from 'dotenv';
import dns from 'dns/promises';
import mongoose from 'mongoose';
import { syncTopDealsPackageIds } from '../services/topdealsPackageSyncService.js';

dotenv.config();

const connect = async () => {
  const srv = process.env.MONGODB_URI;
  const parts = srv.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
  if (!parts) {
    await mongoose.connect(srv);
    return;
  }
  const [, user, pass, host, dbName] = parts;
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  const records = await dns.resolveSrv(`_mongodb._tcp.${host}`);
  const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${records.map((r) => `${r.name}:${r.port}`).join(',')}/${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
};

await connect();
console.log(JSON.stringify(await syncTopDealsPackageIds(), null, 2));
await mongoose.disconnect();
