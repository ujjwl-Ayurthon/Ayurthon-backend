const express  = require('express');
const router   = express.Router();
const Question = require('./Question');
const { parseQuestions } = require('./questionParser');
const TAXONOMY = require('./taxonomy');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Taxonomy ───────────────────────────────────────────────
router.get('/taxonomy', (req, res) => {
  res.json({ success: true, taxonomy: TAXONOMY });
});

// ── Stats ──────────────────────────────────────────────────
router.get('/stats/count', adminAuth, async (req, res) => {
  try {
    const total      = await Question.countDocuments();
    const byCategory = await Question.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    const bySubject  = await Question.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort:  { count: -1 } }
    ]);
    res.json({ success: true, total, byCategory, bySubject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parse preview ──────────────────────────────────────────
router.post('/parse', adminAuth, (req, res) => {
  const { raw_text } = req.body;
  if (!raw_text) return res.status(400).json({ error: 'No text provided' });
  const result = parseQuestions(raw_text);
  res.json({ success: true, ...result });
});

// ── Check duplicates before upload ────────────────────────
router.post('/check-duplicates', adminAuth, async (req, res) => {
  try {
    const { questions } = req.body; // array of { text }
    const duplicates = [];
    for (const q of questions) {
      // Check first 60 chars match
      const snippet = q.text.substring(0, 60).trim();
      const existing = await Question.findOne({
        text: { $regex: snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      }).select('_id text subject sthan');
      if (existing) duplicates.push({ input: q.text.substring(0, 80), match: existing });
    }
    res.json({ success: true, duplicates, count: duplicates.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Upload (parse + duplicate check + save) ───────────────
router.post('/upload', adminAuth, async (req, res) => {
  try {
    const { raw_text, category, subject, sthan, chapter, range_start, range_end, skip_duplicates } = req.body;
    if (!raw_text || !category || !subject) {
      return res.status(400).json({ error: 'raw_text, category, subject required' });
    }

    const { questions, errors } = parseQuestions(raw_text);
    if (questions.length === 0) {
      return res.status(400).json({ error: 'No valid questions parsed', errors });
    }

    const saved = [];
    const skipped = [];

    for (const q of questions) {
      // Duplicate detection
      const snippet = q.text.substring(0, 60).trim();
      const exists = await Question.findOne({
        text: { $regex: snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      });

      if (exists && skip_duplicates) {
        skipped.push(q.text.substring(0, 60));
        continue;
      }

      const doc = new Question({
        ...q, category, subject,
        sthan:       sthan       || '',
        chapter:     chapter     || '',
        range_start: range_start ? Number(range_start) : null,
        range_end:   range_end   ? Number(range_end)   : null,
        is_duplicate: !!exists
      });
      await doc.save();
      saved.push(doc._id);
    }

    res.json({
      success: true,
      saved:   saved.length,
      skipped: skipped.length,
      errors,
      message: `${saved.length} saved, ${skipped.length} duplicates skipped`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get all (with filters + search) ───────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const { category, subject, sthan, chapter, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (subject)  filter.subject  = subject;
    if (sthan)    filter.sthan    = sthan;
    if (chapter)  filter.chapter  = chapter;
    if (search && search.trim()) {
      filter.$or = [
        { text:        { $regex: search.trim(), $options: 'i' } },
        { explanation: { $regex: search.trim(), $options: 'i' } },
        { reference:   { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const total     = await Question.countDocuments(filter);
    const questions = await Question.find(filter)
      .sort({ created_at: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select('-used_in_tests');

    res.json({ success: true, questions, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get by IDs ─────────────────────────────────────────────
router.post('/by-ids', adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    const questions = await Question.find({ _id: { $in: ids } });
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single question ────────────────────────────────────
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const q = await Question.findById(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, question: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Edit question ──────────────────────────────────────────
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { text, options, correct_answer, explanation, reference, type,
            category, subject, sthan, chapter, range_start, range_end } = req.body;

    const updated = await Question.findByIdAndUpdate(
      req.params.id,
      {
        text, options, correct_answer, explanation, reference, type,
        category, subject, sthan, chapter,
        range_start: range_start ? Number(range_start) : null,
        range_end:   range_end   ? Number(range_end)   : null
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Question not found' });
    res.json({ success: true, question: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete single ──────────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk delete ────────────────────────────────────────────
router.post('/bulk-delete', adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });
    const result = await Question.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
