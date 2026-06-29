import mongoose from 'mongoose';

let memoryServer = null;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wds';

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log('MongoDB connected');
    return;
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Could not connect to MongoDB');
    }
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('wds'));
  console.log('MongoDB connected (in-memory dev database)');
};

export default connectDB;
