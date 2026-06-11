const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name:              { type: String, required: true, trim: true },
  telegram_username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash:     { type: String, required: true },
  phone:             { type: String, default: '' },
  college:           { type: String, default: '' },
  graduation_year:   { type: String, default: '' },
  avatar_color:      { type: String, default: '#E8750A' },
  attempts:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'Result' }],
  streak:            { type: Number, default: 0 },
  last_attempt_date: { type: Date, default: null },
  badges:            [{ type: String }],
  is_active:         { type: Boolean, default: true },
  joined_at:         { type: Date, default: Date.now }
});

StudentSchema.index({ telegram_username: 1 });

module.exports = mongoose.model('Student', StudentSchema);
