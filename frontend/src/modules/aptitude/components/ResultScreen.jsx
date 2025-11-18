import React from 'react';

export default function ResultScreen({ title, score, total, onNext, extra }) {
  const accuracy = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className="text-center space-y-4 py-10">
      <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
      <div className="text-slate-700">Score: <span className="font-semibold">{score} / {total}</span> ({accuracy}%)</div>
      {extra}
      {onNext && (
        <button onClick={onNext} className="mt-4 px-6 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">Continue</button>
      )}
    </div>
  );
}
