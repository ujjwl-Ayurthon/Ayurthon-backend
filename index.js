// ============================================================
// index.js — COMPLETE REPLACEMENT
// ============================================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// REQUIRED: Trust Render/Vercel reverse proxy
// Must be BEFORE any middleware
app.set('trust proxy', 1);

// CORS — allow Vercel frontend
app.use(cors({
  origin: function(origin, callback) {
    var allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowed.indexOf(origin) !== -1) return callback(null, true);
    // Allow any vercel.app subdomain
    if (origin && origin.endsWith('.vercel.app')) return callback(null, true);
    return callback(null, true); // permissive for now — tighten after testing
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiter — validate:false prevents X-Forwarded-For crash
var limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  validate: false,
});
app.use(limiter);

// DB
mongoose.connect(process.env.MONGODB_URI)
  .then(function() { console.log('MongoDB Connected'); })
  .catch(function(err) { console.error('MongoDB Error:', err.message); });

// Routes — ORDER MATTERS
// Specific routes before dynamic ones
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth').router || require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/results', require('./routes/results'));
app.use('/api/students', require('./routes/students'));
app.use('/api/student/dashboard', require('./routes/studentDashboard'));

// Health check
app.get('/health', function(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

var PORT = process.env.PORT || 5000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
