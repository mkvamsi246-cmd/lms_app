const express = require('express');
const path = require('path');
const Roadmap = require('../models/Roadmap');
const Student = require('../models/Student');
const { upload, typeFolders, allowedExts } = require('../middleware/upload');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get enrolled courses for a student by Registration Number (regdNo)
router.get('/student-courses/:regdNo', protect, requireRole('faculty'), async (req, res) => {
  try {
    const regdNo = req.params.regdNo.trim().toUpperCase();
    const student = await Student.findOne({ regdNo }).populate('enrolledCourses.course', 'title description');
    if (!student) return res.status(404).json({ message: 'Student not found with this Registration Number' });
    const courses = student.enrolledCourses.map(e => e.course).filter(Boolean);
    res.json({ studentId: student._id, fullName: student.fullName, regdNo: student.regdNo, courses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: create a roadmap for a student on a course (after reviewing entrance result)
router.post('/', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { courseId, studentId, regdNo, weeks } = req.body;
    let cleanStudentId = (studentId || '').trim();
    const cleanCourseId = (courseId || '').trim();

    if (!cleanStudentId && regdNo) {
      const student = await Student.findOne({ regdNo: regdNo.trim().toUpperCase() });
      if (!student) return res.status(404).json({ message: 'Student not found with this Registration Number' });
      cleanStudentId = student._id.toString();
    }

    if (!cleanStudentId || !cleanCourseId) {
      return res.status(400).json({ message: 'Student Registration Number / ID and Course are required' });
    }

    const roadmap = await Roadmap.create({
      course: cleanCourseId,
      student: cleanStudentId,
      startDate: new Date(),
      weeks: weeks || [],
      createdBy: req.user.id
    });

    // Update the student's enrollment to link this roadmap
    const studentDoc = await Student.findById(cleanStudentId);
    if (studentDoc) {
      const enrollment = studentDoc.enrolledCourses.find(
        (e) => e.course && e.course.toString() === cleanCourseId
      );
      if (enrollment) {
        enrollment.roadmapAssigned = roadmap._id;
        await studentDoc.save();
      }
    }

    res.status(201).json(roadmap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: upload a resource (video/ppt/docx/pdf) into a specific week
router.post(
  '/:roadmapId/week/:weekNumber/resource',
  protect,
  requireRole('faculty'),
  upload.single('file'),
  async (req, res) => {
    try {
      const { resourceType, title } = req.body;

      // Validate file was received
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Make sure the field name is "file".' });
      }

      // Validate resourceType
      if (!typeFolders[resourceType]) {
        return res.status(400).json({
          message: `Invalid resourceType "${resourceType}". Must be one of: ${Object.keys(typeFolders).join(', ')}`
        });
      }

      // Validate file extension matches the declared type
      const fs = require('fs');
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!allowedExts[resourceType].includes(ext)) {
        return res.status(400).json({
          message: `File extension "${ext}" is not valid for type "${resourceType}". Allowed: ${allowedExts[resourceType].join(', ')}`
        });
      }

      const roadmap = await Roadmap.findById(req.params.roadmapId.trim());
      if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

      const week = roadmap.weeks.find((w) => w.weekNumber === Number(req.params.weekNumber));
      if (!week) return res.status(404).json({ message: 'Week not found on roadmap' });

      // Write file buffer to disk (memoryStorage gives us req.file.buffer)
      const folder = typeFolders[resourceType];
      const uploadDir = path.join(__dirname, '..', 'uploads', folder);
      fs.mkdirSync(uploadDir, { recursive: true });
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = unique + ext;
      fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);

      week.resources.push({
        title,
        type: resourceType,
        fileUrl: `/uploads/${folder}/${filename}`
      });
      await roadmap.save();
      res.status(201).json(week);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// Faculty: attach an exam (day3/day7/day21/weekly) to a roadmap week
router.patch('/:roadmapId/week/:weekNumber/exam', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { testId } = req.body;
    const roadmap = await Roadmap.findById(req.params.roadmapId);
    const week = roadmap.weeks.find((w) => w.weekNumber === Number(req.params.weekNumber));
    if (!week) return res.status(404).json({ message: 'Week not found' });
    week.exam = testId;
    await roadmap.save();
    res.json(week);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student: view their assigned roadmap for a course with progression status
router.get('/mine/:courseId', protect, requireRole('student'), async (req, res) => {
  try {
    const studentDoc = await Student.findById(req.user.id).select('enrolledCourses');
    const enrollment = studentDoc && studentDoc.enrolledCourses.find(
      (e) => e.course && e.course.toString() === req.params.courseId.toString()
    );

    let roadmap;
    if (enrollment && enrollment.roadmapAssigned) {
      roadmap = await Roadmap.findById(enrollment.roadmapAssigned)
        .populate('weeks.exam', 'title type durationMinutes passingScore');
    } else {
      roadmap = await Roadmap.findOne(
        { course: req.params.courseId, student: req.user.id },
        null,
        { sort: { createdAt: -1 } }
      ).populate('weeks.exam', 'title type durationMinutes passingScore');
    }

    if (!roadmap) return res.status(404).json({ message: 'No roadmap assigned yet' });

    // Fetch student's test submissions for this course to evaluate exam passes
    const Submission = require('../models/Submission');
    const submissions = await Submission.find({ student: req.user.id, course: req.params.courseId });
    const passedTestIds = new Set(submissions.filter(s => s.passed).map(s => s.test.toString()));

    const roadmapObj = roadmap.toObject();
    roadmapObj.weeks = roadmapObj.weeks.map(w => {
      const examPassed = w.exam ? passedTestIds.has(w.exam._id.toString()) : true;
      const allResourcesCompleted = !w.resources || w.resources.length === 0 || w.resources.every(r => r.completed);
      return {
        ...w,
        examPassed,
        allResourcesCompleted
      };
    });

    res.json(roadmapObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student: Toggle resource checklist completion state
router.patch('/:roadmapId/week/:weekNumber/resource/:resourceId/toggle', protect, requireRole('student'), async (req, res) => {
  try {
    const roadmap = await Roadmap.findOne({ _id: req.params.roadmapId, student: req.user.id });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

    const week = roadmap.weeks.find((w) => w.weekNumber === Number(req.params.weekNumber));
    if (!week) return res.status(404).json({ message: 'Week not found' });

    const resource = week.resources.id(req.params.resourceId);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });

    resource.completed = !resource.completed;
    await roadmap.save();
    res.json({ message: 'Resource status updated', completed: resource.completed, roadmap });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: Monitor all created roadmaps with week completion progress calculation
router.get('/all-overview', protect, requireRole('faculty'), async (req, res) => {
  try {
    const Submission = require('../models/Submission');
    const roadmaps = await Roadmap.find()
      .populate('student', 'fullName regdNo branch section year')
      .populate('course', 'title description')
      .populate('weeks.exam', 'title type passingScore')
      .sort({ createdAt: -1 });

    const overviewList = await Promise.all(
      roadmaps.map(async (rm) => {
        if (!rm.student || !rm.course) return null;

        const submissions = await Submission.find({ student: rm.student._id, course: rm.course._id });
        const passedTestIds = new Set(submissions.filter((s) => s.passed).map((s) => s.test.toString()));

        let completedWeeksCount = 0;
        const totalWeeksCount = rm.weeks ? rm.weeks.length : 0;

        (rm.weeks || []).forEach((w) => {
          const totalResources = (w.resources || []).length;
          let completedResourcesCount = (w.resources || []).filter((r) => r.completed).length;

          if (w.exam && passedTestIds.has(w.exam._id.toString())) {
            completedResourcesCount = totalResources;
          }

          const hasExam = !!w.exam;
          const examDone = w.exam && passedTestIds.has(w.exam._id.toString());
          const weekDone = (totalResources === 0 || completedResourcesCount === totalResources) && (!hasExam || examDone);

          if (weekDone) completedWeeksCount++;
        });

        const progressPercent = totalWeeksCount > 0 ? Math.round((completedWeeksCount / totalWeeksCount) * 100) : 100;

        return {
          _id: rm._id,
          student: rm.student,
          course: rm.course,
          totalWeeks: totalWeeksCount,
          completedWeeks: completedWeeksCount,
          progressPercent,
          createdAt: rm.createdAt,
          weeks: rm.weeks
        };
      })
    );

    res.json(overviewList.filter(Boolean));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Faculty: view a student's roadmap + progress
router.get('/:roadmapId', protect, requireRole('faculty'), async (req, res) => {
  const roadmap = await Roadmap.findById(req.params.roadmapId)
    .populate('student', 'fullName regdNo branch section year')
    .populate('course', 'title')
    .populate('weeks.exam', 'title type');
  res.json(roadmap);
});

module.exports = router;
