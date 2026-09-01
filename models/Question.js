const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ['mcq', 'single', 'coding'], required: true },
  questionText: { type: String, required: true },
  // For mcq (multi-correct) and single (one correct) - options list
  options: [{ type: String }],
  correctAnswers: [{ type: String }], // for mcq: multiple; for single: one value
  // For coding questions
  starterCode: { type: String },
  testCases: [
    {
      input: String,
      expectedOutput: String,
      hidden: { type: Boolean, default: false }
    }
  ],
  language: { type: String, default: 'javascript' },
  marks: { type: Number, default: 1 },
  explanation: { type: String, default: '' }
});

module.exports = mongoose.model('Question', questionSchema);
