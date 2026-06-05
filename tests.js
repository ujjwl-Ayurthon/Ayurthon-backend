const express = require('express');
const router  = express.Router();
const Test     = require('./Test');
const Question = require('./Question');
const { sendTestToChannel, getChannelList } = require('./telegramBot');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Channels List ──────────────────────────────────────────
router.get('/channels/list', adminAuth, (req, res) => {
  try {
    const channels = getChannelList();
    console.log('Channels loaded:', channels);
    res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Test ────────────────────────────────────────────
router.post('/', adminAuth, async (req, res) => {
  try {
    const { title, type, question_ids, duration_minutes, sections, negative_marks } = req.body;
    if (!title || !type || !question_ids || question_ids.length === 0) {
      return res.status(400).json({ error: 'title, type and question_ids required' });
    }
    const test = new Test({
      title, type,
      questions:        question_ids,
      duration_minutes: duration_minutes || 60,
      total_marks:      question_ids.length,
      negative_marks:   Number(negative_marks) || 0,
      sections:         sections || []
    });
    await test.save();
    await Question.updateMany(
      { _id: { $in: question_ids } },
      { $push: { used_in_tests: test._id } }
    );
    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get All Tests ──────────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const tests = await Test.find().sort({ created_at: -1 });
    res.json({ success: true, tests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Single Test (admin) ────────────────────────────────
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Test by Token (Student — no auth) ─────────────────
router.get('/attempt/:token', async (req, res) => {
  try {
    const test = await Test.findOne({
      link_token: req.params.token,
      status: 'published'
    }).populate('questions', 'text type options reference');
    if (!test) return res.status(404).json({ error: 'Test not found or not active' });
    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Publish Test ───────────────────────────────────────────
router.post('/:id/publish', adminAuth, async (req, res) => {
  try {
    const { channel_id, custom_message } = req.body;

    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (test.status === 'published') {
      return res.status(400).json({ error: 'Test already published' });
    }

    test.status       = 'published';
    test.published_at = new Date();
    await test.save();

    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const testLink    = `${frontendUrl}/test/${test.link_token}`;

    console.log(`Publishing test: ${test.title}`);
    console.log(`Test link: ${testLink}`);
    console.log(`Channel: ${channel_id}`);

    let telegram_sent  = false;
    let telegram_error = null;

    try {
      await sendTestToChannel(test, testLink, channel_id, custom_message || null);
      telegram_sent      = true;
      test.telegram_sent = true;
      await test.save();
    } catch (botErr) {
      telegram_error = botErr.message;
      console.error('Telegram error:', botErr.message);
    }

    res.json({
      success: true,
      message: 'Test published!',
      link: testLink,
      telegram_sent,
      telegram_error,
      test
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Close Test ─────────────────────────────────────────────
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

// ── Delete Test ────────────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
