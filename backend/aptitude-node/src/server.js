import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import aptitudeRouter from './routes/aptitude.js';

dotenv.config();

const app = express();

const CORS_ORIGINS = process.env.CORS_ORIGINS || '*';
let corsOptions = {};
if (CORS_ORIGINS === '*') {
  corsOptions = { origin: '*' };
} else {
  const origins = CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  corsOptions = { origin: origins, credentials: true };
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/aptitude', aptitudeRouter);

const PORT = process.env.PORT || 7001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/secuhire_aptitude';

async function start() {
  await mongoose.connect(MONGO_URI);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aptitude service running on port ${PORT}`);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
