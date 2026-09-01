const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BRANCHES = ['AIML', 'CIC', 'CSE'];
const SECTIONS = ['A', 'B', 'C', 'D'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const studentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    branch: { type: String, required: true, enum: BRANCHES },
    section: { type: String, required: true, enum: SECTIONS },
    year: { type: String, required: true, enum: YEARS },
    regdNo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    phone: { type: String, required: true, trim: true },
    lastLogin: { type: Date, default: Date.now },
    password: { type: String, required: true },
    role: { type: String, default: 'student' },
    enrolledCourses: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        entranceScore: { type: Number, default: null },
        entrancePassed: { type: Boolean, default: false },
        roadmapAssigned: { type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap', default: null },
        enrolledAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// Password rule: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
studentSchema.statics.PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

studentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

studentSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

studentSchema.statics.BRANCHES = BRANCHES;
studentSchema.statics.SECTIONS = SECTIONS;
studentSchema.statics.YEARS = YEARS;

module.exports = mongoose.model('Student', studentSchema);
