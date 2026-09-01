const express = require('express');
const Course = require('../models/Course');
const Student = require('../models/Student');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// List all active courses (both roles)
router.get('/', protect, async (req, res) => {
  const courses = await Course.find({ isActive: true }).populate('entranceTest', 'title durationMinutes');
  res.json(courses);
});

// Faculty: create a course
router.post('/', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const course = await Course.create({ title, description, createdBy: req.user.id });
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student: enroll interest in a course (before taking entrance test)
router.post('/:id/enroll', protect, requireRole('student'), async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    const already = student.enrolledCourses.find((e) => e.course.toString() === req.params.id);
    if (already) return res.status(200).json({ message: 'Already enrolled', enrollment: already });

    student.enrolledCourses.push({ course: req.params.id });
    await student.save();
    res.status(201).json({ message: 'Enrolled - proceed to entrance test' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: edit a course
router.put('/:id', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (title) course.title = title.trim();
    if (description !== undefined) course.description = description.trim();

    await course.save();
    res.json({ message: 'Course updated successfully', course });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: delete a course
router.delete('/:id', protect, requireRole('faculty'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
