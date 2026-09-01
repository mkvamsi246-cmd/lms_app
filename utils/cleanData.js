require('dotenv').config();
const mongoose = require('mongoose');

async function cleanData() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { family: 4 });
    console.log('Connected to MongoDB for data cleanup...');

    const db = mongoose.connection.db;

    // Collections to clear
    const collectionsToClear = ['students', 'roadmaps', 'tests', 'questions', 'submissions', 'courses', 'messages'];

    for (const name of collectionsToClear) {
      try {
        const collections = await db.listCollections({ name }).toArray();
        if (collections.length > 0) {
          await db.collection(name).deleteMany({});
          console.log(`Cleared collection: ${name}`);
        }
      } catch (err) {
        console.log(`Could not clear ${name}: ${err.message}`);
      }
    }

    // Ensure Faculty admin account exists
    const Faculty = require('../models/Faculty');
    const email = 'admin@college.edu';
    const password = 'Admin@123';
    const fullName = 'Main Admin';

    const existingFaculty = await Faculty.findOne({ email });
    if (!existingFaculty) {
      await Faculty.create({ fullName, email, password });
      console.log(`Created default faculty account: ${email} / ${password}`);
    } else {
      console.log(`Faculty account preserved: ${email}`);
    }

    console.log('Data cleanup completed successfully!');
  } catch (err) {
    console.error('Error during data cleanup:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

cleanData();
