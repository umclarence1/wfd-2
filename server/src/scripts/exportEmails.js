import dotenv from 'dotenv';
import dns from 'dns/promises';
import mongoose from 'mongoose';

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
const db = mongoose.connection.db;

const orderEmails = await db.collection('orders').distinct('email');
const userEmails = await db.collection('users').distinct('email');
const pendingEmails = await db.collection('pendingpayments').distinct('email');
const settings = await db.collection('sitesettings').findOne({}, { projection: { contactEmail: 1 } });

const all = [...new Set([...orderEmails, ...userEmails, ...pendingEmails, settings?.contactEmail].filter(Boolean))]
  .map((e) => String(e).trim().toLowerCase())
  .filter((e) => e.includes('@'))
  .sort();

console.log(all.join('\n'));
console.error(`\n--- Total: ${all.length} unique email(s) ---`);

await mongoose.disconnect();
