const express = require('express');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const Student = require('../models/Student');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

const { evaluateCodingSubmission } = require('../services/codeExecutionService');

// Student: Run code against VISIBLE test cases only
router.post('/run-code', protect, requireRole('student'), async (req, res) => {
  try {
    const { questionId, sourceCode, language } = req.body;
    if (!questionId) return res.status(400).json({ message: 'Question ID is required' });

    const question = await Question.findById(questionId);
    if (!question || question.type !== 'coding') {
      return res.status(404).json({ message: 'Coding question not found' });
    }

    const selectedLang = language || question.language || 'javascript';
    // Evaluate ONLY against visible (non-hidden) test cases
    const evaluation = await evaluateCodingSubmission({
      sourceCode: sourceCode || '',
      language: selectedLang,
      testCases: question.testCases || [],
      visibleOnly: true
    });

    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student: Start or Sync Exam Session (Server-authoritative timer & session lock)
router.post('/start-session/:testId', protect, requireRole('student'), async (req, res) => {
  try {
    const testId = req.params.testId;
    const test = await Test.findById(testId).populate('questions');
    if (!test) return res.status(404).json({ message: 'Test not found' });

    let submission = await Submission.findOne({
      student: req.user.id,
      test: testId
    });

    if (!submission) {
      submission = await Submission.create({
        student: req.user.id,
        test: testId,
        course: test.course,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        answers: [],
        proctoring: { tabSwitchCount: 0, tabSwitchTimestamps: [] }
      });
    }

    // Check if already submitted or auto-submitted
    if (submission.status === 'SUBMITTED' || submission.status === 'AUTO_SUBMITTED') {
      return res.status(400).json({
        message: 'Exam already submitted.',
        status: submission.status,
        submissionId: submission._id
      });
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(submission.startedAt).getTime()) / 1000);
    const totalDurationSeconds = (test.durationMinutes || 30) * 60;
    const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);

    if (remainingSeconds <= 0) {
      submission.status = 'AUTO_SUBMITTED';
      submission.autoSubmitted = true;
      submission.submissionReason = 'Time expired.';
      submission.submittedAt = new Date();
      await submission.save();

      return res.json({
        status: 'AUTO_SUBMITTED',
        remainingSeconds: 0,
        submissionReason: 'Time expired.',
        submissionId: submission._id
      });
    }

    res.json({
      submissionId: submission._id,
      status: submission.status,
      startedAt: submission.startedAt,
      durationMinutes: test.durationMinutes,
      remainingSeconds,
      violationCount: submission.proctoring ? submission.proctoring.tabSwitchCount || 0 : 0,
      answers: submission.answers || [],
      codingSubmissions: submission.codingSubmissions || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student: Log Proctoring Violation (Server-side tracking & auto-submit if > 3 violations)
router.post('/log-violation', protect, requireRole('student'), async (req, res) => {
  try {
    const { testId, violationType } = req.body;
    const submission = await Submission.findOne({
      student: req.user.id,
      test: testId
    });

    if (!submission) return res.status(404).json({ message: 'Active exam session not found' });
    if (submission.status !== 'IN_PROGRESS') {
      return res.json({
        status: submission.status,
        violationCount: submission.proctoring.tabSwitchCount,
        autoSubmitted: submission.status !== 'IN_PROGRESS'
      });
    }

    const newCount = (submission.proctoring.tabSwitchCount || 0) + 1;
    submission.proctoring.tabSwitchCount = newCount;
    submission.proctoring.tabSwitchTimestamps.push(new Date());

    submission.violationLogs.push({
      type: violationType || 'TAB_SWITCH',
      timestamp: new Date(),
      count: newCount
    });

    let autoSubmitted = false;
    let message = `Security Violation #${newCount} recorded.`;

    if (newCount > 3) {
      autoSubmitted = true;
      submission.status = 'AUTO_SUBMITTED';
      submission.autoSubmitted = true;
      submission.submissionReason = 'Automatically submitted due to more than 3 tab switches/page violations.';
      submission.submittedAt = new Date();
      message = 'Automatically submitted due to more than 3 tab switches/page violations.';
    }

    await submission.save();

    res.json({
      autoSubmitted,
      violationCount: newCount,
      message,
      submissionReason: submission.submissionReason
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student: submit answers for a test
router.post('/', protect, requireRole('student'), async (req, res) => {
  try {
    const { testId, courseId, answers = [], codeAnswers = [], proctoring, autoSubmitted, submissionReason } = req.body;

    const test = await Test.findById(testId).populate('questions');
    if (!test) return res.status(404).json({ message: 'Test not found' });

    let score = 0;
    let maxScore = 0;
    const gradedAnswers = [];
    const codingSubmissionsList = [];
    let allCodingQuestionsPassed = true;

    for (const q of test.questions) {
      maxScore += q.marks;
      const submitted = answers.find((a) => a.questionId === q._id.toString() || (a.question && a.question.toString() === q._id.toString()));
      let isCorrect = false;

      if (q.type === 'single') {
        if (submitted && submitted.response) {
          isCorrect = submitted.response === q.correctAnswers[0];
        }
      } else if (q.type === 'mcq') {
        if (submitted && submitted.response) {
          const sel = Array.isArray(submitted.response) ? submitted.response.sort() : [];
          isCorrect = JSON.stringify(sel) === JSON.stringify([...q.correctAnswers].sort());
        }
      } else if (q.type === 'coding') {
        const codeSub = codeAnswers.find((c) => c.questionId === q._id.toString()) || {};
        const sourceCode = codeSub.sourceCode || (submitted && typeof submitted.response === 'string' ? submitted.response : '') || q.starterCode || '';
        const selectedLang = codeSub.language || q.language || 'javascript';

        // Re-evaluate on backend against ALL test cases (visible + hidden)
        const evalRes = await evaluateCodingSubmission({
          sourceCode,
          language: selectedLang,
          testCases: q.testCases || [],
          visibleOnly: false
        });

        isCorrect = evalRes.isPassed;
        if (!isCorrect) allCodingQuestionsPassed = false;

        codingSubmissionsList.push({
          question: q._id,
          code: sourceCode,
          language: selectedLang,
          passCount: evalRes.passedCount,
          totalCount: evalRes.totalCount,
          isPassed: evalRes.isPassed,
          compileError: evalRes.compileError || '',
          runtimeError: evalRes.runtimeError || ''
        });
      }

      const marksAwarded = isCorrect ? q.marks : 0;
      score += marksAwarded;
      gradedAnswers.push({
        question: q._id,
        response: q.type === 'coding' ? (codeAnswers.find(c => c.questionId === q._id.toString())?.sourceCode || '') : (submitted ? submitted.response : null),
        isCorrect,
        marksAwarded
      });
    }

    // SERVER-SIDE SUBMISSION GUARD: If normal submission (not autoSubmitted) and any coding question failed test cases
    if (!autoSubmitted && !allCodingQuestionsPassed) {
      return res.status(400).json({
        message: 'Please pass all test cases for all coding questions before submitting the exam.'
      });
    }

    const passed = score >= test.passingScore;

    // Find or update submission
    let submission = await Submission.findOne({ student: req.user.id, test: testId });
    if (!submission) {
      submission = new Submission({
        student: req.user.id,
        test: testId,
        course: courseId || test.course
      });
    }

    submission.answers = gradedAnswers;
    submission.codingSubmissions = codingSubmissionsList;
    submission.score = score;
    submission.maxScore = maxScore;
    submission.passed = passed;
    submission.submittedAt = new Date();
    submission.autoSubmitted = !!autoSubmitted;
    submission.status = autoSubmitted ? 'AUTO_SUBMITTED' : 'SUBMITTED';
    submission.submissionReason = submissionReason || (autoSubmitted ? 'Auto-submitted' : 'Normal submission');
    if (proctoring) {
      submission.proctoring = { ...submission.proctoring, ...proctoring };
    }

    await submission.save();

    // If entrance test, update enrollment
    if (test.type === 'entrance') {
      const student = await Student.findById(req.user.id);
      const enrollment = student.enrolledCourses.find((e) => e.course.toString() === (courseId || test.course).toString());
      if (enrollment) {
        enrollment.entranceScore = score;
        enrollment.entrancePassed = passed;
        await student.save();
      }
    }

    res.status(201).json({
      score,
      maxScore,
      passed,
      status: submission.status,
      submissionReason: submission.submissionReason,
      submissionId: submission._id
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: view a course's entrance results (for roadmap creation decisions)
router.get('/entrance-results/:courseId', protect, requireRole('faculty'), async (req, res) => {
  const results = await Submission.find({ course: req.params.courseId })
    .populate('student', 'fullName regdNo branch section year')
    .populate('test', 'type title')
    .then((subs) => subs.filter((s) => s.test.type === 'entrance'));
  res.json(results);
});

// Faculty: view all test submissions (filtered by course, type, or student regdNo)
router.get('/all', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { courseId, type, regdNo } = req.query;
    const filter = {};
    if (courseId) filter.course = courseId;

    if (regdNo) {
      const student = await Student.findOne({ regdNo: regdNo.trim().toUpperCase() });
      if (student) filter.student = student._id;
      else return res.json([]);
    }

    let submissions = await Submission.find(filter)
      .populate('student', 'fullName regdNo branch section year phone')
      .populate('test', 'title type weekNumber passingScore')
      .populate('course', 'title')
      .sort({ createdAt: -1 });

    if (type) {
      submissions = submissions.filter((s) => s.test && s.test.type === type);
    }

    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: view a specific student's full exam & proctoring history
router.get('/student/:studentId', protect, requireRole('faculty'), async (req, res) => {
  const submissions = await Submission.find({ student: req.params.studentId })
    .populate('test', 'title type')
    .populate('course', 'title')
    .sort({ createdAt: -1 });
  res.json(submissions);
});

// Student/Faculty: Get detailed exam review with selected answers, correct answers, & explanations
router.get('/review/test/:testId', protect, async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.id : req.query.studentId;
    if (!studentId) return res.status(400).json({ message: 'Student ID required' });

    const submission = await Submission.findOne({ test: req.params.testId, student: studentId })
      .populate('test', 'title type durationMinutes passingScore')
      .populate('course', 'title')
      .populate({
        path: 'answers.question',
        select: 'type questionText options correctAnswers starterCode testCases language marks explanation'
      })
      .sort({ createdAt: -1 });

    if (!submission) return res.status(404).json({ message: 'No completed submission found for this exam' });

    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student/Faculty: Get detailed exam review by Submission ID
router.get('/review/:submissionId', protect, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .populate('student', 'fullName regdNo branch')
      .populate('test', 'title type durationMinutes passingScore')
      .populate('course', 'title')
      .populate({
        path: 'answers.question',
        select: 'type questionText options correctAnswers starterCode testCases language marks explanation'
      });

    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
