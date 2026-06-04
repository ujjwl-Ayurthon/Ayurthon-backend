const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const TestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ['daily', 'diagnostic', 'weekly', 'grand'],
    required: true
  },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  duration_minutes: { type: Number, default: 60 },
  status: {
    type: String,
    enum: ['draft', 'published', 'closed'],
    default: 'draft'
  },
  link_token: {
    type: String,
    default: () => uuidv4().replace(/-/g, '').substring(0, 12),
    unique: true
  },
  sections: [{
    subject: String,
    sthan: String,
    chapter: String,
    range_start: Number,
    range_end: Number,
    question_count: Number
  }],
  total_marks:    { type: Number, default: 0 },
  negative_marks: { type: Number, default: 0 },
  telegram_sent:  { type: Boolean, default: false },
  published_at:   { type: Date },
  closed_at:      { type: Date },
  created_at:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Test', TestSchema);
