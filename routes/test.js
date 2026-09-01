const express = require('express');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Course = require('../models/Course');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// Faculty: create a test (entrance / dayN / weekly) with questions
router.post('/', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { title, courseId, type, weekNumber, durationMinutes, passingScore, assignedStudents, questions } = req.body;
    // questions: array of { type, questionText, options, correctAnswers, starterCode, testCases, language, marks }

    const createdQuestions = await Question.insertMany(questions || []);
    const test = await Test.create({
      title,
      course: courseId,
      type,
      weekNumber: weekNumber ? Number(weekNumber) : null,
      durationMinutes: Number(durationMinutes) || 30,
      passingScore: Number(passingScore) || 0,
      assignedStudents: Array.isArray(assignedStudents) ? assignedStudents : [],
      questions: createdQuestions.map((q) => q._id),
      createdBy: req.user.id
    });

    if (type === 'entrance') {
      await Course.findByIdAndUpdate(courseId, { entranceTest: test._id });
    }

    res.status(201).json(test);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student: Get upcoming & assigned exams (entrance, 3-day, 7-day, 21-day, weekly)
router.get('/assigned', protect, requireRole('student'), async (req, res) => {
  try {
    const Student = require('../models/Student');
    const student = await Student.findById(req.user.id);
    const enrolledCourseIds = (student.enrolledCourses || []).map(e => e.course);

    const tests = await Test.find({
      $or: [
        { course: { $in: enrolledCourseIds } },
        { assignedStudents: req.user.id }
      ]
    }).populate('course', 'title');

    const Submission = require('../models/Submission');
    const submissions = await Submission.find({ student: req.user.id });
    const subMap = {};
    submissions.forEach(s => {
      subMap[s.test.toString()] = { score: s.score, maxScore: s.maxScore, passed: s.passed, submittedAt: s.createdAt };
    });

    const result = tests.map(t => ({
      _id: t._id,
      title: t.title,
      type: t.type,
      weekNumber: t.weekNumber,
      course: t.course,
      durationMinutes: t.durationMinutes,
      passingScore: t.passingScore,
      submission: subMap[t._id.toString()] || null
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: List tests
router.get('/list', protect, requireRole('faculty'), async (req, res) => {
  try {
    const tests = await Test.find().populate('course', 'title');
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a test to attempt (strips correct answers before sending to student)
router.get('/:id/attempt', protect, requireRole('student'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) return res.status(404).json({ message: 'Test not found' });

    const sanitized = {
      _id: test._id,
      title: test.title,
      type: test.type,
      durationMinutes: test.durationMinutes,
      maxTabSwitches: test.maxTabSwitches,
      questions: test.questions.map((q) => ({
        _id: q._id,
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        starterCode: q.starterCode,
        language: q.language,
        marks: q.marks,
        // coding: only non-hidden sample test cases are shown
        testCases: q.type === 'coding' ? q.testCases.filter((tc) => !tc.hidden) : undefined
      }))
    };
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
