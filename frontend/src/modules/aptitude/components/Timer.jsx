import React, { useEffect, useState } from 'react';

export default function Timer({ durationSec, onExpire, running, onTick }) {
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    setRemaining(durationSec);
  }, [durationSec]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (onTick) onTick(next);
        if (next <= 0) {
          clearInterval(id);
          onExpire?.();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onExpire, onTick]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="flex items-center gap-2 text-slate-700">
      <span className="font-semibold">Time Left:</span>
      <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 font-mono">{mm}:{ss}</span>
    </div>
  );
}
