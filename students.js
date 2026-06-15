const express = require('express');
const router = express.Router();
const Student = require('./Student');
const crypto = require('crypto');

function verifyAdmin(req, res, next) {
  var token = (req.headers['x-admin-token'] || '').toString().trim();
  var envPassword = (process.env.ADMIN_PASSWORD || "0604").toString().trim();
  if (token === envPassword) return next();
  return res.status(401).json({ success: false, message: "Unauthorized" });
}

// GET /api/students
router.get('/', verifyAdmin, async function(req, res) {
  try {
    var list = await Student.find({})
      .select('name telegram_username avatar_color streak badges is_active attempts createdAt')
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/students/:id/reset-password
router.post('/:id/reset-password', verifyAdmin, async function(req, res) {
  try {
    var student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    var newPassword = '';
    for (var i = 0; i < 8; i++) {
      newPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    var salt = (process.env.ADMIN_PASSWORD || '').toString();
    var hash = crypto.createHash('sha256').update(newPassword + salt).digest('hex');
    student.password_hash = hash;
    await student.save();

    res.json({ success: true, new_password: newPassword });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
