import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Download, Play, Shield, ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function RecordingsViewer() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState([]);
  const [monitoring, setMonitoring] = useState(null);
  const [summary, setSummary] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [selectedRecordingUrl, setSelectedRecordingUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const headers = {
      Authorization: `Bearer ${localStorage.getItem('secuhire_token')}`,
    };

    async function fetchData() {
      try {
        setLoading(true);
        // Get recordings list
        const recRes = await axios.get(`${API}/secure-interview/${interviewId}/recordings`, { headers });
        setRecordings(recRes.data || []);
        // Fetch interview monitoring snapshot (candidate info, violations, live status)
        const [monRes, sumRes] = await Promise.all([
          axios.get(`${API}/interviews/${interviewId}/monitoring`, { headers }),
          axios.get(`${API}/interviews/${interviewId}/summary`, { headers })
        ]);
        setMonitoring(monRes.data || null);
        setSummary(sumRes.data || null);

        // Submission (answers) is optional; handle 404 without throwing
        try {
          const subRes = await axios.get(`${API}/interviews/${interviewId}/submission`, { headers });
          setSubmission(subRes.data || null);
        } catch (e) {
          if (e.response?.status === 404) {
            setSubmission(null);
          } else {
            console.warn('Failed to fetch submission', e);
          }
        }
      } catch (e) {
        setError(e.response?.data?.detail || e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [interviewId]);

  const playRecording = async (recId) => {
    try {
      const url = `${API}/secure-interview/recordings/${recId}`;
      setSelectedRecordingUrl(url);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    }
  };

  const downloadRecording = (recId) => {
    const url = `${API}/secure-interview/recordings/${recId}`;
    window.open(url, '_blank');
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-7 h-7 text-purple-600" />
            <div>
              <h1 className="text-xl font-semibold">Interview Recordings</h1>
              <p className="text-sm text-slate-600">Interview ID: {interviewId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => window.open(`${API}/secure-interview/${interviewId}/report`, '_blank')}>
              <Download className="w-4 h-4 mr-2" /> Download Report
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-3 gap-6">
        {/* Candidate summary and actions */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Candidate & Session</CardTitle>
            <CardDescription>Summary for recruiter review</CardDescription>
          </CardHeader>
          <CardContent>
            {monitoring ? (
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">Candidate</div>
                  <div className="font-medium">{monitoring.candidate?.full_name || '-'}</div>
                  <div className="text-slate-500">{monitoring.candidate?.email || ''}</div>
                </div>
                <div>
                  <div className="text-slate-500">Interview Status</div>
                  <Badge className={monitoring.is_live ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                    {monitoring.is_live ? 'Live' : 'Completed/Not Live'}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  {monitoring.candidate?.id && (
                    <Button size="sm" onClick={() => window.open(`${API}/candidates/${monitoring.candidate.id}/resume`, '_blank')}>
                      <Download className="w-4 h-4 mr-1" /> Resume
                    </Button>
                  )}
                  <Badge variant="outline">Violations: {(monitoring.security_violations || []).length}</Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No monitoring data available.</div>
            )}
          </CardContent>
        </Card>

        {/* Analytics summary */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Interview Analytics</CardTitle>
            <CardDescription>Facial, Voice, and Screen summaries</CardDescription>
          </CardHeader>
          <CardContent>
            {summary ? (
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div>
                  <div className="font-medium mb-2">Facial</div>
                  <div className="space-y-1 text-slate-700">
                    <div>Eye Movement: {summary.facial_summary?.avg_eye_movement != null ? (summary.facial_summary.avg_eye_movement).toFixed(2) : '-'}</div>
                    <div>Head Movement: {summary.facial_summary?.avg_head_movement != null ? (summary.facial_summary.avg_head_movement).toFixed(2) : '-'}</div>
                    <div>Facial Expression: {summary.facial_summary?.avg_facial_expression != null ? (summary.facial_summary.avg_facial_expression).toFixed(2) : '-'}</div>
                    <div>Attention: {summary.facial_summary?.avg_attention != null ? (summary.facial_summary.avg_attention).toFixed(2) : '-'}</div>
                    <div className="text-xs text-slate-500">Records: {summary.facial_summary?.records || 0}</div>
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-2">Voice</div>
                  <div className="space-y-1 text-slate-700">
                    <div>Clarity: {summary.voice_summary?.avg_voice_clarity != null ? (summary.voice_summary.avg_voice_clarity).toFixed(2) : '-'}</div>
                    <div>Speech Pattern: {summary.voice_summary?.avg_speech_pattern != null ? (summary.voice_summary.avg_speech_pattern).toFixed(2) : '-'}</div>
                    <div>Background Noise: {summary.voice_summary?.avg_background_noise != null ? (summary.voice_summary.avg_background_noise).toFixed(2) : '-'}</div>
                    <div>Authenticity: {summary.voice_summary?.avg_voice_authenticity != null ? (summary.voice_summary.avg_voice_authenticity).toFixed(2) : '-'}</div>
                    <div className="text-xs text-slate-500">Records: {summary.voice_summary?.records || 0}</div>
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-2">Screen</div>
                  <div className="space-y-1 text-slate-700">
                    <div>Sharing Quality: {summary.screen_summary?.avg_sharing_quality != null ? (summary.screen_summary.avg_sharing_quality).toFixed(2) : '-'}</div>
                    <div>Focus: {summary.screen_summary?.avg_focus != null ? (summary.screen_summary.avg_focus).toFixed(2) : '-'}</div>
                    <div>Tab Switches: {summary.screen_summary?.tab_switch_events ?? 0}</div>
                    <div>Unauthorized Apps: {summary.screen_summary?.unauthorized_apps_events ?? 0}</div>
                    <div className="text-xs text-slate-500">Records: {summary.screen_summary?.records || 0}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No analytics summary available yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Available Recordings</CardTitle>
            <CardDescription>Webcam, Screen, and Audio uploads</CardDescription>
          </CardHeader>
          <CardContent>
            {recordings.length === 0 ? (
              <p className="text-sm text-slate-500">No recordings were uploaded for this interview yet.</p>
            ) : (
              <div className="space-y-3">
                {recordings.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                    <div>
                      <div className="text-sm font-medium">{r.kind}</div>
                      <div className="text-xs text-slate-500">{(r.size_bytes || 0).toLocaleString()} bytes</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" onClick={() => playRecording(r.id)}>
                        <Play className="w-4 h-4 mr-1" /> Play
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadRecording(r.id)}>
                        <Download className="w-4 h-4 mr-1" /> Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Player</CardTitle>
            <CardDescription>Stream selected recording</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedRecordingUrl ? (
              <video
                key={selectedRecordingUrl}
                controls
                className="w-full h-[420px] bg-black rounded-lg"
                src={selectedRecordingUrl}
              />
            ) : (
              <div className="h-[420px] flex items-center justify-center bg-slate-50 rounded-lg text-slate-500 text-sm">
                Select a recording to play
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
