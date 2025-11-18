import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AptitudeQuestion', required: true },
    selectedKey: { type: String },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const roundSchema = new mongoose.Schema(
  {
    round: { type: Number, enum: [1, 2, 3], required: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSec: { type: Number, default: 0 },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    currentRound: { type: Number, default: 1 },
    warnings: { type: Number, default: 0 },
    maxWarnings: { type: Number, default: 5 },
    rounds: { type: [roundSchema], default: [] },
    totalScore: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    totalTimeSec: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('AptitudeSession', sessionSchema);
