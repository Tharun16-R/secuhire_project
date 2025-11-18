import React from 'react';

export default function RoundNavigation({ canPrev, canNext, onPrev, onNext, onSubmit, current, total }) {
  return (
    <div className="flex items-center justify-between mt-6">
      <button disabled={!canPrev} onClick={onPrev} className={`px-4 py-2 rounded border ${canPrev ? 'hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'}`}>Previous</button>
      <div className="text-sm text-slate-600">{current + 1} / {total}</div>
      {canNext ? (
        <button onClick={onNext} className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">Next</button>
      ) : (
        <button onClick={onSubmit} className="px-4 py-2 rounded bg-teal-600 text-white hover:bg-teal-700">Submit Round</button>
      )}
    </div>
  );
}
