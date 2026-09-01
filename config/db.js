const mongoose = require('mongoose');
const dns = require('dns');

// Fix Render container DNS SRV lookup issue by overriding DNS resolvers to Google & Cloudflare DNS
try {
  if (dns.setServers) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {}

const DEFAULT_URI = 'mongodb+srv://mkvamsi246_db_user:ue4UmW74H1iJOUm8@cluster0.aekeytz.mongodb.net/lms?retryWrites=true&w=majority';

const connectDB = async () => {
  const uri = (process.env.MONGO_URI || DEFAULT_URI).trim();

  const strategies = [
    { name: 'Google DNS Direct Connection', options: { serverSelectionTimeoutMS: 15000 } },
    { name: 'IPv4 Connection', options: { serverSelectionTimeoutMS: 15000, family: 4 } },
    { name: 'TLS Connection', options: { serverSelectionTimeoutMS: 15000, ssl: true, tls: true } },
    { name: 'Direct Replica Set Fallback', uri: 'mongodb://mkvamsi246_db_user:ue4UmW74H1iJOUm8@cluster0-shard-00-00.aekeytz.mongodb.net:27017,cluster0-shard-00-01.aekeytz.mongodb.net:27017,cluster0-shard-00-02.aekeytz.mongodb.net:27017/lms?ssl=true&replicaSet=atlas-13o69h-shard-0&authSource=admin&retryWrites=true&w=majority', options: { serverSelectionTimeoutMS: 15000 } }
  ];

  for (const strategy of strategies) {
    const targetUri = strategy.uri || uri;
    try {
      console.log(`Connecting to MongoDB using strategy: ${strategy.name}...`);
      await mongoose.connect(targetUri, strategy.options);
      console.log('✅ MongoDB connected successfully');
      return;
    } catch (err) {
      console.warn(`Strategy '${strategy.name}' failed: ${err.message}`);
    }
  }

  console.error('❌ All MongoDB connection strategies failed.');
  process.exit(1);
};

module.exports = connectDB;
