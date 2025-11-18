// Simple API client for Aptitude backend
const BASE = process.env.REACT_APP_APTITUDE_API_URL || 'http://localhost:7001/api/aptitude';

export async function startSession(payload) {
  const res = await fetch(`${BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to start session');
  return res.json();
}

export async function fetchQuestions(round) {
  const res = await fetch(`${BASE}/questions?round=${round}`);
  if (!res.ok) throw new Error('Failed to fetch questions');
  return res.json();
}

export async function submitRound(payload) {
  const res = await fetch(`${BASE}/submit-round`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to submit round');
  return res.json();
}

export async function addWarning(sessionId) {
  const res = await fetch(`${BASE}/warning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error('Failed to add warning');
  return res.json();
}

export async function getSession(sessionId) {
  const res = await fetch(`${BASE}/session/${sessionId}`);
  if (!res.ok) throw new Error('Failed to get session');
  return res.json();
}

export async function finishSession(sessionId) {
  const res = await fetch(`${BASE}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error('Failed to finish session');
  return res.json();
}
