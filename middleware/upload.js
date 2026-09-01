const multer = require('multer');

const typeFolders = {
  video: 'videos',
  ppt: 'ppt',
  docx: 'docx',
  pdf: 'pdf'
};

const allowedExts = {
  video: ['.mp4', '.mov', '.mkv', '.webm'],
  ppt: ['.ppt', '.pptx'],
  docx: ['.doc', '.docx'],
  pdf: ['.pdf']
};

// Use memory storage so req.body is fully parsed before the route handler
// The route handler is responsible for writing the file to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});

module.exports = { upload, typeFolders, allowedExts };
