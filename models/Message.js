const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'senderRole' },
    senderRole: { type: String, required: true, enum: ['Student', 'Faculty'] },
    receiver: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'receiverRole' },
    receiverRole: { type: String, required: true, enum: ['Student', 'Faculty'] },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
