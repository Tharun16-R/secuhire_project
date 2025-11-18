import express from 'express';
import dotenv from 'dotenv';
import { EgressClient, RoomCompositeEgressRequest } from 'livekit-server-sdk';

dotenv.config();

const app = express();
app.use(express.json());

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'http://livekit:7880';
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || '/recordings';

function client() {
  return new EgressClient(LIVEKIT_WS_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/start', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const base = `${RECORDINGS_DIR}/${sessionId}`;
    const filepath = `${base}/${sessionId}-${Date.now()}.mp4`;

    const request = new RoomCompositeEgressRequest({
      roomName: sessionId,
      layout: 'grid',
      fileOutputs: [{ filepath, fileType: 'MP4' }]
    });

    const info = await client().startRoomCompositeEgress(request);
    return res.json({ ok: true, egressId: info.egressId, filepath });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'egress start failed' });
  }
});

app.post('/stop', async (req, res) => {
  try {
    const { egressId } = req.body;
    if (!egressId) return res.status(400).json({ error: 'egressId required' });
    const info = await client().stopEgress(egressId);
    return res.json({ ok: true, info });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'egress stop failed' });
  }
});

const bind = process.env.EGRESS_BIND || '0.0.0.0';
const port = Number(process.env.EGRESS_PORT || 3001);
app.listen(port, bind, () => {
  console.log(`Egress service listening on ${bind}:${port}`);
});
