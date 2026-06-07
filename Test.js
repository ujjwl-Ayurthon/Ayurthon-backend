const mongoose = require('mongoose');

function generateToken() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

const TestSchema = new mongoose.Schema({
  title:             { type: String, required: true },
  type:              { type: String, enum: ['daily','diagnostic','weekly','grand'], required: true },
  questions:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  duration_minutes:  { type: Number, default: 60 },
  status:            { type: String, enum: ['draft','published','closed'], default: 'draft' },
  link_token:        { type: String, default: generateToken, unique: true },
  sections:          [{
    subject: String, sthan: String, chapter: String,
    range_start: Number, range_end: Number, question_count: Number
  }],
  // Marks config — explicit integers
  correct_marks:     { type: Number, default: 4 },
  negative_marks:    { type: Number, default: 1 },
  total_marks:       { type: Number, default: 0 },
  telegram_sent:     { type: Boolean, default: false },
  scheduled_at:      { type: Date, default: null },
  scheduled_channel: { type: String, default: null },
  expires_at:        { type: Date, default: null },
  published_at:      { type: Date },
  closed_at:         { type: Date },
  created_at:        { type: Date, default: Date.now }
});

module.exports = mongoose.model('Test', TestSchema);
