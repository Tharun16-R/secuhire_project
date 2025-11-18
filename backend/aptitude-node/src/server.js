import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import aptitudeRouter from './routes/aptitude.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/aptitude', aptitudeRouter);

const PORT = process.env.PORT || 7001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/secuhire_aptitude';

async function start() {
  await mongoose.connect(MONGO_URI);
  app.listen(PORT, () => console.log(`Aptitude backend on :${PORT}`));
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
