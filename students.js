const express = require('express');
const router = express.Router();
const Student = require('./Student');
const Result = require('./Result');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const students = await Student.find().sort({ joined_at: -1 });
    res.json({ success: true, students, total: students.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:telegram_username/history', async (req, res) => {
  try {
    const student = await Student.findOne({ telegram_username: req.params.telegram_username.toLowerCase() });
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
