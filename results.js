const express  = require('express');
const router   = express.Router();
const Result   = require('./Result');
const Test     = require('./Test');
const Student  = require('./Student');
const Question = require('./Question');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Check already attempted ────────────────────────────────
router.get('/check/:test_token/:telegram_username', async (req, res) => {
  try {
    const { test_token, telegram_username } = req.params;
    const cleanTg = telegram_username.toLowerCase().replace('@', '');

    const test = await Test.findOne({ link_token: test_token });
    if (!test) return res.json({ attempted: false });

    const student = await Student.findOne({ telegram_username: cleanTg });
    if (!student) return res.json({ attempted: false });

    const existing = await Result.findOne({ student_id: student._id, test_id: test._id });
    if (existing) {
      return res.json({ attempted: true, result_id: existing._id });
    }
    res.json({ attempted: false });
  } catch (err) {
    console.error('Check error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Submit Result ──────────────────────────────────────────
router.post('/submit', async (req, res) => {
  try {
    const { test_token, student_name, telegram_username, answers, time_taken_seconds } = req.body;

    if (!test_token || !student_name || !answers) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const test = await Test.findOne({ link_token: test_token, status: 'published' })
      .populate('questions');
    if (!test) {
      return res.status(404).json({ error: 'Test not found or already closed' });
    }

    const cleanTg = (telegram_username || '').toLowerCase().replace('@', '');

    // Find or create student
    let student = await Student.findOne({ telegram_username: cleanTg });
    if (!student) {
      student = new Student({ name: student_name, telegram_username: cleanTg });
      await student.save();
    }

    // DATABASE-LEVEL PROTECTION
    // If already submitted — return success with resultId (not error)
    const existing = await Result.findOne({ student_id: student._id, test_id: test._id });
    if (existing) {
      return res.json({
        success:          true,
        alreadySubmitted: true,
        resultId:         existing._id
      });
    }

    // Process answers
    let correct = 0, incorrect = 0, unattempted = 0;
    const processedAnswers = [];
    const wrongQuestions   = [];
    const skippedQuestions = [];

    test.questions.forEach(function(question) {
      const qId      = question._id.toString();
      const selected = (answers[qId] !== undefined && answers[qId] !== null && answers[qId] !== '')
        ? answers[qId]
        : null;
      const isCorrect = selected !== null && selected === question.correct_answer;
      const isSkipped = selected === null;

      if (isSkipped) {
        unattempted++;
        skippedQuestions.push(question._id);
      } else if (isCorrect) {
        correct++;
      } else {
        incorrect++;
        wrongQuestions.push(question._id);
      }

      processedAnswers.push({
        question_id:     question._id,
        selected_option: selected,
        correct_option:  question.correct_answer,
        is_correct:      isCorrect,
        is_skipped:      isSkipped
      });
    });

    const negMark  = Number(test.negative_marks) || 0;
    const score    = correct - (incorrect * negMark);
    const accuracy = test.questions.length > 0
      ? Math.round((correct / test.questions.length) * 100)
      : 0;

    // Save result
    const result = new Result({
      student_id:         student._id,
      test_id:            test._id,
      score,
      total_marks:        test.questions.length,
      correct,
      incorrect,
      unattempted,
      accuracy,
      time_taken_seconds: Number(time_taken_seconds) || 0,
      answers:            processedAnswers,
      wrong_questions:    wrongQuestions,
      skipped_questions:  skippedQuestions
    });
    await result.save();

    // Update student attempts
    student.attempts.push(result._id);
    await student.save();

    // Calculate rank: higher score = better rank, tie = less time = better rank
    const higherRank = await Result.countDocuments({
      test_id: test._id,
      _id:     { $ne: result._id },
      $or: [
        { score: { $gt: score } },
        { score: score, time_taken_seconds: { $lt: Number(time_taken_seconds) || 0 } }
      ]
    });
    result.rank = higherRank + 1;
    await result.save();

    // Fetch wrong + skipped question details for result page
    const [wrongDetail, skippedDetail] = await Promise.all([
      Question.find({ _id: { $in: wrongQuestions } })
        .select('text options correct_answer explanation reference type'),
      Question.find({ _id: { $in: skippedQuestions } })
        .select('text options correct_answer explanation reference type')
    ]);

    res.json({
      success: true,
      result: {
        _id:               result._id,
        score,
        total:             test.questions.length,
        correct,
        incorrect,
        unattempted,
        accuracy,
        rank:              result.rank,
        time_taken_seconds: Number(time_taken_seconds) || 0,
        wrong_questions:   wrongDetail,
        skipped_questions: skippedDetail,
        answers:           processedAnswers
      }
    });

  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Leaderboard (score DESC, time ASC) ────────────────────
router.get('/leaderboard/:test_id', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const results = await Result.find({ test_id: req.params.test_id })
      .sort({ score: -1, time_taken_seconds: 1 })
      .limit(Number(limit))
      .populate('student_id', 'name telegram_username');

    const leaderboard = results.map(function(r, i) {
      return {
        rank:              i + 1,
        name:              r.student_id ? r.student_id.name : 'Unknown',
        telegram_username: r.student_id ? r.student_id.telegram_username : '',
        score:             r.score,
        total:             r.total_marks,
        correct:           r.correct,
        incorrect:         r.incorrect,
        unattempted:       r.unattempted || 0,
        accuracy:          r.accuracy,
        time_taken:        r.time_taken_seconds
      };
    });

    res.json({ success: true, leaderboard, total_students: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Full Response Sheet ─────────────────────────────
router.get('/sheet/:test_id', adminAuth, async (req, res) => {
  try {
    const test = await Test.findById(req.params.test_id)
      .populate('questions', 'text correct_answer');
    const results = await Result.find({ test_id: req.params.test_id })
      .sort({ score: -1, time_taken_seconds: 1 })
      .populate('student_id', 'name telegram_username');

    const sheet = results.map(function(r, i) {
      return {
        rank:              i + 1,
        name:              r.student_id ? r.student_id.name : 'Unknown',
        telegram_username: r.student_id ? r.student_id.telegram_username : '',
        score:             r.score,
        correct:           r.correct,
        incorrect:         r.incorrect,
        unattempted:       r.unattempted || 0,
        accuracy:          r.accuracy,
        time_taken:        r.time_taken_seconds,
        responses:         (r.answers || []).map(function(a) {
          return {
            question_id: a.question_id,
            selected:    a.selected_option || '—',
            correct:     a.correct_option,
            is_correct:  a.is_correct,
            is_skipped:  a.is_skipped
          };
        })
      };
    });

    res.json({
      success:     true,
      test_title:  test ? test.title : '',
      questions:   test ? test.questions : [],
      sheet
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: All results for test ────────────────────────────
router.get('/test/:test_id', adminAuth, async (req, res) => {
  try {
    const results = await Result.find({ test_id: req.params.test_id })
      .sort({ score: -1, time_taken_seconds: 1 })
      .populate('student_id', 'name telegram_username');
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics ──────────────────────────────────────────────
router.get('/analytics/:test_id', adminAuth, async (req, res) => {
  try {
    const results = await Result.find({ test_id: req.params.test_id });
    if (results.length === 0) return res.json({ success: true, analytics: null });

    const scores = results.map(function(r) { return r.score; });
    const avg    = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
    const total  = results[0].total_marks;

    const distribution = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
    results.forEach(function(r) {
      const pct = (r.score / total) * 100;
      if      (pct <= 25) distribution['0-25']++;
      else if (pct <= 50) distribution['26-50']++;
      else if (pct <= 75) distribution['51-75']++;
      else                distribution['76-100']++;
    });

    res.json({
      success: true,
      analytics: {
        total_students:     results.length,
        average_score:      Math.round(avg * 10) / 10,
        highest_score:      Math.max.apply(null, scores),
        lowest_score:       Math.min.apply(null, scores),
        average_accuracy:   Math.round(
          results.reduce(function(a, r) { return a + r.accuracy; }, 0) / results.length
        ),
        score_distribution: distribution
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Single Result Detail ───────────────────────────────────
router.get('/:result_id', async (req, res) => {
  try {
    const result = await Result.findById(req.params.result_id)
      .populate('student_id',       'name telegram_username')
      .populate('test_id',          'title type duration_minutes')
      .populate('wrong_questions',   'text options correct_answer explanation reference type')
      .populate('skipped_questions', 'text options correct_answer explanation reference type');

    if (!result) return res.status(404).json({ error: 'Result not found' });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
