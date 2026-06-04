const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const { parseQuestions } = require('../utils/questionParser');
const TAXONOMY = require('../config/taxonomy');
const { adminAuth } = require('../utils/auth');

// ─── GET Taxonomy ──────────────────────────────────────────
router.get('/taxonomy', (req, res) => {
  res.json({ success: true, taxonomy: TAXONOMY });
});

// ─── POST Parse (preview before saving) ───────────────────
router.post('/parse', adminAuth, (req, res) => {
  const { raw_text } = req.body;
  if (!raw_text) return res.status(400).json({ error: 'No text provided' });

  const result = parseQuestions(raw_text);
  res.json({ success: true, ...result });
});

// ─── POST Upload (parse + save to DB) ─────────────────────
router.post('/upload', adminAuth, async (req, res) => {
  try {
    const { raw_text, category, subject, sthan, chapter, range_start, range_end } = req.body;

    if (!raw_text || !category || !subject) {
      return res.status(400).json({ error: 'raw_text, category and subject are required' });
    }

    const { questions, errors } = parseQuestions(raw_text);

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No valid questions parsed', errors });
    }

    // Attach taxonomy to each question
    const docs = questions.map(q => ({
      ...q,
      category,
      subject,
      sthan:       sthan || '',
      chapter:     chapter || '',
      range_start: range_start ? Number(range_start) : null,
      range_end:   range_end   ? Number(range_end)   : null,
    }));

    const saved = await Question.insertMany(docs);

    res.json({
      success: true,
      saved: saved.length,
      errors,
      message: `${saved.length} questions saved successfully`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET All Questions (with filters) ─────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const { category, subject, sthan, chapter, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (subject)  filter.subject  = subject;
    if (sthan)    filter.sthan    = sthan;
    if (chapter)  filter.chapter  = chapter;

    const total = await Question.countDocuments(filter);
    const questions = await Question.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-used_in_tests');

    res.json({ success: true, questions, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET Questions by IDs (for test building) ─────────────
router.post('/by-ids', adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    const questions = await Question.find({ _id: { $in: ids } });
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE Question ───────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET Stats ─────────────────────────────────────────────
router.get('/stats/count', adminAuth, async (req, res) => {
  try {
    const total = await Question.countDocuments();
    const byCategory = await Question.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const bySubject = await Question.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, total, byCategory, bySubject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
