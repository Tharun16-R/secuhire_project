import React from 'react';

export default function QuestionCard({ index, question, value, onChange }) {
  return (
    <div className="space-y-4">
      <div className="text-slate-800 font-semibold">Q{index + 1}. {question.text}</div>
      <div className="grid gap-2">
        {question.options.map((opt) => (
          <label key={opt.key} className={`border rounded p-3 cursor-pointer flex items-center gap-3 ${value === opt.key ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input
              type="radio"
              className="hidden"
              name={`q-${question._id || index}`}
              checked={value === opt.key}
              onChange={() => onChange(opt.key)}
            />
            <span className="w-6 h-6 flex items-center justify-center rounded-full border font-semibold">
              {opt.key}
            </span>
            <span className="text-slate-700">{opt.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
