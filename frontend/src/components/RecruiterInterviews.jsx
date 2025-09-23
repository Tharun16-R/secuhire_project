import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Shield, Download, Video, FileText, Eye } from 'lucide-react';

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
  const navigate = useNavigate();

  useEffect(() => {
    const headers = {
      Authorization: `Bearer ${localStorage.getItem('secuhire_token')}`,
    };
    async function fetchUpcoming() {
      try {
        setLoading(true);
        const res = await axios.get(`${API}/interviews/upcoming`, { headers });
        setUpcoming(res.data || []);
        const compRes = await axios.get(`${API}/interviews/completed`, { headers });
        setCompleted(compRes.data || []);
      } catch (e) {
        setError(e.response?.data?.detail || e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchUpcoming();
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
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">Candidate</div>
                      <div className="text-sm font-medium">{candidate.full_name || '-'}</div>
                      <div className="text-xs text-slate-500">{candidate.email || ''}</div>
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
                      <Button size="sm" onClick={() => navigate(`/recordings/${interview.id}`)}>
                        <Video className="w-4 h-4 mr-2" /> Recordings
                      </Button>
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
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">Candidate</div>
                      <div className="text-sm font-medium">{candidate.full_name || '-'}</div>
                      <div className="text-xs text-slate-500">{candidate.email || ''}</div>
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
                      <Button size="sm" onClick={() => navigate(`/recordings/${interview.id}`)}>
                        <Video className="w-4 h-4 mr-2" /> Recordings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )
        )}
      </main>
    </div>
  );
}
