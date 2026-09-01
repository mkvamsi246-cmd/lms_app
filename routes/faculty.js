const express = require('express');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Roadmap = require('../models/Roadmap');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// List all registered students (optionally filter by branch/section/year)
router.get('/students', protect, requireRole('faculty'), async (req, res) => {
  const { branch, section, year } = req.query;
  const filter = {};
  if (branch) filter.branch = branch;
  if (section) filter.section = section;
  if (year) filter.year = year;

  const students = await Student.find(filter)
    .select('-password')
    .populate('enrolledCourses.course', 'title');
  res.json(students);
});

// Faculty manually adds a student (initial password defaults to Regd No)
router.post('/students', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { fullName, branch, section, year, regdNo, phone, password } = req.body;
    if (!fullName || !branch || !section || !year || !regdNo || !phone) {
      return res.status(400).json({ message: 'Full Name, Branch, Section, Year, Regd No, and Phone Number are required' });
    }
    const cleanRegdNo = regdNo.trim().toUpperCase();
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
    res.status(201).json({ id: student._id, regdNo: student.regdNo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty edits a student
router.put('/students/:id', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { fullName, branch, section, year, regdNo, phone, password } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    if (fullName) student.fullName = fullName;
    if (branch) student.branch = branch;
    if (section) student.section = section;
    if (year) student.year = year;
    if (regdNo) student.regdNo = regdNo;
    if (phone) student.phone = phone;
    if (password && password.trim()) {
      if (!Student.PASSWORD_REGEX.test(password)) {
        return res.status(400).json({
          message: 'Password must be 8+ chars with uppercase, lowercase, number, and special character'
        });
      }
      student.password = password;
    }

    await student.save();
    res.json({ message: 'Student updated successfully', student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty deletes a student
router.delete('/students/:id', protect, requireRole('faculty'), async (req, res) => {
  try {
    const studentId = req.params.id;
    await Student.findByIdAndDelete(studentId);
    await Roadmap.deleteMany({ student: studentId });
    const Submission = require('../models/Submission');
    await Submission.deleteMany({ student: studentId });
    res.json({ message: 'Student and related records deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Register another faculty account (bootstrap the first one directly in MongoDB - see README)
router.post('/register', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const faculty = await Faculty.create({ fullName, email, password });
    res.status(201).json({ id: faculty._id, email: faculty.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// All roadmaps/progress overview (for the "manage all students' activities" dashboard)
router.get('/roadmaps', protect, requireRole('faculty'), async (req, res) => {
  const roadmaps = await Roadmap.find()
    .populate('student', 'fullName regdNo branch section year')
    .populate('course', 'title');
  res.json(roadmaps);
});

// Analytics Dashboard summary endpoint
router.get('/analytics', protect, requireRole('faculty'), async (req, res) => {
  try {
    const Submission = require('../models/Submission');
    const Message = require('../models/Message');

    const totalStudents = await Student.countDocuments();
    const activeRoadmaps = await Roadmap.countDocuments();
    const submissions = await Submission.find().select('score maxScore passed createdAt');

    const totalSubmissions = submissions.length;
    const passedSubmissions = submissions.filter(s => s.passed).length;
    const failedSubmissions = totalSubmissions - passedSubmissions;

    const unreadMessages = await Message.countDocuments({
      receiver: req.user.id,
      read: false
    });

    // Branch breakdown
    const students = await Student.find().select('branch lastLogin');
    const branchStats = {};
    let activeStudentsCount = 0;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    students.forEach(s => {
      branchStats[s.branch] = (branchStats[s.branch] || 0) + 1;
      if (s.lastLogin && new Date(s.lastLogin) >= oneWeekAgo) {
        activeStudentsCount++;
      }
    });

    const inactiveStudentsCount = totalStudents - activeStudentsCount;

    res.json({
      totalStudents,
      activeRoadmaps,
      totalSubmissions,
      passedSubmissions,
      failedSubmissions,
      unreadMessages,
      activeStudentsCount,
      inactiveStudentsCount,
      branchStats
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty changes own password
router.post('/change-password', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const faculty = await Faculty.findById(req.user.id);
    if (!faculty || !(await faculty.comparePassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    faculty.password = newPassword.trim();
    await faculty.save();

    res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
