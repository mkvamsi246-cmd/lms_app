const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MongoDB connection error: MONGO_URI environment variable is missing.');
    process.exit(1);
  }

  const options = {
    serverSelectionTimeoutMS: 15000,
  };

  // Only apply family: 4 if NOT on cloud environment or if direct non-srv URI is used
  if (!uri.includes('+srv')) {
    options.family = 4;
  }

  try {
    await mongoose.connect(uri, options);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB primary connection error:', err.message);
    if (uri.includes('+srv')) {
      console.log('Attempting connection retry with fallback DNS options...');
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
        console.log('MongoDB connected on retry');
        return;
      } catch (retryErr) {
        console.error('Retry connection failed:', retryErr.message);
      }
    }
    process.exit(1);
  }
};

module.exports = connectDB;
