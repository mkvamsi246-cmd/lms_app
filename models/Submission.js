const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    answers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        response: mongoose.Schema.Types.Mixed, // string(s) for mcq/single, code string for coding
        isCorrect: { type: Boolean, default: false },
        marksAwarded: { type: Number, default: 0 }
      }
    ],
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
    autoSubmitted: { type: Boolean, default: false },
    status: { type: String, enum: ['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED'], default: 'SUBMITTED' },
    submissionReason: { type: String, default: 'Normal submission' },
    proctoring: {
      tabSwitchCount: { type: Number, default: 0 },
      tabSwitchTimestamps: [{ type: Date }],
      pasteAttempts: { type: Number, default: 0 },
      pasteTimestamps: [{ type: Date }]
    },
    violationLogs: [
      {
        type: { type: String }, // TAB_SWITCH, PAGE_HIDDEN, FULLSCREEN_EXIT, WINDOW_BLUR
        timestamp: { type: Date, default: Date.now },
        count: { type: Number }
      }
    ],
    codingSubmissions: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        code: String,
        language: String,
        passCount: Number,
        totalCount: Number,
        isPassed: Boolean,
        compileError: String,
        runtimeError: String
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Submission', submissionSchema);
