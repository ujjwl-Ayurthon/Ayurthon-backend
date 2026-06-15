const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// REQUIRED: Trust Render reverse proxy - MUST be first
app.set('trust proxy', 1);

// CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    var allowed = [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'];
    if (allowed.indexOf(origin) !== -1) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiter - validate:false prevents X-Forwarded-For crash
var limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  validate: false,
});
app.use(limiter);

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(function() { console.log('MongoDB Connected'); })
  .catch(function(err) { console.error('MongoDB Error:', err.message); });

// ── ROUTES — flat file structure (no routes/ subfolder) ──────────────────────
// admin.js is in ROOT, not routes/admin.js
var adminRoute = require('./admin');
app.use('/api/admin', adminRoute);

var authRoute = require('./auth');
app.use('/api/auth', authRoute.router || authRoute);

var questionsRoute = require('./questions');
app.use('/api/questions', questionsRoute);

var testsRoute = require('./tests');
app.use('/api/tests', testsRoute);

var resultsRoute = require('./results');
app.use('/api/results', resultsRoute);

var studentsRoute = require('./students');
app.use('/api/students', studentsRoute);

var studentDashRoute = require('./studentDashboard');
app.use('/api/student/dashboard', studentDashRoute);

// Health check
app.get('/health', function(req, res) {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

var PORT = process.env.PORT || 5000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
