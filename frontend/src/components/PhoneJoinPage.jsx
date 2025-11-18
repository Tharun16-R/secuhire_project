import React, { useEffect, useState } from 'react';
import { exchangePhoneToken } from '../lib/proctorApi';
import { joinAndPublish } from '../lib/livekitClient';

export default function PhoneJoinPage() {
  const [status, setStatus] = useState('connecting'); // connecting -> camera -> connected -> error
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const recorderRef = React.useRef(null);
  const sessionIdRef = React.useRef(null);
  const pollRef = React.useRef(null);

  useEffect(() => {
    let room;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (!token) throw new Error('Missing token');
        const { livekitToken, wsUrl } = await exchangePhoneToken(token);

        // Camera permission phase
        setStatus('camera');

        room = await joinAndPublish(wsUrl, livekitToken, { video: true, audio: true, facingMode: 'environment' });
        setStatus('connected');
        // Determine sessionId from token payload
        const payload = JSON.parse(atob(livekitToken.split('.')[1]));
        sessionIdRef.current = payload?.video?.room;

        // Prepare local recorder (controlled by server state)
        const vPub = Array.from(room.localParticipant.videoTracks.values())[0];
        const aPub = Array.from(room.localParticipant.audioTracks.values())[0];
        if (vPub && vPub.track && aPub && aPub.track) {
          const mediaStream = new MediaStream([
            vPub.track.mediaStreamTrack,
            aPub.track.mediaStreamTrack,
          ]);
          const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : 'video/webm';
          const rec = new MediaRecorder(mediaStream, { mimeType: mime });
          recorderRef.current = rec;
          rec.ondataavailable = async (e) => {
            if (e.data && e.data.size > 0) {
              try {
                const { uploadRecordingChunk } = await import('../lib/proctorApi');
                const sid = sessionIdRef.current;
                if (sid) await uploadRecordingChunk(sid, 'phone', e.data);
              } catch (err) {
                console.error('Phone chunk upload failed', err);
              }
            }
          };
          // Poll state every 3s
          const { getRecordingState } = await import('../lib/proctorApi');
          pollRef.current = setInterval(async () => {
            try {
              const sid = sessionIdRef.current;
              if (!sid) return;
              const st = await getRecordingState(sid);
              const should = !!st.recording;
              setRecording(should);
              if (recorderRef.current) {
                if (should && recorderRef.current.state === 'inactive') {
                  recorderRef.current.start(10000);
                } else if (!should && recorderRef.current.state !== 'inactive') {
                  recorderRef.current.stop();
                }
              }
            } catch {}
          }, 3000);
        }
      } catch (e) {
        const msg = e?.message || 'Unable to reach laptop. Check Wi-Fi and IP.';
        setError(msg);
        setStatus('error');
      }
    })();
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch {}
      if (pollRef.current) clearInterval(pollRef.current);
      try { room && room.disconnect(); } catch {}
    };
  }, []);

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      {status === 'connecting' && <div>Connecting to laptop...</div>}
      {status === 'camera' && <div>Requesting camera &amp; microphone permission...</div>}
      {status === 'connected' && <div style={{ color: 'green' }}>Connected to laptop. Streaming active.</div>}
      {status === 'error' && (
        <div style={{ color: 'red' }}>
          Error: {error || 'Unable to reach laptop. Check Wi-Fi and IP.'}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12 }}>Recording: <span style={{ color: recording ? '#16a34a' : '#64748b' }}>{recording ? 'ON' : 'OFF'}</span></div>
    </div>
  );
}
