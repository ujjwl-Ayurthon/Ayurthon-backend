const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Flat structure - no subfolders
app.use('/api/questions', require('./questions'));
app.use('/api/tests',     require('./tests'));
app.use('/api/results',   require('./results'));
app.use('/api/students',  require('./students'));
app.use('/api/admin',     require('./admin'));

require('./telegramBot');

app.get('/', (req, res) => {
  res.json({ status: 'Ayurthon Backend Live 🌿', time: new Date() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
