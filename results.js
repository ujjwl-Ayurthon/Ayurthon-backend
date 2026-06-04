const express = require('express');
const router = express.Router();
const Result = require('./Result');
const Test = require('./Test');
const Student = require('./Student');
const Question = require('./Question');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/submit', async (req, res) => {
  try {
    const { test_token, student_name, telegram_username, answers, time_taken_seconds } = req.body;
    if (!test_token || !student_name || !answers) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const test = await Test.findOne({ link_token: test_token, status: 'published' }).populate('questions');
    if (!test) return res.status(404).json({ error: 'Test not found or already closed' });

    let student = await Student.findOne({ telegram_username: telegram_username?.toLowerCase() });
    if (!student) {
      student = new Student({ name: student_name, telegram_username: telegram_username?.toLowerCase() || '' });
      await student.save();
    }

    const existing = await Result.findOne({ student_id: student._id, test_id: test._id });
    if (existing) return res.status(400).json({ error: 'Already submitted this test' });

    let correct = 0, incorrect = 0, unattempted = 0;
    const processedAnswers = [];
    const wrongQuestions = [];

    test.questions.forEach(question => {
      const selected = answers[question._id.toString()] || null;
      const isCorrect = selected === question.correct_answer;
      if (!selected) unattempted++;
      else if (isCorrect) correct++;
      else { incorrect++; wrongQuestions.push(question._id); }
      processedAnswers.push({
        question_id: question._id,
        selected_option: selected,
        correct_option: question.correct_answer,
        is_correct: isCorrect
      });
    });

    const score = correct - (incorrect * (test.negative_marks || 0));
    const accuracy = test.questions.length > 0 ? Math.round((correct / test.questions.length) * 100) : 0;

    const result = new Result({
      student_id: student._id, test_id: test._id,
      score, total_marks: test.questions.length,
      correct, incorrect, unattempted, accuracy,
      time_taken_seconds: time_taken_seconds || 0,
      answers: processedAnswers,
      wrong_questions: wrongQuestions
    });
    await result.save();

    student.attempts.push(result._id);
    await student.save();

    const higherScores = await Result.countDocuments({ test_id: test._id, score: { $gt: score } });
    const rank = higherScores + 1;
    result.rank = rank;
    await result.save();

    const wrongQuestionsDetail = await Question.find({ _id: { $in: wrongQuestions } })
      .select('text options correct_answer explanation reference type');

    res.json({
      success: true,
      result: {
        _id: result._id, score, total: test.questions.length,
        correct, incorrect, unattempted, accuracy, rank,
        time_taken_seconds, wrong_questions: wrongQuestionsDetail,
        answers: processedAnswers
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard/:test_id', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const results = await Result.find({ test_id: req.params.test_id })
      .sort({ score: -1, time_taken_seconds: 1 })
      .limit(Number(limit))
      .populate('student_id', 'name telegram_username');
    const leaderboard = results.map((r, i) => ({
      rank: i + 1,
      name: r.student_id?.name || 'Unknown',
      telegram_username: r.student_id?.telegram_username || '',
      score: r.score, total: r.total_marks,
      correct: r.correct, incorrect: r.incorrect,
      accuracy: r.accuracy, time_taken: r.time_taken_seconds
    }));
    res.json({ success: true, leaderboard, total_students: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/test/:test_id', adminAuth, async (req, res) => {
  try {
    const results = await Result.find({ test_id: req.params.test_id })
      .sort({ score: -1 })
      .populate('student_id', 'name telegram_username');
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics/:test_id', adminAuth, async (req, res) => {
  try {
    const results = await Result.find({ test_id: req.params.test_id });
    if (results.length === 0) return res.json({ success: true, analytics: null });
    const scores = results.map(r => r.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const total = results[0].total_marks;
    const distribution = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
    results.forEach(r => {
      const pct = (r.score / total) * 100;
      if (pct <= 25) distribution['0-25']++;
      else if (pct <= 50) distribution['26-50']++;
      else if (pct <= 75) distribution['51-75']++;
      else distribution['76-100']++;
    });
    res.json({
      success: true,
      analytics: {
        total_students: results.length,
        average_score: Math.round(avg * 10) / 10,
        highest_score: Math.max(...scores),
        lowest_score: Math.min(...scores),
        average_accuracy: Math.round(results.reduce((a, r) => a + r.accuracy, 0) / results.length),
        score_distribution: distribution
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:result_id', async (req, res) => {
  try {
    const result = await Result.findById(req.params.result_id)
      .populate('student_id', 'name telegram_username')
      .populate('test_id', 'title type duration_minutes')
      .populate('wrong_questions', 'text options correct_answer explanation reference type');
    if (!result) return res.status(404).json({ error: 'Result not found' });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
