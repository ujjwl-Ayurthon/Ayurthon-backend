const express  = require('express');
const router   = express.Router();
const Student  = require('./Student');
const crypto   = require('crypto');

// Simple hash — no bcrypt dependency needed
function hashPassword(password) {
  return crypto.createHash('sha256')
    .update(password + process.env.ADMIN_PASSWORD)
    .digest('hex');
}

function generateToken(student) {
  const payload = student._id + '|' + student.telegram_username + '|' + Date.now();
  return Buffer.from(payload).toString('base64');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts   = decoded.split('|');
    if (parts.length < 3) return null;
    // Token valid for 30 days
    const issued = parseInt(parts[2]);
    if (Date.now() - issued > 30 * 24 * 60 * 60 * 1000) return null;
    return { id: parts[0], telegram_username: parts[1] };
  } catch (e) {
    return null;
  }
}

// ── Student Auth Middleware ────────────────────────────────
function studentAuth(req, res, next) {
  const token = req.headers['x-student-token'];
  if (!token) return res.status(401).json({ error: 'Login required' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Session expired. Please login again.' });
  req.studentId       = decoded.id;
  req.telegramUsername = decoded.telegram_username;
  next();
}

// ── Register ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, telegram_username, password, phone, college, graduation_year } = req.body;

    if (!name || !telegram_username || !password) {
      return res.status(400).json({ error: 'Name, username aur password required hai' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password kam se kam 6 characters ka hona chahiye' });
    }

    const cleanTg = telegram_username.toLowerCase().replace('@', '').trim();
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(cleanTg)) {
      return res.status(400).json({ error: 'Valid Telegram username dein (4-32 characters, only letters/numbers/_)' });
    }

    const existing = await Student.findOne({ telegram_username: cleanTg });
    if (existing) {
      return res.status(400).json({ error: 'Yeh Telegram username already registered hai' });
    }

    // Pick random avatar color
    const colors = ['#E8750A','#2D6A4F','#1565C0','#6A1B9A','#C62828','#00695C'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const student = new Student({
      name:              name.trim(),
      telegram_username: cleanTg,
      password_hash:     hashPassword(password),
      phone:             phone             || '',
      college:           college           || '',
      graduation_year:   graduation_year   || '',
      avatar_color:      avatarColor
    });
    await student.save();

    const token = generateToken(student);

    res.json({
      success: true,
      token,
      student: {
        _id:               student._id,
        name:              student.name,
        telegram_username: student.telegram_username,
        avatar_color:      student.avatar_color,
        joined_at:         student.joined_at
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { telegram_username, password } = req.body;
    if (!telegram_username || !password) {
      return res.status(400).json({ error: 'Username aur password required hai' });
    }

    const cleanTg = telegram_username.toLowerCase().replace('@', '').trim();
    const student  = await Student.findOne({ telegram_username: cleanTg });

    if (!student) {
      return res.status(401).json({ error: 'Username nahi mila. Pehle register karein.' });
    }
    if (student.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Galat password hai' });
    }
    if (!student.is_active) {
      return res.status(403).json({ error: 'Account inactive hai. Admin se contact karein.' });
    }

    const token = generateToken(student);

    res.json({
      success: true,
      token,
      student: {
        _id:               student._id,
        name:              student.name,
        telegram_username: student.telegram_username,
        avatar_color:      student.avatar_color,
        streak:            student.streak,
        badges:            student.badges,
        joined_at:         student.joined_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get My Profile ─────────────────────────────────────────
router.get('/me', studentAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.studentId)
      .select('-password_hash');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update Profile ─────────────────────────────────────────
router.put('/profile', studentAuth, async (req, res) => {
  try {
    const { name, phone, college, graduation_year } = req.body;
    const update = {};
    if (name)             update.name             = name.trim();
    if (phone)            update.phone            = phone;
    if (college)          update.college          = college;
    if (graduation_year)  update.graduation_year  = graduation_year;

    const student = await Student.findByIdAndUpdate(
      req.studentId, update, { new: true }
    ).select('-password_hash');

    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Change Password ────────────────────────────────────────
router.put('/change-password', studentAuth, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    const student = await Student.findById(req.studentId);

    if (student.password_hash !== hashPassword(old_password)) {
      return res.status(401).json({ error: 'Purana password galat hai' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Naya password kam se kam 6 characters ka hona chahiye' });
    }

    student.password_hash = hashPassword(new_password);
    await student.save();
    res.json({ success: true, message: 'Password change ho gaya!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, studentAuth, verifyToken };
