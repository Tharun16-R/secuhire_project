import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { finishSession, getSession } from '../api';
import ResultScreen from '../components/ResultScreen';

export default function Final() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { session } = await finishSession(sessionId);
        setData(session);
        localStorage.removeItem('apt_session_id');
      } catch (e) {
        try {
          const { session } = await getSession(sessionId);
          setData(session);
        } catch (err) {
          alert(err.message);
        }
      }
    })();
  }, [sessionId]);

  if (!data) return <div className="p-6">Loading...</div>;

  const accuracy = data.totalQuestions ? Math.round((data.totalScore / data.totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 p-4">
      <div className="max-w-2xl mx-auto bg-white/90 border rounded-xl shadow p-6">
        <ResultScreen
          title="Final Scorecard"
          score={data.totalScore}
          total={data.totalQuestions}
          extra={(
            <div className="text-slate-700 space-y-1">
              <div>Accuracy: <span className="font-semibold">{accuracy}%</span></div>
              <div>Total Time: <span className="font-semibold">{Math.round(data.totalTimeSec/60)} mins</span></div>
              <div>Warnings: <span className="font-semibold">{data.warnings} / {data.maxWarnings}</span></div>
            </div>
          )}
        />
        <div className="text-center">
          <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 rounded bg-teal-600 text-white hover:bg-teal-700">Go to Home</button>
        </div>
      </div>
    </div>
  );
}
