const express = require('express');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

const router = express.Router();

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// GET dropdown options for registration form
router.get('/student/options', (req, res) => {
  res.json({
    branches: Student.BRANCHES,
    sections: Student.SECTIONS,
    years: Student.YEARS
  });
});

// STUDENT REGISTER
router.post('/student/register', async (req, res) => {
  try {
    const { fullName, branch, section, year, regdNo, phone, password } = req.body;

    if (!fullName || !branch || !section || !year || !regdNo || !phone) {
      return res.status(400).json({ message: 'Full Name, Branch, Section, Year, Regd No, and Phone Number are required' });
    }

    const cleanRegdNo = regdNo.trim().toUpperCase();
    const existing = await Student.findOne({ regdNo: cleanRegdNo });
    if (existing) {
      return res.status(409).json({ message: 'Registration number already registered' });
    }

    // Default initial password is the Registration Number (cleanRegdNo) unless a custom valid password was supplied
    const initialPassword = (password && password.trim()) ? password.trim() : cleanRegdNo;

    const student = await Student.create({
      fullName: fullName.trim(),
      branch,
      section,
      year,
      regdNo: cleanRegdNo,
      phone: phone.trim(),
      password: initialPassword,
      lastLogin: new Date()
    });

    const token = signToken(student._id, 'student');

    res.status(201).json({
      token,
      user: {
        id: student._id,
        fullName: student.fullName,
        branch: student.branch,
        section: student.section,
        year: student.year,
        regdNo: student.regdNo,
        phone: student.phone,
        role: 'student'
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// STUDENT FORGOT PASSWORD
router.post('/student/forgot-password', async (req, res) => {
  try {
    const { regdNo, phone, newPassword } = req.body;
    if (!regdNo || !phone || !newPassword) {
      return res.status(400).json({ message: 'Registration Number, Phone Number, and New Password are required' });
    }

    const cleanRegdNo = regdNo.trim().toUpperCase();
    const cleanPhone = phone.trim();

    const student = await Student.findOne({ regdNo: cleanRegdNo });
    if (!student || student.phone !== cleanPhone) {
      return res.status(400).json({ message: 'Registration Number and Phone Number do not match our records' });
    }

    student.password = newPassword.trim();
    await student.save();

    res.json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// STUDENT LOGIN
router.post('/student/login', async (req, res) => {
  try {
    const { regdNo, password } = req.body;
    const student = await Student.findOne({ regdNo: (regdNo || '').toUpperCase() });
    if (!student || !(await student.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid registration number or password' });
    }
    student.lastLogin = new Date();
    await student.save();

    const token = signToken(student._id, 'student');
    res.json({
      token,
      user: {
        id: student._id,
        fullName: student.fullName,
        branch: student.branch,
        section: student.section,
        year: student.year,
        regdNo: student.regdNo,
        phone: student.phone,
        role: 'student'
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// FACULTY LOGIN
router.post('/faculty/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanIdentifier = (email || '').trim().toLowerCase();
    const faculty = await Faculty.findOne({
      $or: [
        { email: cleanIdentifier },
        { email: `${cleanIdentifier}@college.edu` }
      ]
    });
    if (!faculty || !(await faculty.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }
    const token = signToken(faculty._id, 'faculty');
    res.json({
      token,
      user: { id: faculty._id, fullName: faculty.fullName, email: faculty.email, role: 'faculty' }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
