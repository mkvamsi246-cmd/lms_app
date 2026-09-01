const mongoose = require('mongoose');

const FALLBACK_URI = 'mongodb://mkvamsi246_db_user:ue4UmW74H1iJOUm8@ac-l3ozfot-shard-00-00.9kkwj0q.mongodb.net:27017,ac-l3ozfot-shard-00-01.9kkwj0q.mongodb.net:27017,ac-l3ozfot-shard-00-02.9kkwj0q.mongodb.net:27017/lms_app?ssl=true&replicaSet=atlas-7itbyl-shard-0&authSource=admin&retryWrites=true&w=majority';

function cleanUri(raw) {
  if (!raw) return FALLBACK_URI;
  let s = raw.trim();
  s = s.replace(/^["']|["']$/g, ''); // strip leading/trailing quotes if pasted
  return s || FALLBACK_URI;
}

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  const primaryUri = cleanUri(process.env.MONGO_URI);
  console.log(`[DB Setup] Initializing connection to MongoDB...`);

  const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

  const strategies = [
    { name: 'Environment MONGO_URI', uri: primaryUri, options: { serverSelectionTimeoutMS: 5000 } }
  ];

  if (primaryUri !== FALLBACK_URI) {
    strategies.push({ name: 'Verified Atlas Replica Set', uri: FALLBACK_URI, options: { serverSelectionTimeoutMS: 5000 } });
  }

  // Only attempt localhost if NOT running in cloud/production/Vercel
  if (!isVercel) {
    strategies.push({ name: 'Localhost MongoDB', uri: 'mongodb://127.0.0.1:27017/lms_app', options: { serverSelectionTimeoutMS: 3000 } });
  }

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

  console.error('\n❌ All MongoDB connection strategies failed.');
  console.error('👉 ACTION REQUIRED (MongoDB Atlas IP Whitelist):');
  console.error('1. Log in to https://cloud.mongodb.com/');
  console.error('2. Navigate to Network Access under Security.');
  console.error('3. Click "+ Add IP Address" -> "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0).');
  console.error('4. Click Confirm and wait 1-2 minutes for settings to apply.\n');

  // Do NOT exit process in production / Vercel serverless containers
  if (!isVercel) {
    process.exit(1);
  }
};

module.exports = connectDB;


