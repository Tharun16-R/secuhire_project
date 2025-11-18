import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Shield, Download, Video, FileText, Eye, ListChecks, CheckSquare } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function RecruiterInterviews() {
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [questionSets, setQuestionSets] = useState([]);
  const [assigning, setAssigning] = useState({}); // interviewId -> loading
  const [showEvalFor, setShowEvalFor] = useState(null); // interview object
  const [evaluations, setEvaluations] = useState({}); // interviewId -> list
  const [evalForm, setEvalForm] = useState({ overall_score: '', rubric_scores: {}, notes: '' });
  const [showSubmissionFor, setShowSubmissionFor] = useState(null); // interview object
  const [submissionData, setSubmissionData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  // AI decision state per interview
  const [aiDecision, setAiDecision] = useState({}); // interviewId -> decision object
  const [aiLoading, setAiLoading] = useState({}); // interviewId -> loading
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideDecision, setOverrideDecision] = useState('REVIEW_REQUIRED');

  // Simple Scheduler panel state
  const [schedJobId, setSchedJobId] = useState('');
  const [schedCandidateId, setSchedCandidateId] = useState('');
  const [schedMinutes, setSchedMinutes] = useState(60);
  const [schedDays, setSchedDays] = useState(7);
  const [schedSlots, setSchedSlots] = useState([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const navigate = useNavigate();

  const headers = { Authorization: `Bearer ${localStorage.getItem('secuhire_token')}` };

  const fetchLists = async () => {
    try {
      setLoading(true);
      const [res, compRes, qsRes] = await Promise.all([
        axios.get(`${API}/interviews/upcoming`, { headers }),
        axios.get(`${API}/interviews/completed`, { headers }),
        axios.get(`${API}/question-sets`, { headers }),
      ]);
      setUpcoming(res.data || []);
      setCompleted(compRes.data || []);
      setQuestionSets(qsRes.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- AI Evaluation helpers ---
  const runAIEvaluation = async (interviewId) => {
    try {
      setAiLoading((s) => ({ ...s, [interviewId]: true }));
      const res = await axios.post(`${API}/ai/evaluate/${interviewId}`, null, { headers });
      setAiDecision((m) => ({ ...m, [interviewId]: res.data }));
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setAiLoading((s) => ({ ...s, [interviewId]: false }));
    }
  };

  const fetchAIDecision = async (interviewId) => {
    try {
      const res = await axios.get(`${API}/ai/evaluate/${interviewId}`, { headers });
      setAiDecision((m) => ({ ...m, [interviewId]: res.data }));
    } catch (e) {
      // ignore 404
    }
  };

  const overrideAIDecision = async (interviewId) => {
    try {
      setAiLoading((s) => ({ ...s, [interviewId]: true }));
      const res = await axios.post(`${API}/ai/evaluate/${interviewId}/override`, { decision: overrideDecision, note: overrideNote }, { headers });
      setAiDecision((m) => ({ ...m, [interviewId]: res.data }));
      setOverrideNote('');
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setAiLoading((s) => ({ ...s, [interviewId]: false }));
    }
  };

  // --- Scheduler helpers ---
  const proposeSlots = async () => {
    if (!schedJobId || !schedCandidateId) { setError('Enter Job ID and Candidate ID'); return; }
    try {
      setSchedLoading(true);
      const res = await axios.post(`${API}/ai/scheduler/propose`, {
        job_id: schedJobId,
        candidate_id: schedCandidateId,
        slot_minutes: Number(schedMinutes) || 60,
        days_ahead: Number(schedDays) || 7,
      }, { headers });
      setSchedSlots(res.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setSchedLoading(false);
    }
  };

  const bookSlot = async (slot) => {
    if (!slot?.start) return;
    try {
      setSchedLoading(true);
      await axios.post(`${API}/ai/scheduler/book`, {
        job_id: schedJobId,
        candidate_id: schedCandidateId,
        scheduled_date: slot.start,
      }, { headers });
      alert('Interview booked');
      setSchedSlots([]);
      await fetchLists();
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setSchedLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
    // periodic refresh every 15s to reflect new recordings/submissions
    const id = setInterval(fetchLists, 15000);
    return () => clearInterval(id);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const resumeUrl = (candidateId) => `${API}/candidates/${candidateId}/resume`;

  // Authenticated resume downloader
  const downloadResume = async (candidate) => {
    if (!candidate?.id) return;
    try {
      const resp = await axios.get(resumeUrl(candidate.id), {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${localStorage.getItem('secuhire_token')}` },
      });
      const blob = new Blob([resp.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate.full_name || 'candidate'}_resume`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e.response?.data?.detail || (e.response?.status === 403 ? 'Forbidden: resume accessible only for related applications' : 'Resume not available');
      setError(msg);
    }
  };
  const reportUrl = (interviewId) => `${API}/secure-interview/${interviewId}/report`;

  const withinRange = (dateStr) => {
    if (!fromDate && !toDate) return true;
    const ts = new Date(dateStr || 0).getTime();
    if (fromDate && ts < new Date(fromDate).getTime()) return false;
    if (toDate && ts > new Date(toDate).getTime() + 24*60*60*1000 - 1) return false; // inclusive
    return true;
  };

  const filterList = (items) => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const interview = item.interview || item;
      const candidate = item.candidate || {};
      const job = item.job || {};
      const textMatch = !term ||
        (candidate.full_name || '').toLowerCase().includes(term) ||
        (candidate.email || '').toLowerCase().includes(term) ||
        (job.title || '').toLowerCase().includes(term);
      const dateField = interview.ended_at || interview.scheduled_date || interview.started_at;
      const inRange = dateField ? withinRange(dateField) : true;
      return textMatch && inRange;
    });
  };

  const assignQuestionSet = async (interviewId, questionSetId) => {
    if (!interviewId || !questionSetId) return;
    try {
      setAssigning((s) => ({ ...s, [interviewId]: true }));
      await axios.post(
        `${API}/interviews/${interviewId}/assign-question-set`,
        null,
        { params: { question_set_id: questionSetId }, headers }
      );
      await fetchLists();
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setAssigning((s) => ({ ...s, [interviewId]: false }));
    }
  };

  const submitEvaluation = async () => {
    if (!showEvalFor?.id) return;
    const payload = {
      overall_score: evalForm.overall_score ? Number(evalForm.overall_score) : undefined,
      rubric_scores: evalForm.rubric_scores || {},
      notes: evalForm.notes || '',
    };
    try {
      await axios.post(
        `${API}/interviews/${showEvalFor.id}/evaluations`,
        payload,
        { headers }
      );
      // refresh evaluations list for this interview
      const res = await axios.get(`${API}/interviews/${showEvalFor.id}/evaluations`, { headers });
      setEvaluations((prev) => ({ ...prev, [showEvalFor.id]: res.data || [] }));
      setShowEvalFor(null);
      setEvalForm({ overall_score: '', rubric_scores: {}, notes: '' });
      await fetchLists();
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    }
  };

  const openEvaluation = async (interview) => {
    setShowEvalFor(interview);
    setEvalForm({ overall_score: '', rubric_scores: { communication: 0, technical: 0, culture_fit: 0 }, notes: '' });
    try {
      const res = await axios.get(`${API}/interviews/${interview.id}/evaluations`, { headers });
      setEvaluations(prev => ({ ...prev, [interview.id]: res.data || [] }));
    } catch (e) {
      setEvaluations(prev => ({ ...prev, [interview.id]: [] }));
    }
  };

  const openSubmission = async (interview) => {
    setShowSubmissionFor(interview);
    setSubmissionData(null);
    setSummaryData(null);
    try {
      const res = await axios.get(`${API}/interviews/${interview.id}/submission`, { headers });
      setSubmissionData(res.data);
    } catch (e) {
      setSubmissionData({ error: e.response?.data?.detail || 'No submission found yet' });
    }
    try {
      const sumRes = await axios.get(`${API}/interviews/${interview.id}/summary`, { headers });
      setSummaryData(sumRes.data || null);
    } catch (e) {
      setSummaryData(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50/20">
        <Shield className="w-10 h-10 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/20">
      <header className="bg-white border-b border-purple-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-7 h-7 text-purple-600" />
            <div>
              <h1 className="text-xl font-semibold">Recruiter Interviews</h1>
              <p className="text-sm text-slate-600">Upcoming interviews with quick actions</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-4">
        {/* Scheduler Panel */}
        <div className="p-4 border rounded bg-white">
          <div className="text-sm font-semibold mb-2">AI Scheduler</div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Job ID</label>
              <input value={schedJobId} onChange={(e)=>setSchedJobId(e.target.value)} className="border rounded px-3 py-1.5 w-56" placeholder="job_id" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Candidate ID</label>
              <input value={schedCandidateId} onChange={(e)=>setSchedCandidateId(e.target.value)} className="border rounded px-3 py-1.5 w-56" placeholder="candidate_id" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Minutes</label>
              <input type="number" min="15" value={schedMinutes} onChange={(e)=>setSchedMinutes(e.target.value)} className="border rounded px-3 py-1.5 w-24" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Days Ahead</label>
              <input type="number" min="1" value={schedDays} onChange={(e)=>setSchedDays(e.target.value)} className="border rounded px-3 py-1.5 w-24" />
            </div>
            <Button size="sm" onClick={proposeSlots} disabled={schedLoading}>{schedLoading ? 'Proposing…' : 'Propose'}</Button>
          </div>
          {schedSlots.length > 0 && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {schedSlots.map((s, idx) => (
                <div key={idx} className="p-2 border rounded flex items-center justify-between">
                  <div className="text-sm">{new Date(s.start).toLocaleString()} – {new Date(s.end).toLocaleTimeString()}</div>
                  <Button size="sm" onClick={()=>bookSlot(s)}>Book</Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Search (Candidate or Job)</label>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="e.g. John, Software Engineer" className="border rounded px-3 py-1.5 w-64" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} className="border rounded px-3 py-1.5" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={toDate} onChange={(e)=>setToDate(e.target.value)} className="border rounded px-3 py-1.5" />
          </div>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => setActiveTab('upcoming')} className={`px-3 py-1 rounded ${activeTab==='upcoming' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Upcoming</button>
          <button onClick={() => setActiveTab('completed')} className={`px-3 py-1 rounded ${activeTab==='completed' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Completed</button>
        </div>

        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        {activeTab === 'upcoming' && (
          filterList(upcoming).length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Upcoming Interviews</CardTitle>
                <CardDescription>Interviews you schedule will appear here.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            filterList(upcoming).map((item) => {
              const interview = item.interview || item; // support both enriched and raw
              const candidate = item.candidate || {};
              const job = item.job || {};
              return (
                <Card key={interview.id} className="bg-white border rounded-lg">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{job.title || 'Interview'}</CardTitle>
                      <CardDescription>
                        {new Date(interview.scheduled_date).toLocaleString()} • {job.location || 'Remote'}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(interview.status)}>{interview.status}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-slate-500">Candidate</div>
                        <div className="text-sm font-medium">{candidate.full_name || '-'}</div>
                        <div className="text-xs text-slate-500">{candidate.email || ''}</div>
                        {finalStatus && (
                          <div className="mt-1 text-xs font-semibold">
                            Final Status: <span className={finalStatus === 'Selected' ? 'text-green-700' : 'text-red-700'}>{finalStatus}</span>
                          </div>
                        )}
                        {rounds.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-slate-700">
                            {rounds.map((r) => (
                              <div key={r.round}>
                                Round {r.round}: {r.correctAnswers}/{(r.correctAnswers||0)+(r.wrongAnswers||0)} correct
                                {typeof r.percentage === 'number' && (
                                  <span> ({r.percentage.toFixed(1)}%)</span>
                                )}
                                {r.roundStatus && (
                                  <span> – {r.roundStatus}</span>
                                )}
                                {r.warnings ? <span> – warnings: {r.warnings}</span> : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {candidate.id && (
                          <Button variant="outline" size="sm" onClick={() => downloadResume(candidate)}>
                            <FileText className="w-4 h-4 mr-2" /> Resume
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => window.open(reportUrl(interview.id), '_blank')}>
                          <Eye className="w-4 h-4 mr-2" /> Report
                        </Button>
                        <Button size="sm" onClick={() => navigate(`/recordings/${interview.id}`)}>
                          <Video className="w-4 h-4 mr-2" /> Recordings
                        </Button>
                      </div>
                    </div>

                    {/* Assign Question Set */}
                    <div className="mt-4 p-3 bg-slate-50 border rounded">
                      <div className="text-sm font-medium mb-2 flex items-center gap-2">
                        <ListChecks className="w-4 h-4" /> Assign Question Set
                      </div>
                      <div className="flex items-center gap-2">
                        <select className="border rounded px-2 py-1" id={`qs-${interview.id}`} defaultValue="">
                          <option value="">Select question set…</option>
                          {questionSets.map(qs => (
                            <option key={qs.id} value={qs.id}>{qs.name}</option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={assigning[interview.id]}
                          onClick={() => assignQuestionSet(interview.id, document.getElementById(`qs-${interview.id}`).value)}
                        >
                          {assigning[interview.id] ? 'Assigning…' : 'Assign'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )
        )}

        {activeTab === 'completed' && (
          filterList(completed).length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Completed Interviews</CardTitle>
                <CardDescription>Completed interviews will appear here.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            filterList(completed).map((item) => {
              const interview = item.interview || item;
              const candidate = item.candidate || {};
              const job = item.job || {};
              const rounds = item.rounds || [];
              const finalStatus = item.finalStatus || candidate.finalStatus;
              return (
                <Card key={interview.id} className="bg-white border rounded-lg">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{job.title || 'Interview'}</CardTitle>
                      <CardDescription>
                        Ended at {interview.ended_at ? new Date(interview.ended_at).toLocaleString() : '-'} • {job.location || 'Remote'}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(interview.status)}>{interview.status}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-slate-500">Candidate</div>
                        <div className="text-sm font-medium">{candidate.full_name || '-'}</div>
                        <div className="text-xs text-slate-500">{candidate.email || ''}</div>
                        {finalStatus && (
                          <div className="mt-1 text-xs font-semibold">
                            Final Status:{' '}
                            <span className={finalStatus === 'Selected' ? 'text-green-700' : 'text-red-700'}>
                              {finalStatus}
                            </span>
                          </div>
                        )}
                        {rounds.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-slate-700">
                            {rounds.map((r) => {
                              const total = (r.correctAnswers || 0) + (r.wrongAnswers || 0);
                              return (
                                <div key={r.round}>
                                  Round {r.round}: {r.correctAnswers ?? 0}/{total || '-'} correct
                                  {typeof r.percentage === 'number' && (
                                    <span> ({r.percentage.toFixed(1)}%)</span>
                                  )}
                                  {r.roundStatus && (
                                    <span> – {r.roundStatus}</span>
                                  )}
                                  {r.warnings ? <span> – warnings: {r.warnings}</span> : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {candidate.id && (
                          <Button variant="outline" size="sm" onClick={() => window.open(resumeUrl(candidate.id), '_blank')}>
                            <FileText className="w-4 h-4 mr-2" /> Resume
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => window.open(reportUrl(interview.id), '_blank')}>
                          <Eye className="w-4 h-4 mr-2" /> Report
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openSubmission(interview)}>
                          <CheckSquare className="w-4 h-4 mr-2" /> Submission
                        </Button>
                        <Button size="sm" onClick={() => navigate(`/recordings/${interview.id}`)}>
                          <Video className="w-4 h-4 mr-2" /> Recordings
                        </Button>
                        <Button size="sm" onClick={() => openEvaluation(interview)}>
                          <CheckSquare className="w-4 h-4 mr-2" /> Evaluate
                        </Button>
                      </div>
                    </div>

                    {/* Existing evaluations list */}
                    {evaluations[interview.id]?.length > 0 && (
                      <div className="mt-3 p-3 border rounded bg-slate-50">
                        <div className="text-sm font-medium mb-2">Evaluations</div>
                        <ul className="space-y-1 text-sm">
                          {evaluations[interview.id].map((ev) => (
                            <li key={ev.id} className="flex justify-between">
                              <span>Score: {ev.overall_score ?? '-'} | Comm: {ev.rubic_scores?.communication ?? ev.rubric_scores?.communication ?? '-'} | Tech: {ev.rubric_scores?.technical ?? '-'}</span>
                              <span className="text-slate-500">{new Date(ev.created_at).toLocaleString?.() || ''}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* AI Decision */}
                    <div className="mt-3 p-3 border rounded bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">AI Decision</div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={()=>fetchAIDecision(interview.id)}>Refresh</Button>
                          <Button size="sm" onClick={()=>runAIEvaluation(interview.id)} disabled={aiLoading[interview.id]}>
                            {aiLoading[interview.id] ? 'Evaluating…' : 'Run Evaluation'}
                          </Button>
                        </div>
                      </div>
                      {aiDecision[interview.id] ? (
                        <div className="mt-2 text-sm">
                          <div>Decision: <strong>{aiDecision[interview.id].decision}</strong></div>
                          <div className="text-slate-600">Scores: {JSON.stringify(aiDecision[interview.id].scores)}</div>
                          <div className="text-slate-600">Reasons: {(aiDecision[interview.id].reasons||[]).join('; ')}</div>
                          <div className="mt-2 flex gap-2 items-end">
                            <select value={overrideDecision} onChange={(e)=>setOverrideDecision(e.target.value)} className="border rounded px-2 py-1">
                              <option value="PASS">PASS</option>
                              <option value="FAIL">FAIL</option>
                              <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
                            </select>
                            <input value={overrideNote} onChange={(e)=>setOverrideNote(e.target.value)} placeholder="Override note" className="border rounded px-2 py-1 flex-1" />
                            <Button size="sm" variant="outline" onClick={()=>overrideAIDecision(interview.id)} disabled={aiLoading[interview.id]}>Override</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-600">No AI decision yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )
        )}
      </main>

      {/* Simple evaluation modal */}
      {showEvalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowEvalFor(null)}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b font-semibold flex items-center gap-2">
              <CheckSquare className="w-4 h-4" /> Evaluation for Interview {showEvalFor.id.slice(0,8)}
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Overall (1-10)</label>
                  <input type="number" min="1" max="10" value={evalForm.overall_score}
                         onChange={(e)=>setEvalForm({...evalForm, overall_score: e.target.value})}
                         className="border rounded px-2 py-1 w-full" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Communication</label>
                  <input type="number" min="0" max="10" value={evalForm.rubric_scores.communication}
                         onChange={(e)=>setEvalForm({...evalForm, rubric_scores: { ...evalForm.rubric_scores, communication: Number(e.target.value)||0 }})}
                         className="border rounded px-2 py-1 w-full" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Technical</label>
                  <input type="number" min="0" max="10" value={evalForm.rubric_scores.technical}
                         onChange={(e)=>setEvalForm({...evalForm, rubric_scores: { ...evalForm.rubric_scores, technical: Number(e.target.value)||0 }})}
                         className="border rounded px-2 py-1 w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Culture Fit</label>
                <input type="number" min="0" max="10" value={evalForm.rubric_scores.culture_fit}
                       onChange={(e)=>setEvalForm({...evalForm, rubric_scores: { ...evalForm.rubric_scores, culture_fit: Number(e.target.value)||0 }})}
                       className="border rounded px-2 py-1 w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Notes</label>
                <textarea value={evalForm.notes}
                          onChange={(e)=>setEvalForm({...evalForm, notes: e.target.value})}
                          className="border rounded px-2 py-2 w-full h-24" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded" onClick={()=>setShowEvalFor(null)}>Close</button>
              <button className="px-3 py-1.5 bg-purple-600 text-white rounded" onClick={submitEvaluation}>Save Evaluation</button>
            </div>
          </div>
        </div>
      )}

      {/* Submission viewer modal */}
      {showSubmissionFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => { setShowSubmissionFor(null); setSubmissionData(null); setSummaryData(null); fetchLists(); }}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4" /> Submission for Interview {showSubmissionFor.id.slice(0,8)}
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {!submissionData && <div className="text-slate-500">Loading...</div>}
              {submissionData?.error && (
                <div className="text-red-600 text-sm">{submissionData.error}</div>
              )}
              {submissionData && !submissionData.error && (
                <>
                  <div className="text-sm text-slate-600">Submitted at: {submissionData.submitted_at ? new Date(submissionData.submitted_at).toLocaleString() : '-'}</div>
                  {(submissionData.frontCamUrl || submissionData.screenUrl) && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {submissionData.frontCamUrl && (
                        <div>
                          <div className="text-xs font-semibold mb-1">Front Camera</div>
                          <video src={submissionData.frontCamUrl} controls width="400" className="w-full max-w-xs rounded border" />
                        </div>
                      )}
                      {submissionData.screenUrl && (
                        <div>
                          <div className="text-xs font-semibold mb-1">Screen Recording</div>
                          <video src={submissionData.screenUrl} controls width="400" className="w-full max-w-xs rounded border" />
                        </div>
                      )}
                    </div>
                  )}
                  {summaryData && (
                    <div className="mt-2 p-3 border rounded bg-slate-50 space-y-2 text-sm">
                      <div className="font-medium mb-1">AI Behavior Summary</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Facial</div>
                          <div>Attention: {summaryData.facial_summary?.avg_attention != null ? `${(summaryData.facial_summary.avg_attention * 100).toFixed(1)}%` : '-'}</div>
                          <div>Eye Movement: {summaryData.facial_summary?.avg_eye_movement != null ? summaryData.facial_summary.avg_eye_movement.toFixed(2) : '-'}</div>
                          <div>Head Movement: {summaryData.facial_summary?.avg_head_movement != null ? summaryData.facial_summary.avg_head_movement.toFixed(2) : '-'}</div>
                          <div className="text-xs text-slate-500 mt-1">Samples: {summaryData.facial_summary?.records ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Voice</div>
                          <div>Clarity: {summaryData.voice_summary?.avg_voice_clarity != null ? `${(summaryData.voice_summary.avg_voice_clarity * 100).toFixed(1)}%` : '-'}</div>
                          <div>Speech Pattern: {summaryData.voice_summary?.avg_speech_pattern != null ? `${(summaryData.voice_summary.avg_speech_pattern * 100).toFixed(1)}%` : '-'}</div>
                          <div>Noise: {summaryData.voice_summary?.avg_background_noise != null ? `${(summaryData.voice_summary.avg_background_noise * 100).toFixed(1)}%` : '-'}</div>
                          <div className="text-xs text-slate-500 mt-1">Samples: {summaryData.voice_summary?.records ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Screen</div>
                          <div>Focus: {summaryData.screen_summary?.avg_focus != null ? `${(summaryData.screen_summary.avg_focus * 100).toFixed(1)}%` : '-'}</div>
                          <div>Sharing Quality: {summaryData.screen_summary?.avg_sharing_quality != null ? `${(summaryData.screen_summary.avg_sharing_quality * 100).toFixed(1)}%` : '-'}</div>
                          <div>Tab Switches: {summaryData.screen_summary?.tab_switch_events ?? 0}</div>
                          <div>Unauth Apps: {summaryData.screen_summary?.unauthorized_apps_events ?? 0}</div>
                          <div className="text-xs text-slate-500 mt-1">Samples: {summaryData.screen_summary?.records ?? 0}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {(submissionData.answers || []).map((a, idx) => (
                      <div key={idx} className="p-3 border rounded">
                        <div className="font-medium">Q{idx+1}. {a.question || a.questionText || 'Question'}</div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{String(a.answer ?? '')}</div>
                        <div className="text-xs text-slate-500 mt-1">Time Spent: {a.timeSpent ?? '-'}s</div>
                      </div>
                    ))}
                  </div>
                  {submissionData.ai_scores && (
                    <div className="mt-2 text-sm">AI Scores: {JSON.stringify(submissionData.ai_scores)}</div>
                  )}
                </>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button className="px-3 py-1.5 border rounded" onClick={() => { setShowSubmissionFor(null); setSubmissionData(null); setSummaryData(null); fetchLists(); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
