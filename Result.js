const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  student_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  test_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Test',    required: true },

  score:       { type: Number, required: true },
  total_marks: { type: Number, required: true },
  correct:     { type: Number, default: 0 },
  incorrect:   { type: Number, default: 0 },
  unattempted: { type: Number, default: 0 },
  accuracy:    { type: Number, default: 0 },
  rank:        { type: Number, default: null },

  time_taken_seconds: { type: Number, default: 0 },

  answers: [{
    question_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selected_option: { type: String, default: null },
    correct_option:  { type: String },
    is_correct:      { type: Boolean, default: false },
    is_skipped:      { type: Boolean, default: false }
  }],

  wrong_questions:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  skipped_questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  correct_questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],

  submitted_at: { type: Date, default: Date.now }
});

ResultSchema.index({ test_id: 1, score: -1, time_taken_seconds: 1 });
ResultSchema.index({ student_id: 1 });

module.exports = mongoose.model('Result', ResultSchema);
