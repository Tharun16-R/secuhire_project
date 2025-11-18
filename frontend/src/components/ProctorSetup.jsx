import React, { useEffect, useRef, useState } from 'react';
import QRForPhoneJoin from './QRForPhoneJoin';
import { createSession, laptopJoinToken, getRecordingState } from '../lib/proctorApi';
import { joinAndPublish } from '../lib/livekitClient';
export default function ProctorSetup() {
  const [sessionId, setSessionId] = useState('');
  const [phoneJoinToken, setPhoneJoinToken] = useState('');
  const [status, setStatus] = useState('initializing');
  const [recording, setRecording] = useState(false);
  const roomRef = useRef(null);
  const recorderRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    let room;
    (async () => {
      const { sessionId, phoneJoinToken } = await createSession();
      setSessionId(sessionId);
      setPhoneJoinToken(phoneJoinToken);

      const { wsUrl, livekitToken } = await laptopJoinToken(sessionId);
      room = await joinAndPublish(wsUrl, livekitToken, { video: true, audio: true, facingMode: 'user' });
      roomRef.current = room;

      // Prepare MediaRecorder but do not start yet; controlled by server state
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
              await uploadRecordingChunk(sessionId, 'laptop', e.data);
            } catch (err) {
              console.error('Upload chunk failed', err);
            }
          }
        };
      }

      setStatus('ready');
      // poll record state every 3s
      pollRef.current = setInterval(async () => {
        try {
          const s = await getRecordingState(sessionId);
          const shouldRecord = !!s.recording;
          setRecording(shouldRecord);
          if (recorderRef.current) {
            if (shouldRecord && recorderRef.current.state === 'inactive') {
              recorderRef.current.start(10000);
            } else if (!shouldRecord && recorderRef.current.state !== 'inactive') {
              recorderRef.current.stop();
            }
          }
        } catch {}
      }, 3000);
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
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Interview Proctoring Setup</h2>
      <div className="text-sm text-slate-600 mb-4">Session ID: {sessionId || '...'}</div>
      <p className="mb-3">Scan this QR code on your phone to connect the secondary camera.</p>
      {phoneJoinToken && <QRForPhoneJoin phoneJoinToken={phoneJoinToken} />}
      <div className="mt-4 text-sm text-slate-600">Status: {status}</div>
      <div className="mt-2 text-sm">
        Recording: <span className={recording ? 'text-green-600' : 'text-slate-500'}>{recording ? 'ON' : 'OFF'}</span>
      </div>
    </div>
  );
}
