// Run once to create the first faculty login: node utils/seedFaculty.js
require('dotenv').config();
const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = process.argv[2] || 'admin@college.edu';
  const password = process.argv[3] || 'Admin@123';
  const fullName = process.argv[4] || 'Main Admin';

  const existing = await Faculty.findOne({ email });
  if (existing) {
    console.log('Faculty already exists:', email);
  } else {
    await Faculty.create({ fullName, email, password });
    console.log('Faculty created:', email, '/ password:', password);
  }
  await mongoose.disconnect();
}

seed();
