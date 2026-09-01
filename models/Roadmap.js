const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['video', 'ppt', 'docx', 'pdf'], required: true },
  fileUrl: { type: String, required: true },
  completed: { type: Boolean, default: false },
  uploadedAt: { type: Date, default: Date.now }
});

const weekSchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  title: { type: String },
  resources: [resourceSchema],
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', default: null }
});

const roadmapSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    startDate: { type: Date, default: Date.now },
    weeks: [weekSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Roadmap', roadmapSchema);
