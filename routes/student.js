const express = require('express');
const Student = require('../models/Student');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', protect, requireRole('student'), async (req, res) => {
  const student = await Student.findById(req.user.id)
    .select('-password')
    .populate('enrolledCourses.course', 'title description')
    .populate('enrolledCourses.roadmapAssigned');
  res.json(student);
});

// Student: Change password
router.post('/change-password', protect, requireRole('student'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const student = await Student.findById(req.user.id);
    if (!student || !(await student.comparePassword(currentPassword))) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    student.password = newPassword.trim();
    await student.save();

    res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
