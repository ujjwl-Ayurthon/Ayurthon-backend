const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// 💡 CRITICAL FIXED ORDER: Rate limiter load hone se pehle proxy trust hona zaroori hai
app.set('trust proxy', 1);

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Safe rate limiter config without strict global headers validations
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, 
  validate: false // 👈 Yeh poore validation checks ko force-shutoff kar dega taaki crash zero ho jaye
});

app.use(limiter);

mongoose.connect(process.env.MONGODB_URI)
  .then(function() {
    console.log('✅ MongoDB Connected');
  })
  .catch(function(err) {
    console.error('❌ MongoDB Error:', err);
  });

// ── Routes ────────────────────────────────────────────────
app.use('/api/questions',        require('./questions'));
app.use('/api/tests',            require('./tests'));
app.use('/api/results',          require('./results'));
app.use('/api/students',         require('./students'));
app.use('/api/admin',            require('./admin'));
app.use('/api/auth',             require('./auth').router);
app.use('/api/student/dashboard',require('./studentDashboard'));

// ── Health ─────────────────────────────────────────────────
app.get('/', function(req, res) {
  res.json({ status: 'Ayurthon Backend Live 🌿', time: new Date() });
});

// ── Telegram Bot ───────────────────────────────────────────
require('./telegramBot');

const PORT = process.env.PORT || 5000;
app.listen(PORT, function() {
  console.log('🚀 Server on port ' + PORT);
});
