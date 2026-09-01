const express = require('express');
const Message = require('../models/Message');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get unread counts (total + per sender)
router.get('/unread-counts', protect, async (req, res) => {
  try {
    const unreadMsgs = await Message.find({ receiver: req.user.id, read: false });
    const totalUnread = unreadMsgs.length;
    const unreadBySender = {};

    unreadMsgs.forEach(m => {
      const sId = m.sender.toString();
      unreadBySender[sId] = (unreadBySender[sId] || 0) + 1;
    });

    res.json({ totalUnread, unreadBySender });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get chat contact list
router.get('/contacts', protect, async (req, res) => {
  try {
    if (req.user.role === 'faculty') {
      const students = await Student.find().select('fullName regdNo branch section year').sort('fullName');
      res.json(students.map(s => ({ _id: s._id, name: `${s.fullName} (${s.regdNo})`, sub: `${s.branch} - Sec ${s.section}` })));
    } else {
      const facultyList = await Faculty.find().select('fullName email').sort('fullName');
      res.json(facultyList.map(f => ({ _id: f._id, name: f.fullName, sub: f.email })));
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get conversation messages between current user and target user
router.get('/conversation/:userId', protect, async (req, res) => {
  try {
    const currentId = req.user.id;
    const targetId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentId, receiver: targetId },
        { sender: targetId, receiver: currentId }
      ]
    }).sort({ createdAt: 1 });

    // Mark unread messages as read
    await Message.updateMany(
      { sender: targetId, receiver: currentId, read: false },
      { $set: { read: true } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send a message
router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    if (!receiverId || !message || !message.trim()) {
      return res.status(400).json({ message: 'Receiver and message content are required' });
    }

    let messageData;
    if (req.user.role === 'faculty') {
      messageData = {
        sender: req.user.id,
        senderRole: 'Faculty',
        receiver: receiverId,
        receiverRole: 'Student',
        student: receiverId,
        faculty: req.user.id,
        message: message.trim()
      };
    } else {
      messageData = {
        sender: req.user.id,
        senderRole: 'Student',
        receiver: receiverId,
        receiverRole: 'Faculty',
        student: req.user.id,
        faculty: receiverId,
        message: message.trim()
      };
    }

    const newMsg = await Message.create(messageData);
    res.status(201).json(newMsg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
