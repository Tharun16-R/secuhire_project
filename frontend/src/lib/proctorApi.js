const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const BACKEND = `${API_BASE}/api`;

export async function createSession() {
  const r = await fetch(`${BACKEND}/session`, { method: 'POST' });
  if (!r.ok) throw new Error('Failed to create session');
  return r.json();
}

export async function getRecordingState(sessionId) {
  const u = new URL(`${BACKEND}/recordings/state`);
  u.searchParams.set('sessionId', sessionId);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error('Failed to get recording state');
  return r.json();
}

export async function setRecordingState(sessionId, recording) {
  const r = await fetch(`${BACKEND}/recordings/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, recording })
  });
  if (!r.ok) throw new Error('Failed to set recording state');
  return r.json();
}

export async function startEgress(sessionId) {
  const r = await fetch(`${BACKEND}/egress/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
  return r.json();
}

export async function stopEgress(egressId) {
  const r = await fetch(`${BACKEND}/egress/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ egressId })
  });
  return r.json();
}

export async function exchangePhoneToken(token, identity) {
  const r = await fetch(`${BACKEND}/phone-join-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, identity })
  });
  if (!r.ok) throw new Error('Failed to exchange phone token');
  return r.json();
}

export async function laptopJoinToken(sessionId, identity) {
  const r = await fetch(`${BACKEND}/laptop-join-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, identity })
  });
  if (!r.ok) throw new Error('Failed to get laptop join token');
  return r.json();
}

export async function interviewerJoinToken(sessionId, identity) {
  const r = await fetch(`${BACKEND}/interviewer-join-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, identity })
  });
  if (!r.ok) throw new Error('Failed to get interviewer join token');
  return r.json();
}

export async function listRecordings(sessionId) {
  const r = await fetch(`${BACKEND}/recordings/${sessionId}`);
  if (!r.ok) throw new Error('Failed to list recordings');
  return r.json();
}

export async function uploadRecordingChunk(sessionId, source, blob) {
  const fd = new FormData();
  fd.append('sessionId', sessionId);
  fd.append('source', source);
  fd.append('file', blob, `${source}-${Date.now()}.webm`);
  const r = await fetch(`${BACKEND}/recordings/upload`, {
    method: 'POST',
    body: fd
  });
  if (!r.ok) throw new Error('Failed to upload recording');
  return r.json();
}
