const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// ─── MongoDB Connection ───────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ─── Routes ───────────────────────────────────────────────
app.use('/api/questions', require('./routes/questions'));
app.use('/api/tests',     require('./routes/tests'));
app.use('/api/results',   require('./routes/results'));
app.use('/api/students',  require('./routes/students'));
app.use('/api/admin',     require('./routes/admin'));

// ─── Health Check ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Ayurthon Backend Live 🌿', time: new Date() });
});

// ─── Start Telegram Bot ───────────────────────────────────
require('./bot/telegramBot');

// ─── Start Server ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
