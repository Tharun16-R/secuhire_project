import { Router } from 'express';
import mongoose from 'mongoose';
import Question from '../models/Question.js';
import Session from '../models/Session.js';

const router = Router();

const ROUND_META = {
  1: { durationSec: 5 * 60, total: 25 },
  2: { durationSec: 20 * 60, total: 15 },
  3: { durationSec: 10 * 60, total: 12 },
};

router.post('/start', async (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });

  const exists = await Session.findOne({ email, status: 'in_progress' }).lean();
  if (exists) return res.json({ session: exists });

  const rounds = [1, 2, 3].map((r) => ({
    round: r,
    startedAt: null,
    endedAt: null,
    durationSec: 0,
    answers: [],
    score: 0,
    totalQuestions: ROUND_META[r].total,
  }));

  const session = await Session.create({ name, email, rounds, currentRound: 1 });
  return res.json({ session });
});

router.get('/questions', async (req, res) => {
  const round = parseInt(req.query.round, 10);
  if (![1, 2, 3].includes(round)) return res.status(400).json({ error: 'invalid round' });
  const total = ROUND_META[round].total;
  const count = await Question.countDocuments({ round });
  if (count < total) return res.status(500).json({ error: 'insufficient questions for this round' });
  const sample = await Question.aggregate([
    { $match: { round } },
    { $sample: { size: total } },
    // Explicitly include _id for client-side answer mapping
    { $project: { _id: 1, text: 1, options: 1 } },
  ]);
  if (!sample || !sample.length) return res.status(500).json({ error: 'no questions available' });
  return res.json({ questions: sample });
});

router.post('/submit-round', async (req, res) => {
  const { sessionId, round, answers, durationSec } = req.body || {};
  if (!sessionId || !round || !Array.isArray(answers)) return res.status(400).json({ error: 'invalid payload' });
  const session = await Session.findById(sessionId);
  if (!session) return res.status(404).json({ error: 'session not found' });
  const roundMeta = ROUND_META[round];
  if (!roundMeta) return res.status(400).json({ error: 'invalid round' });

  const qIds = answers.map((a) => new mongoose.Types.ObjectId(a.questionId));
  const qs = await Question.find({ _id: { $in: qIds } }).lean();
  const qMap = new Map(qs.map((q) => [q._id.toString(), q]));

  let score = 0;
  const checked = answers.map((a) => {
    const q = qMap.get(a.questionId);
    const correct = q && a.selectedKey && a.selectedKey === q.correctKey;
    if (correct) score += 1;
    return { questionId: a.questionId, selectedKey: a.selectedKey, isCorrect: !!correct };
  });

  const rIdx = session.rounds.findIndex((r) => r.round === round);
  session.rounds[rIdx].answers = checked;
  session.rounds[rIdx].score = score;
  session.rounds[rIdx].durationSec = Math.min(durationSec || 0, roundMeta.durationSec);
  session.rounds[rIdx].startedAt = session.rounds[rIdx].startedAt || new Date();
  session.rounds[rIdx].endedAt = new Date();

  if (round < 3) session.currentRound = round + 1;
  else session.status = 'completed';

  await session.save();

  return res.json({ roundScore: score, total: checked.length, nextRound: session.currentRound, status: session.status });
});

router.post('/warning', async (req, res) => {
  const { sessionId } = req.body || {};
  const session = await Session.findById(sessionId);
  if (!session) return res.status(404).json({ error: 'session not found' });
  session.warnings = Math.min(session.warnings + 1, session.maxWarnings);
  await session.save();
  const locked = session.warnings >= session.maxWarnings;
  return res.json({ warnings: session.warnings, maxWarnings: session.maxWarnings, locked });
});

router.get('/session/:id', async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  return res.json({ session });
});

router.post('/finish', async (req, res) => {
  const { sessionId } = req.body || {};
  const session = await Session.findById(sessionId);
  if (!session) return res.status(404).json({ error: 'session not found' });
  let totalScore = 0;
  let totalQuestions = 0;
  let totalTimeSec = 0;
  session.rounds.forEach((r) => {
    totalScore += r.score;
    totalQuestions += r.totalQuestions;
    totalTimeSec += r.durationSec;
  });
  session.totalScore = totalScore;
  session.totalQuestions = totalQuestions;
  session.totalTimeSec = totalTimeSec;
  session.status = 'completed';
  await session.save();
  return res.json({ session });
});

export default router;
