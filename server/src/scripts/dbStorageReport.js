import dotenv from 'dotenv';
import dns from 'dns/promises';
import mongoose from 'mongoose';

dotenv.config();

const fmt = (bytes) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
};

const buildDirectUri = async (srvUri) => {
  const match = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
  if (!match) throw new Error('Invalid MONGODB_URI format.');
  const [, user, pass, host, dbName] = match;
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  const records = await dns.resolveSrv(`_mongodb._tcp.${host}`);
  const hosts = records.map((r) => `${r.name}:${r.port}`).join(',');
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hosts}/${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;
};

const ATLAS_FREE_TIER_LIMIT_BYTES = 512 * 1024 * 1024;

const main = async () => {
  const srvUri = process.env.MONGODB_URI;
  if (!srvUri) throw new Error('MONGODB_URI is not set.');

  const uri = srvUri.startsWith('mongodb+srv://') ? await buildDirectUri(srvUri) : srvUri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 45000 });

  const db = mongoose.connection.db;
  const stats = await db.stats({ scale: 1 });
  const collections = await db.listCollections().toArray();
  const colStats = [];

  for (const col of collections) {
    const s = await db.command({ collStats: col.name, scale: 1 });
    colStats.push({
      name: col.name,
      storage: s.storageSize || s.size || 0,
      count: s.count || 0,
    });
  }

  colStats.sort((a, b) => b.storage - a.storage);

  const totalUsedBytes = (stats.storageSize || 0) + (stats.indexSize || 0);
  const clusterHost = srvUri.match(/@([^/]+)/)?.[1] || 'unknown';

  console.log(
    JSON.stringify(
      {
        cluster: clusterHost,
        database: stats.db,
        collections: stats.collections,
        documents: stats.objects,
        dataSize: fmt(stats.dataSize),
        storageSize: fmt(stats.storageSize),
        indexSize: fmt(stats.indexSize),
        totalUsed: fmt(totalUsedBytes),
        totalUsedBytes,
        estimatedFreeTierLimit: fmt(ATLAS_FREE_TIER_LIMIT_BYTES),
        estimatedSpaceRemainingOnFreeTier: fmt(Math.max(0, ATLAS_FREE_TIER_LIMIT_BYTES - totalUsedBytes)),
        estimatedFreeTierUsedPercent: `${Math.min(100, ((totalUsedBytes / ATLAS_FREE_TIER_LIMIT_BYTES) * 100).toFixed(1))}%`,
        topCollections: colStats.slice(0, 10).map((c) => ({
          name: c.name,
          storage: fmt(c.storage),
          documents: c.count,
        })),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
