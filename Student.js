const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  telegram_id: { type: String, default: '' },
  telegram_username: { type: String, default: '' },
  attempts:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Result' }],
  joined_at:   { type: Date, default: Date.now }
});

StudentSchema.index({ telegram_id: 1 });

module.exports = mongoose.model('Student', StudentSchema);
