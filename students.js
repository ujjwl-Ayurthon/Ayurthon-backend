const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Result = require('../models/Result');
const { adminAuth } = require('../utils/auth');

// ─── GET All Students (admin) ──────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const students = await Student.find().sort({ joined_at: -1 });
    res.json({ success: true, students, total: students.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET Student History ───────────────────────────────────
router.get('/:telegram_username/history', async (req, res) => {
  try {
    const student = await Student.findOne({
      telegram_username: req.params.telegram_username.toLowerCase()
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const results = await Result.find({ student_id: student._id })
      .sort({ submitted_at: -1 })
      .populate('test_id', 'title type published_at');

    res.json({ success: true, student, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
