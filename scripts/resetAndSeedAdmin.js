require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Course = require('../models/Course');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Roadmap = require('../models/Roadmap');
const Submission = require('../models/Submission');
const Message = require('../models/Message');

async function resetAndSeedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      family: 4
    });
    console.log('Connected to MongoDB Atlas');

    console.log('Clearing all portal data...');
    await Student.deleteMany({});
    await Course.deleteMany({});
    await Test.deleteMany({});
    await Question.deleteMany({});
    await Roadmap.deleteMany({});
    await Submission.deleteMany({});
    await Message.deleteMany({});
    await Faculty.deleteMany({});

    console.log('Creating Admin Faculty Account...');

    // Create Faculty Admin with email/username dvsrkraju and password 1234
    const admin = await Faculty.create({
      fullName: 'DVSRK Raju',
      email: 'dvsrkraju',
      password: '1234'
    });

    console.log('✅ Portal Data Reset Complete!');
    console.log(`Admin Account Created:`);
    console.log(`- Username/Email: dvsrkraju`);
    console.log(`- Password: 1234`);
    console.log(`- ID: ${admin._id}`);

    process.exit(0);
  } catch (err) {
    console.error('Reset Failed:', err);
    process.exit(1);
  }
}

resetAndSeedAdmin();
