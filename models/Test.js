const mongoose = require('mongoose');

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    type: {
      type: String,
      enum: ['entrance', 'day3', 'day7', 'day21', 'weekly', 'custom'],
      required: true
    },
    weekNumber: { type: Number, default: null }, // for weekly exams tied to roadmap week
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    durationMinutes: { type: Number, default: 30 },
    passingScore: { type: Number, default: 0 },
    maxTabSwitches: { type: Number, default: 3 },
    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);
