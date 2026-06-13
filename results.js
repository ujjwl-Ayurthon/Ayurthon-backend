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
    const test    = await Test.findOne({ link_token: test_token });
    if (!test) return res.json({ attempted: false });
    const student = await Student.findOne({ telegram_username: cleanTg });
    if (!student)  return res.json({ attempted: false });
    const existing = await Result.findOne({ student_id: student._id, test_id: test._id });
    if (existing)  return res.json({ attempted: true, result_id: existing._id });
    res.json({ attempted: false });
  } catch (err) {
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
    if (!test) return res.status(404).json({ error: 'Test not found or already closed' });

    if (test.expires_at && new Date() > new Date(test.expires_at)) {
      return res.status(403).json({ error: 'Test link expired hai' });
    }

    const cleanTg = (telegram_username || '').toLowerCase().replace('@', '');
    let student = await Student.findOne({ telegram_username: cleanTg });
    if (!student) {
      student = new Student({ name: student_name, telegram_username: cleanTg });
      await student.save();
    }

    // DB duplicate protection
    const existing = await Result.findOne({ student_id: student._id, test_id: test._id });
    if (existing) {
      return res.json({ success: true, alreadySubmitted: true, resultId: existing._id });
    }

    let correct = 0, incorrect = 0, unattempted = 0;
    const processedAnswers = [];
    const wrongQuestions   = [];
    const skippedQuestions = [];
    const correctQuestions = [];

    // Process ALL questions — all 3 lists populated
    test.questions.forEach(function(question) {
      const qId      = question._id.toString();
      const selected = (answers[qId] !== undefined && answers[qId] !== null && answers[qId] !== '')
        ? String(answers[qId]) : null;
      const isSkipped = selected === null;
      const isCorrect = !isSkipped && selected === question.correct_answer;

      if (isSkipped) {
        unattempted++;
        skippedQuestions.push(question._id);
        processedAnswers.push({ question_id: question._id, selected_option: null, correct_option: question.correct_answer, is_correct: false, is_skipped: true });
      } else if (isCorrect) {
        correct++;
        correctQuestions.push(question._id);
        processedAnswers.push({ question_id: question._id, selected_option: selected, correct_option: question.correct_answer, is_correct: true, is_skipped: false });
      } else {
        incorrect++;
        wrongQuestions.push(question._id);
        processedAnswers.push({ question_id: question._id, selected_option: selected, correct_option: question.correct_answer, is_correct: false, is_skipped: false });
      }
    });

    // Strict integer scoring — AIAPGET standard
    const correctMarks = Math.round(Number(test.correct_marks  || 4));
    const negMarks     = Math.round(Math.abs(Number(test.negative_marks || 1)));
    const totalMarks   = test.questions.length * correctMarks;
    const score        = Math.round((correct * correctMarks) - (incorrect * negMarks));

    // Accuracy on attempted only
    const attempted = correct + incorrect;
    const accuracy  = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    const result = new Result({
      student_id:         student._id,
      test_id:            test._id,
      score,
      total_marks:        totalMarks,
      correct,
      incorrect,
      unattempted,
      accuracy,
      time_taken_seconds: Math.round(Number(time_taken_seconds) || 0),
      answers:            processedAnswers,
      wrong_questions:    wrongQuestions,
      skipped_questions:  skippedQuestions,
      correct_questions:  correctQuestions
    });
    await result.save();

    student.attempts.push(result._id);
    await student.save();

    // Rank: score DESC, time ASC
    const higherRank = await Result.countDocuments({
      test_id: test._id,
      _id:     { $ne: result._id },
      $or: [
        { score: { $gt: score } },
        { score: score, time_taken_seconds: { $lt: Math.round(Number(time_taken_seconds) || 0) } }
      ]
    });
    result.rank = higherRank + 1;
    await result.save();

    // Fetch ALL 3 question detail arrays for result page
    const [wrongDetail, skippedDetail, correctDetail] = await Promise.all([
      Question.find({ _id: { $in: wrongQuestions   } }).select('text options correct_answer explanation reference type'),
      Question.find({ _id: { $in: skippedQuestions } }).select('text options correct_answer explanation reference type'),
      Question.find({ _id: { $in: correctQuestions } }).select('text options correct_answer explanation reference type')
    ]);

    res.json({
      success: true,
      result: {
        _id:                result._id,
        score,
        total_marks:        totalMarks,
        total:              test.questions.length,
        correct,
        incorrect,
        unattempted,
        accuracy,
        rank:               result.rank,
        correct_marks:      correctMarks,
        negative_marks:     negMarks,
        time_taken_seconds: Math.round(Number(time_taken_seconds) || 0),
        wrong_questions:    wrongDetail,
        skipped_questions:  skippedDetail,
        correct_questions:  correctDetail,
        answers:            processedAnswers
      }
    });

  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Leaderboard ────────────────────────────────────────────
router.get('/leaderboard/:test_id', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const results = await Result.find({ test_id: req.params.test_id })
      .sort({ score: -1, time_taken_seconds: 1 })
      .limit(Number(limit))
      .populate('student_id', 'name telegram_username');

    const leaderboard = results.map(function(r, i) {
      const att = (r.correct || 0) + (r.incorrect || 0);
      const acc = att > 0 ? Math.round((r.correct / att) * 100) : 0;
      return {
        rank:              i + 1,
        name:              r.student_id ? r.student_id.name              : 'Unknown',
        telegram_username: r.student_id ? r.student_id.telegram_username : '',
        score:             r.score,
        total_marks:       r.total_marks,
        correct:           r.correct,
        incorrect:         r.incorrect,
        unattempted:       r.unattempted || 0,
        accuracy:          acc,
        time_taken:        r.time_taken_seconds
      };
    });

    res.json({ success: true, leaderboard, total_students: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Response Sheet ──────────────────────────────────
router.get('/sheet/:test_id', adminAuth, async (req, res) => {
  try {
    const test = await Test.findById(req.params.test_id)
      .populate('questions', 'text correct_answer');
    const results = await Result.find({ test_id: req.params.test_id })
      .sort({ score: -1, time_taken_seconds: 1 })
      .populate('student_id', 'name telegram_username');

    const sheet = results.map(function(r, i) {
      const att = (r.correct || 0) + (r.incorrect || 0);
      const acc = att > 0 ? Math.round((r.correct / att) * 100) : 0;
      return {
        rank:              i + 1,
        name:              r.student_id ? r.student_id.name              : 'Unknown',
        telegram_username: r.student_id ? r.student_id.telegram_username : '',
        score:             r.score,
        total_marks:       r.total_marks,
        correct:           r.correct,
        incorrect:         r.incorrect,
        unattempted:       r.unattempted || 0,
        accuracy:          acc,
        time_taken:        r.time_taken_seconds,
        responses: (r.answers || []).map(function(a) {
          return { question_id: a.question_id, selected: a.selected_option || '—', correct: a.correct_option, is_correct: a.is_correct, is_skipped: a.is_skipped };
        })
      };
    });

    res.json({ success: true, test_title: test ? test.title : '', questions: test ? test.questions : [], sheet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: All results ─────────────────────────────────────
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
    let totalCorrect = 0, totalAttempted = 0;
    results.forEach(function(r) {
      totalCorrect   += (r.correct   || 0);
      totalAttempted += (r.correct   || 0) + (r.incorrect || 0);
    });
    const globalAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const maxMarks = results[0].total_marks || 1;
    const distribution = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
    results.forEach(function(r) {
      const pct = Math.round((r.score / maxMarks) * 100);
      if      (pct <= 25) distribution['0-25']++;
      else if (pct <= 50) distribution['26-50']++;
      else if (pct <= 75) distribution['51-75']++;
      else                distribution['76-100']++;
    });
    const avg = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
    res.json({ success: true, analytics: { total_students: results.length, average_score: Math.round(avg * 10) / 10, highest_score: Math.max.apply(null, scores), lowest_score: Math.min.apply(null, scores), average_accuracy: globalAccuracy, score_distribution: distribution } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Single Result — with correct_questions populated ───────
router.get('/:result_id', async (req, res) => {
  try {
    const result = await Result.findById(req.params.result_id)
      .populate('student_id',       'name telegram_username')
      .populate('test_id',          'title type duration_minutes correct_marks negative_marks')
      .populate('wrong_questions',   'text options correct_answer explanation reference type')
      .populate('skipped_questions', 'text options correct_answer explanation reference type')
      .populate('correct_questions', 'text options correct_answer explanation reference type');

    if (!result) return res.status(404).json({ error: 'Result not found' });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
