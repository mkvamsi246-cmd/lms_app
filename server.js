require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded content (videos, ppt, docx, pdf) and the frontend
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/student'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/courses', require('./routes/course'));
app.use('/api/tests', require('./routes/test'));
app.use('/api/submissions', require('./routes/submission'));
app.use('/api/roadmaps', require('./routes/roadmap'));
app.use('/api/messages', require('./routes/message'));

// Fallback to the login landing page for any non-API route (SPA-style)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
