import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Question from './models/Question.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/secuhire_aptitude';

function genRound(round, total, prefix) {
  const opts = [
    { key: 'A', text: 'Option A' },
    { key: 'B', text: 'Option B' },
    { key: 'C', text: 'Option C' },
    { key: 'D', text: 'Option D' },
  ];
  const list = [];
  for (let i = 1; i <= total; i++) {
    const correctIdx = (i % 4);
    list.push({
      round,
      text: `${prefix} Q${i}: Sample question ${i}`,
      options: opts,
      correctKey: ['A', 'B', 'C', 'D'][correctIdx],
      difficulty: 'medium',
    });
  }
  return list;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const counts = await Promise.all([
    Question.countDocuments({ round: 1 }),
    Question.countDocuments({ round: 2 }),
    Question.countDocuments({ round: 3 }),
  ]);

  if (counts[0] < 25) {
    await Question.deleteMany({ round: 1 });
    await Question.insertMany(genRound(1, 30, 'Pattern Matching'));
  }
  if (counts[1] < 15) {
    await Question.deleteMany({ round: 2 });
    await Question.insertMany(genRound(2, 20, 'Logical Reasoning'));
  }
  if (counts[2] < 12) {
    await Question.deleteMany({ round: 3 });
    await Question.insertMany(genRound(3, 20, 'Quant + Logical Mix'));
  }

  console.log('Seed complete');
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
