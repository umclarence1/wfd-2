import mongoose from 'mongoose';

let memoryServer = null;

const getCached = () => {
  if (!global.mongooseCache) {
    global.mongooseCache = { conn: null, promise: null };
  }
  return global.mongooseCache;
};

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !uri) {
    throw new Error('MONGODB_URI is not configured on the server.');
  }

  const targetUri = uri || 'mongodb://127.0.0.1:27017/wds';
  const cache = getCached();

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: isProduction ? 15000 : 4000,
      bufferCommands: false,
    });
  }

  try {
    cache.conn = await cache.promise;
    console.log('MongoDB connected');
    return cache.conn;
  } catch (err) {
    cache.promise = null;

    if (isProduction) {
      throw new Error(`Could not connect to MongoDB: ${err.message}`);
    }

    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    cache.promise = mongoose.connect(memoryServer.getUri('wds'));
    cache.conn = await cache.promise;
    console.log('MongoDB connected (in-memory dev database)');
    return cache.conn;
  }
};

export default connectDB;
