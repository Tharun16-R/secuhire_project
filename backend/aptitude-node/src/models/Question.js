import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    round: { type: Number, enum: [1, 2, 3], required: true },
    text: { type: String, required: true },
    options: { type: [optionSchema], required: true },
    correctKey: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  },
  { timestamps: true }
);

export default mongoose.model('AptitudeQuestion', questionSchema);
