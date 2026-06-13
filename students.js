const express = require('express');
const router = express.Router();
const crypto = require('crypto'); // Hashing ke liye import kiya gaya hai
const Student = require('./Student');
const Result = require('./Result');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '') || req.headers['ayurthon_admin_token'];
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// 1. Updated Route: Saare registered students ki detailed list fetch karna (Admin Management Tab Fix)
router.get('/', adminAuth, async (req, res) => {
  try {
    // Claude ke naye requirements ke hisab se exact selection metrics configured hain
    const students = await Student.find({})
      .select("name telegram_username avatar_color streak badges is_active attempts createdAt joined_at")
      .sort({ joined_at: -1 });
    
    // Custom object envelope handle kiya taaki dashboard tables array mapping par crash na ho
    res.json({ success: true, students, total: students.length, data: students });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Verified New Route: Secure Admin Reset Password Endpoint (SHA256 Multi-layer matching)
router.post('/:id/reset-password', adminAuth, async function(req, res) {
  try {
    var student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    // Generate random 8-char password: 4 alpha + 4 digits
    var chars  = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
    var digits = "23456789";
    var newPassword = "";
    for (var i = 0; i < 4; i++) newPassword += chars[Math.floor(Math.random() * chars.length)];
    for (var j = 0; j < 4; j++) newPassword += digits[Math.floor(Math.random() * digits.length)];
    
    // Shuffle arrays
    newPassword = newPassword.split("").sort(function() { return Math.random() - 0.5; }).join("");

    // Registration standard pipeline synchronization: SHA256(password + ADMIN_PASSWORD)
    var salt = process.env.ADMIN_PASSWORD || "";
    var hash = crypto.createHash("sha256").update(newPassword + salt).digest("hex");

    // Schema validation requirements fix
    student.password_hash = hash;
    student.password = newPassword; // Fallback plain synchronization

    await student.save();
    res.json({ success: true, new_password: newPassword, temporaryPassword: newPassword });
  } catch (err) {
    console.error("Reset router failure execution context:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// 3. Purana Existing Route: Get student history via Telegram Username
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
