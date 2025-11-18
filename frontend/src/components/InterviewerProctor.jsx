import React, { useEffect, useRef, useState } from 'react';
import { interviewerJoinToken, listRecordings, setRecordingState, getRecordingState, startEgress, stopEgress } from '../lib/proctorApi';
import { Room } from 'livekit-client';
import { attachSubscribed } from '../lib/livekitClient';

export default function InterviewerProctor({ sessionId }) {
  const gridRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [files, setFiles] = useState([]);
  const [recording, setRecording] = useState(false);
  const [egressInfo, setEgressInfo] = useState(null);

  useEffect(() => {
    let r;
    (async () => {
      const { wsUrl, livekitToken } = await interviewerJoinToken(sessionId);
      r = new Room({ adaptiveStream: true, dynacast: true });
      await r.connect(wsUrl, livekitToken);
      setRoom(r);
      setStatus('connected');
      if (gridRef.current) attachSubscribed(gridRef.current, r);
      const { files } = await listRecordings(sessionId);
      setFiles(files);
      // initialize recording state
      try { const st = await getRecordingState(sessionId); setRecording(!!st.recording); } catch {}
    })();
    return () => { try { r && r.disconnect(); } catch {} };
  }, [sessionId]);

  async function startRec() {
    await setRecordingState(sessionId, true);
    setRecording(true);
  }

  async function stopRec() {
    await setRecordingState(sessionId, false);
    setRecording(false);
    const { files } = await listRecordings(sessionId);
    setFiles(files);
  }

  async function tryStartEgress() {
    try {
      const info = await startEgress(sessionId);
      setEgressInfo(info);
    } catch (e) {
      alert((e?.message) || 'Egress not configured');
    }
  }

  async function tryStopEgress() {
    try {
      if (egressInfo?.egressId) {
        const res = await stopEgress(egressInfo.egressId);
        setEgressInfo(null);
      }
    } catch (e) {
      alert((e?.message) || 'Egress not configured');
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Interviewer Proctor</h2>
      <div className="text-sm text-slate-600 mb-2">Session: {sessionId} • Status: {status}</div>
      <div className="mb-4 flex items-center gap-2">
        <button className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50" onClick={startRec} disabled={recording}>Start Recording</button>
        <button className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50" onClick={stopRec} disabled={!recording}>Stop Recording</button>
        <span className="text-sm">Recording: <span className={recording ? 'text-green-600' : 'text-slate-500'}>{recording ? 'ON' : 'OFF'}</span></span>
      </div>
      <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} />
      <div className="mt-6">
        <h3 className="font-medium">Recorded Files</h3>
        <div className="grid md:grid-cols-2 gap-4 mt-2">
          {files.map(f => (
            <div key={f.filename} className="border rounded p-2">
              <div className="text-sm mb-1">{f.filename}</div>
              {f.filename.endsWith('.webm') || f.filename.endsWith('.mp4') ? (
                <video controls src={f.path} style={{ width: '100%', borderRadius: 8 }} />
              ) : (
                <a className="text-blue-600" href={f.path} target="_blank" rel="noreferrer">Download</a>
              )}
            </div>
          ))}
          {!files.length && <div className="text-slate-500">No recordings yet</div>}
        </div>
      </div>
      <div className="mt-6">
        <h3 className="font-medium">Composite Recording (optional)</h3>
        <div className="flex items-center gap-2 mt-2">
          <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={tryStartEgress}>Start Egress</button>
          <button className="px-3 py-1 rounded bg-slate-700 text-white" onClick={tryStopEgress} disabled={!egressInfo}>Stop Egress</button>
          {egressInfo && <span className="text-sm text-slate-600">Egress: {egressInfo.egressId || 'running'}</span>}
        </div>
        <div className="text-xs text-slate-500 mt-1">Note: server returns 501 unless LiveKit Egress is configured.</div>
      </div>
    </div>
  );
}
