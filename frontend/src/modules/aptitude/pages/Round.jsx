import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addWarning, fetchQuestions, submitRound } from '../api';
import QuestionCard from '../components/QuestionCard';
import Timer from '../components/Timer';
import RoundNavigation from '../components/RoundNavigation';

const ROUND_META = {
  1: { title: 'Pattern Matching', durationSec: 5*60 },
  2: { title: 'Logical Reasoning', durationSec: 20*60 },
  3: { title: 'Quant + Logical Mix', durationSec: 10*60 },
};

function useTabWarning(sessionId, onMax) {
  const [warnings, setWarnings] = useState(0);
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState === 'hidden') {
        try {
          const res = await addWarning(sessionId);
          setWarnings(res.warnings);
          if (res.locked) onMax?.();
        } catch (e) {}
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [sessionId, onMax]);
  return warnings;
}

export default function Round() {
  const { roundId } = useParams();
  const round = Number(roundId);
  const meta = ROUND_META[round];
  const navigate = useNavigate();
  const sessionId = localStorage.getItem('apt_session_id');
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(true);
  const [warningBanner, setWarningBanner] = useState('');

  const keyLS = `apt_answers_session_${sessionId}_round_${round}`;
  const [answers, setAnswers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(keyLS)) || {};
    } catch {
      return {};
    }
  });

  const warnings = useTabWarning(sessionId, () => {
    setWarningBanner('Maximum warnings reached. Auto-submitting round.');
    doSubmit(true);
  });

  useEffect(() => {
    (async () => {
      try {
        const { questions } = await fetchQuestions(round);
        setQuestions(questions);
      } catch (e) {
        alert(e.message);
      }
    })();
  }, [round]);

  // Proctor-style locking: fullscreen, block context menu and common shortcuts, warn on unload
  useEffect(() => {
    let keydown;
    const onContextMenu = (e) => { e.preventDefault(); };
    if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
      try { document.documentElement.requestFullscreen(); } catch {}
    }
    document.addEventListener('contextmenu', onContextMenu);
    keydown = (e) => {
      const key = e.key?.toLowerCase();
      const combo = [e.ctrlKey ? 'ctrl' : '', e.shiftKey ? 'shift' : '', e.altKey ? 'alt' : '', key].filter(Boolean).join('+');
      const blocked = new Set(['f11','f12','escape','ctrl+shift+i','ctrl+shift+c','ctrl+shift+j','ctrl+u','ctrl+w','ctrl+t','ctrl+l','ctrl+r','ctrl+n']);
      if (blocked.has(combo)) { e.preventDefault(); }
    };
    document.addEventListener('keydown', keydown, { capture: true });
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = 'Test in progress. Are you sure you want to leave?'; return e.returnValue; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      try { document.removeEventListener('contextmenu', onContextMenu); } catch {}
      try { document.removeEventListener('keydown', keydown, { capture: true }); } catch {}
      try { window.removeEventListener('beforeunload', onBeforeUnload); } catch {}
      try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch {}
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(keyLS, JSON.stringify(answers));
  }, [answers, keyLS]);

  const onAnswer = (qid, key) => setAnswers((a) => ({ ...a, [qid]: key }));

  const doSubmit = async (auto=false, durationOverrideSec) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payloadAnswers = questions.map((q) => ({ questionId: q._id, selectedKey: answers[q._id] || null }));
      const used = typeof durationOverrideSec === 'number' ? durationOverrideSec : undefined;
      const res = await submitRound({ sessionId, round, answers: payloadAnswers, durationSec: used });
      localStorage.removeItem(keyLS);
      if (round < 3) navigate(`/aptitude/round/${round+1}`, { state: { prev: { score: res.roundScore, total: payloadAnswers.length } } });
      else navigate(`/aptitude/final/${sessionId}`, { state: { last: { score: res.roundScore, total: payloadAnswers.length } } });
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!meta) return <div className="p-6">Invalid round</div>;

  const current = questions[idx];
  const value = current ? answers[current._id] || '' : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 p-4">
      <div className="max-w-3xl mx-auto bg-white/90 border rounded-xl shadow p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">{meta.title}</h1>
          <Timer
            durationSec={meta.durationSec}
            running={running}
            onTick={(sec)=>{}}
            onExpire={() => doSubmit(true, 0)}
          />
        </div>

        {warningBanner && (
          <div className="mt-3 p-3 rounded bg-yellow-50 border border-yellow-300 text-yellow-800">{warningBanner}</div>
        )}
        {!!warnings && (
          <div className="mt-2 text-sm text-orange-700">⚠️ Warning {warnings} of 5</div>
        )}

        <div className="mt-6">
          {current ? (
            <QuestionCard index={idx} question={current} value={value} onChange={(k)=>onAnswer(current._id, k)} />
          ) : (
            <div className="text-slate-600">Loading questions...</div>
          )}
        </div>

        <RoundNavigation
          canPrev={idx > 0}
          canNext={idx < Math.max(0, questions.length - 1)}
          current={idx}
          total={questions.length}
          onPrev={() => setIdx((i) => Math.max(0, i - 1))}
          onNext={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
          onSubmit={() => doSubmit(false)}
        />
      </div>
    </div>
  );
}
