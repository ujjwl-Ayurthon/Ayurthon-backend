const express  = require('express');
const router   = express.Router();
const Result   = require('./Result');
const Test     = require('./Test');
const Student  = require('./Student');
const { studentAuth } = require('./auth');

// ── Student Dashboard Stats ────────────────────────────────
router.get('/stats', studentAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.studentId);
    if (!student) return res.status(404).json({ error: 'Not found' });

    const results = await Result.find({ student_id: req.studentId })
      .populate('test_id', 'title type total_marks correct_marks negative_marks')
      .sort({ submitted_at: -1 });

    if (results.length === 0) {
      return res.json({
        success: true,
        stats: {
          total_tests:    0,
          best_rank:      null,
          avg_score_pct:  0,
          total_correct:  0,
          total_attempted:0,
          accuracy:       0,
          streak:         student.streak || 0,
          badges:         student.badges || []
        },
        recent: [],
        subject_accuracy: []
      });
    }

    // Basic stats
    const totalTests   = results.length;
    const bestRank     = Math.min.apply(null, results.map(function(r) { return r.rank || 9999 }));
    const scores       = results.map(function(r) {
      return r.total_marks > 0 ? Math.round((r.score / r.total_marks) * 100) : 0;
    });
    const avgScorePct  = Math.round(scores.reduce(function(a,b){return a+b},0) / scores.length);

    let totalCorrect = 0, totalAttempted = 0;
    results.forEach(function(r) {
      totalCorrect   += (r.correct   || 0);
      totalAttempted += (r.correct   || 0) + (r.incorrect || 0);
    });
    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

    // Recent 5 tests
    const recent = results.slice(0, 5).map(function(r) {
      return {
        _id:         r._id,
        test_id:     r.test_id ? r.test_id._id : null,
        title:       r.test_id ? r.test_id.title : 'Test',
        type:        r.test_id ? r.test_id.type  : 'daily',
        score:       r.score,
        total_marks: r.total_marks,
        correct:     r.correct,
        incorrect:   r.incorrect,
        accuracy:    r.accuracy,
        rank:        r.rank,
        submitted_at:r.submitted_at
      };
    });

    // Subject-wise accuracy from answers
    const subjectMap = {};
    for (const result of results) {
      if (!result.test_id) continue;
      (result.answers || []).forEach(function(a) {
        // We don't have subject per answer yet — use test type as proxy
        const key = result.test_id.type || 'other';
        if (!subjectMap[key]) subjectMap[key] = { correct: 0, attempted: 0 };
        if (!a.is_skipped) {
          subjectMap[key].attempted++;
          if (a.is_correct) subjectMap[key].correct++;
        }
      });
    }

    const subjectAccuracy = Object.keys(subjectMap).map(function(key) {
      const s = subjectMap[key];
      return {
        subject:  key,
        correct:  s.correct,
        attempted:s.attempted,
        accuracy: s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0
      };
    }).sort(function(a,b) { return a.accuracy - b.accuracy }); // weakest first

    res.json({
      success: true,
      stats: {
        total_tests:     totalTests,
        best_rank:       bestRank === 9999 ? null : bestRank,
        avg_score_pct:   avgScorePct,
        total_correct:   totalCorrect,
        total_attempted: totalAttempted,
        accuracy:        accuracy,
        streak:          student.streak || 0,
        badges:          student.badges || []
      },
      recent,
      subject_accuracy: subjectAccuracy
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── All My Results (history) ───────────────────────────────
router.get('/history', studentAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const total   = await Result.countDocuments({ student_id: req.studentId });
    const results = await Result.find({ student_id: req.studentId })
      .populate('test_id', 'title type total_marks duration_minutes')
      .sort({ submitted_at: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      results: results.map(function(r) {
        return {
          _id:          r._id,
          test_title:   r.test_id ? r.test_id.title : 'Test',
          test_type:    r.test_id ? r.test_id.type  : 'daily',
          test_id:      r.test_id ? r.test_id._id   : null,
          score:        r.score,
          total_marks:  r.total_marks,
          correct:      r.correct,
          incorrect:    r.incorrect,
          unattempted:  r.unattempted,
          accuracy:     r.accuracy,
          rank:         r.rank,
          time_taken:   r.time_taken_seconds,
          submitted_at: r.submitted_at
        };
      }),
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Live / Available Tests ─────────────────────────────────
router.get('/available-tests', studentAuth, async (req, res) => {
  try {
    const tests = await Test.find({ status: 'published' })
      .select('title type duration_minutes total_marks correct_marks negative_marks link_token published_at expires_at')
      .sort({ published_at: -1 });

    // Check which ones student already attempted
    const myResults = await Result.find({ student_id: req.studentId })
      .select('test_id');
    const attemptedIds = myResults.map(function(r) { return r.test_id.toString() });

    const enriched = tests.map(function(t) {
      return {
        _id:            t._id,
        title:          t.title,
        type:           t.type,
        duration:       t.duration_minutes,
        total_marks:    t.total_marks,
        correct_marks:  t.correct_marks,
        negative_marks: t.negative_marks,
        link_token:     t.link_token,
        published_at:   t.published_at,
        expires_at:     t.expires_at,
        already_attempted: attemptedIds.includes(t._id.toString())
      };
    });

    res.json({ success: true, tests: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
