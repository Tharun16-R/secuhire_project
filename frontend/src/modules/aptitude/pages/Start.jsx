import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { startSession } from '../api';

export default function Start() {
  const navigate = useNavigate();
  const location = useLocation();
  const pre = (location && location.state) || {};
  const [form, setForm] = useState({ name: pre.name || '', email: pre.email || '' });
  const [loading, setLoading] = useState(false);

  const begin = async () => {
    if (!form.name || !form.email) return alert('Please provide name and email');
    setLoading(true);
    try {
      const { session } = await startSession(form);
      localStorage.setItem('apt_session_id', session._id);
      navigate(`/aptitude/round/1`);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 p-6">
      <div className="max-w-xl mx-auto bg-white/90 backdrop-blur-sm rounded-xl shadow-xl border p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-800">Aptitude Test Instructions</h1>
          <p className="text-slate-600">You will face 3 rounds. Each round has strict timing. Switching tabs will give warnings.</p>
          <ul className="text-slate-700 text-sm list-disc pl-5">
            <li>Round 1: Pattern Matching (5 mins, 25 questions)</li>
            <li>Round 2: Logical Reasoning (20 mins, 15 questions)</li>
            <li>Round 3: Quantitative + Logical Mix (10 mins, 12 questions)</li>
          </ul>
        </div>
        {!pre.name || !pre.email ? (
          <div className="grid gap-3">
            <input className="border rounded px-3 py-2" placeholder="Full Name" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} />
            <input className="border rounded px-3 py-2" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} />
          </div>
        ) : (
          <div className="text-sm text-slate-700">
            You are signed in as <span className="font-semibold">{pre.name}</span> ({pre.email}).
          </div>
        )}
        <button disabled={loading} onClick={begin} className="w-full px-4 py-3 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">{loading ? 'Starting...' : 'Start Test'}</button>
      </div>
    </div>
  );
}
