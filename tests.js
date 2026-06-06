const express  = require('express');
const router   = express.Router();
const Test     = require('./Test');
const Question = require('./Question');
const Result   = require('./Result');
const { sendTestToChannel, getChannelList } = require('./telegramBot');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Channels list ──────────────────────────────────────────
router.get('/channels/list', adminAuth, (req, res) => {
  try {
    res.json({ success: true, channels: getChannelList() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Scheduled auto-publish (call every 5 min via cron) ────
router.post('/scheduled/run', async (req, res) => {
  try {
    const now     = new Date();
    const pending = await Test.find({
      status:       'draft',
      scheduled_at: { $lte: now, $ne: null }
    }).populate('questions');

    const published = [];
    for (const test of pending) {
      try {
        test.status       = 'published';
        test.published_at = now;
        await test.save();
        const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
        const testLink    = frontendUrl + '/test/' + test.link_token;
        await sendTestToChannel(test, testLink, test.scheduled_channel || null, null);
        test.telegram_sent = true;
        await test.save();
        published.push(test.title);
      } catch (e) {
        console.error('Scheduled publish error:', test.title, e.message);
      }
    }

    // Auto-close expired tests
    const expired = await Test.find({
      status:     'published',
      expires_at: { $lte: now, $ne: null }
    });
    const closed = [];
    for (const test of expired) {
      const results = await Result.find({ test_id: test._id }).sort({ score: -1, time_taken_seconds: 1 });
      for (let i = 0; i < results.length; i++) { results[i].rank = i + 1; await results[i].save(); }
      test.status    = 'closed';
      test.closed_at = now;
      await test.save();
      closed.push(test.title);
    }

    res.json({ success: true, published, closed, count: published.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Test ────────────────────────────────────────────
router.post('/', adminAuth, async (req, res) => {
  try {
    const { title, type, question_ids, duration_minutes,
            sections, negative_marks, scheduled_at, scheduled_channel, expires_at } = req.body;

    if (!title || !type || !question_ids || question_ids.length === 0) {
      return res.status(400).json({ error: 'title, type and question_ids required' });
    }

    const totalMarks = question_ids.length * 4;

    const test = new Test({
      title, type,
      questions:          question_ids,
      duration_minutes:   Number(duration_minutes)   || 60,
      total_marks:        totalMarks,
      negative_marks:     Number(negative_marks)     || 0,
      sections:           sections                   || [],
      scheduled_at:       scheduled_at               || null,
      scheduled_channel:  scheduled_channel          || null,
      expires_at:         expires_at                 || null
    });
    await test.save();
    await Question.updateMany({ _id: { $in: question_ids } }, { $push: { used_in_tests: test._id } });
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

// ── Get Single Test ────────────────────────────────────────
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('questions');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Test by Token (Student) ────────────────────────────
router.get('/attempt/:token', async (req, res) => {
  try {
    const test = await Test.findOne({ link_token: req.params.token, status: 'published' })
      .populate('questions', 'text type options reference');
    if (!test) return res.status(404).json({ error: 'Test not found or not active' });

    // Check if expired
    if (test.expires_at && new Date() > new Date(test.expires_at)) {
      return res.status(404).json({ error: 'Test link expired hai' });
    }

    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Edit Draft Test ────────────────────────────────────────
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { title, type, duration_minutes, negative_marks,
            question_ids, scheduled_at, scheduled_channel, expires_at } = req.body;

    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (test.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft tests can be edited' });
    }

    if (title)                        test.title             = title;
    if (type)                         test.type              = type;
    if (duration_minutes)             test.duration_minutes  = Number(duration_minutes);
    if (negative_marks !== undefined) test.negative_marks    = Number(negative_marks);
    if (scheduled_at !== undefined)   test.scheduled_at      = scheduled_at || null;
    if (scheduled_channel !== undefined) test.scheduled_channel = scheduled_channel || null;
    if (expires_at !== undefined)     test.expires_at        = expires_at || null;

    if (question_ids && question_ids.length > 0) {
      test.questions   = question_ids;
      test.total_marks = question_ids.length * 4;
    }

    await test.save();
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
    if (test.status === 'published') return res.status(400).json({ error: 'Already published' });

    test.status       = 'published';
    test.published_at = new Date();
    await test.save();

    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const testLink    = frontendUrl + '/test/' + test.link_token;

    let telegram_sent = false, telegram_error = null;
    try {
      await sendTestToChannel(test, testLink, channel_id, custom_message || null);
      telegram_sent = true;
      test.telegram_sent = true;
      await test.save();
    } catch (botErr) {
      telegram_error = botErr.message;
      console.error('Telegram error:', botErr.message);
    }

    res.json({ success: true, message: 'Published!', link: testLink, telegram_sent, telegram_error, test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Recalculate Ranks ──────────────────────────────────────
router.post('/:id/recalculate-ranks', adminAuth, async (req, res) => {
  try {
    const results = await Result.find({ test_id: req.params.id })
      .sort({ score: -1, time_taken_seconds: 1 });
    for (let i = 0; i < results.length; i++) {
      results[i].rank = i + 1;
      await results[i].save();
    }
    res.json({ success: true, updated: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Close Test ─────────────────────────────────────────────
router.post('/:id/close', adminAuth, async (req, res) => {
  try {
    const results = await Result.find({ test_id: req.params.id })
      .sort({ score: -1, time_taken_seconds: 1 });
    for (let i = 0; i < results.length; i++) {
      results[i].rank = i + 1;
      await results[i].save();
    }
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', closed_at: new Date() },
      { new: true }
    );
    res.json({ success: true, test, ranks_recalculated: results.length });
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
