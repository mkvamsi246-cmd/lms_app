const mongoose = require('mongoose');
const dns = require('dns');

// Override DNS resolvers for cloud hosting containers (Render)
try {
  if (dns.setServers) {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  }
} catch (e) {}

const HARDCODED_URI = 'mongodb+srv://mkvamsi246_db_user:ue4UmW74H1iJOUm8@cluster0.aekeytz.mongodb.net/lms?retryWrites=true&w=majority';

function cleanUri(raw) {
  if (!raw) return HARDCODED_URI;
  let s = raw.trim();
  s = s.replace(/^["']|["']$/g, ''); // strip leading/trailing quotes if user pasted quotes on Render
  return s || HARDCODED_URI;
}

const connectDB = async () => {
  const envUri = cleanUri(process.env.MONGO_URI);
  console.log(`[DB Setup] Initializing connection to MongoDB Atlas...`);

  const strategies = [
    { name: 'Environment MONGO_URI', uri: envUri, options: { serverSelectionTimeoutMS: 15000 } },
    { name: 'Hardcoded Verified Atlas URI', uri: HARDCODED_URI, options: { serverSelectionTimeoutMS: 15000 } },
    { name: 'IPv4 Explicit Family', uri: HARDCODED_URI, options: { serverSelectionTimeoutMS: 15000, family: 4 } },
    { name: 'Direct Replica Set Seed List', uri: 'mongodb://mkvamsi246_db_user:ue4UmW74H1iJOUm8@cluster0-shard-00-00.aekeytz.mongodb.net:27017,cluster0-shard-00-01.aekeytz.mongodb.net:27017,cluster0-shard-00-02.aekeytz.mongodb.net:27017/lms?ssl=true&replicaSet=atlas-13o69h-shard-0&authSource=admin&retryWrites=true&w=majority', options: { serverSelectionTimeoutMS: 15000 } }
  ];

  for (const strategy of strategies) {
    try {
      console.log(`Attempting DB connection via '${strategy.name}'...`);
      await mongoose.connect(strategy.uri, strategy.options);
      console.log(`✅ MongoDB connected successfully using '${strategy.name}'!`);
      return;
    } catch (err) {
      console.warn(`⚠️ '${strategy.name}' failed: ${err.message}`);
    }
  }

  console.error('❌ All MongoDB connection strategies failed.');
  process.exit(1);
};

module.exports = connectDB;
