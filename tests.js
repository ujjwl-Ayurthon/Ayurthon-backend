const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const Question = require('../models/Question');
const { adminAuth } = require('../utils/auth');
const { sendTestToChannel } = require('../bot/telegramBot');

// ─── POST Create Test ──────────────────────────────────────
router.post('/', adminAuth, async (req, res) => {
  try {
    const { title, type, question_ids, duration_minutes, sections, negative_marks } = req.body;

    if (!title || !type || !question_ids || question_ids.length === 0) {
      return res.status(400).json({ error: 'title, type and question_ids are required' });
    }

    const test = new Test({
      title,
      type,
      questions: question_ids,
      duration_minutes: duration_minutes || 60,
      total_marks: question_ids.length,
      negative_marks: negative_marks || 0,
      sections: sections || []
    });

    await test.save();

    // Mark questions as used
    await Question.updateMany(
      { _id: { $in: question_ids } },
      { $push: { used_in_tests: test._id } }
    );

    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET All Tests (admin) ─────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const tests = await Test.find()
      .sort({ created_at: -1 })
      .select('-questions');
    res.json({ success: true, tests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET Single Test (admin - with questions) ──────────────
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET Test by Token (student - no auth, no answers) ────
router.get('/attempt/:token', async (req, res) => {
  try {
    const test = await Test.findOne({ link_token: req.params.token, status: 'published' })
      .populate('questions', 'text type options reference');
    // Note: correct_answer is NOT sent to student

    if (!test) return res.status(404).json({ error: 'Test not found or not active' });

    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST Publish Test ─────────────────────────────────────
router.post('/:id/publish', adminAuth, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });

    test.status = 'published';
    test.published_at = new Date();
    await test.save();

    const frontendUrl = process.env.FRONTEND_URL;
    const testLink = `${frontendUrl}/test/${test.link_token}`;

    // Send to Telegram channel
    try {
      await sendTestToChannel(test, testLink);
      test.telegram_sent = true;
      await test.save();
    } catch (botErr) {
      console.error('Telegram send error:', botErr.message);
    }

    res.json({
      success: true,
      message: 'Test published!',
      link: testLink,
      telegram_sent: test.telegram_sent,
      test
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST Close Test ───────────────────────────────────────
router.post('/:id/close', adminAuth, async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', closed_at: new Date() },
      { new: true }
    );
    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE Test ───────────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
