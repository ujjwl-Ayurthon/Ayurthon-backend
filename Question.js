const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['mcq', 'assertion_reason', 'match_following'],
    default: 'mcq'
  },
  options: {
    A: { type: String, required: true },
    B: { type: String, required: true },
    C: { type: String, required: true },
    D: { type: String, required: true }
  },
  correct_answer: {
    type: String,
    enum: ['A', 'B', 'C', 'D'],
    required: true
  },
  explanation: { type: String, default: '' },
  reference:   { type: String, default: '' },

  // ─── Taxonomy ─────────────────────────────────────────
  category: {
    type: String,
    enum: ['samhita', 'short_subject', 'modern'],
    required: true
  },
  subject: {
    type: String,
    required: true
    // e.g. "Charak Samhita", "Rasashastra", "Physiology"
  },
  sthan: {
    type: String,
    default: ''
    // e.g. "Sutra Sthan", "Nidan Sthan", "Part A"
  },
  chapter: {
    type: String,
    default: ''
    // e.g. "Ch.1 - Deerghanjivitiya Adhyaya"
  },
  range_start: { type: Number, default: null },
  range_end:   { type: Number, default: null },

  used_in_tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  created_at: { type: Date, default: Date.now }
});

// Index for fast filtering
QuestionSchema.index({ subject: 1, sthan: 1, chapter: 1 });
QuestionSchema.index({ category: 1 });

module.exports = mongoose.model('Question', QuestionSchema);
