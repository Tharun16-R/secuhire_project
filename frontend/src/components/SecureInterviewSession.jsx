import React, { useState, useEffect, useRef, useCallback } from 'react';
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API = `${API_BASE}/api`;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { 
  Shield, Camera, Monitor, Mic, Eye, AlertTriangle, 
  CheckCircle, X, Lock, Video, Volume2, Brain, Activity,
  Clock, Users, Smartphone, Laptop, Headphones, Zap
} from 'lucide-react';
import AIMonitoringSystem from './AIMonitoringSystem';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../firebase';
import QRForPhoneJoin from './QRForPhoneJoin';
import { createSession } from '../lib/proctorApi';
import PreInterviewOnboarding from './PreInterviewOnboarding';

const SecureInterviewSession = ({ interview, company, job, onEnd, onClose }) => {
  const MAX_WARNINGS = 5;
  const [sessionPhase, setSessionPhase] = useState('onboarding'); // onboarding, monitoring
  const [sessionData, setSessionData] = useState({
    startTime: null,
    endTime: null,
    duration: 0,
    violations: [],
    analysisData: {},
    questions: [],
    answers: [],
    overallScore: 0
  });
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isAnswering, setIsAnswering] = useState(false);
  const [answer, setAnswer] = useState('');
  // Multi-round state
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(0); // per-round timer
  const roundTimerRef = useRef(null);
  const [roundAnswers, setRoundAnswers] = useState([]); // answers for current round only
  const [roundCompletionInfo, setRoundCompletionInfo] = useState(null); // { round, percentage, roundStatus, nextRound, completed }
  const [nextRoundToStart, setNextRoundToStart] = useState(null);
  const [showNextRoundInstructions, setShowNextRoundInstructions] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [monitoringStream, setMonitoringStream] = useState(null);
  
  const videoRef = useRef(null);
  const screenRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const timerRef = useRef(null);
  const questionStartRef = useRef(null);
  const analysisDataRef = useRef({});
  const listenersRef = useRef({});
  const wakeLockRef = useRef(null);
  const heartbeatRef = useRef(null);
  const telemetryRef = useRef(null);
  // Secure session id for unified upload endpoint
  const secureSessionIdRef = useRef(null);
  // Speech recognition for reading detection
  const speechRecRef = useRef(null);
  const speechActiveRef = useRef(false);
  const hasStoppedRecordersRef = useRef(false);

  // Recording refs
  const webcamRecorderRef = useRef(null);
  const screenRecorderRef = useRef(null);
  const webcamChunksRef = useRef([]);
  const screenChunksRef = useRef([]);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  // Proctoring QR state
  const [phoneJoinToken, setPhoneJoinToken] = useState("");
  const [qrError, setQrError] = useState("");

  const storage = getStorage(app);

  // Manual QR generation (in case auto call failed)
  const generatePhoneQR = async () => {
    try {
      const { sessionId, phoneJoinToken: pjt } = await createSession();
      setPhoneJoinToken(pjt);
      setQrError("");
    } catch (e) {
      setQrError(e?.message || 'Failed to create session for phone QR');
      alert(qrError || 'Could not generate phone QR. Check backend /api/session.');
    }
  };

  // Interview questions for the CURRENT ROUND (will be fetched; fallback to sample MCQs)
  const [interviewQuestions, setInterviewQuestions] = useState([
    {
      id: 1,
      type: 'multiple_choice',
      question: 'What is the primary purpose of React hooks?',
      options: [
        'To manage state in functional components',
        'To replace class components entirely',
        'To improve performance',
        'To handle side effects only'
      ],
      correctAnswer: 0,
      timeLimit: 60
    },
    {
      id: 2,
      type: 'multiple_choice',
      question: 'Which of the following is NOT a valid way to create a React component?',
      options: [
        'Function component',
        'Class component',
        'Arrow function component',
        'Object component'
      ],
      correctAnswer: 3,
      timeLimit: 45
    },
    {
      id: 3,
      type: 'multiple_choice',
      question: 'Which HTTP method is idempotent by definition?',
      options: [
        'POST',
        'PUT',
        'PATCH',
        'CONNECT'
      ],
      correctAnswer: 1,
      timeLimit: 45
    },
    {
      id: 4,
      type: 'multiple_choice',
      question: 'In JavaScript, which of the following is NOT a primitive type?',
      options: [
        'String',
        'Number',
        'Boolean',
        'Object'
      ],
      correctAnswer: 3,
      timeLimit: 45
    },
    {
      id: 5,
      type: 'multiple_choice',
      question: 'Which array method creates a new array with the results of calling a provided function on every element?',
      options: [
        'forEach',
        'map',
        'filter',
        'reduce'
      ],
      correctAnswer: 1,
      timeLimit: 45
    },
    {
      id: 6,
      type: 'multiple_choice',
      question: 'Which CSS property is used to change the text color of an element?',
      options: [
        'font-color',
        'text-color',
        'color',
        'font-style'
      ],
      correctAnswer: 2,
      timeLimit: 30
    }
  ]);

  // Round loader: fetch questions per round from backend and set round timer
  const loadRound = useCallback(async (roundNo) => {
    let cancelled = false;
    try {
      const url = new URL(`${API}/interview/getRoundQuestions`);
      url.searchParams.set('round', roundNo);
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` }
      });
      if (!res.ok) throw new Error('Failed to load round questions');
      const data = await res.json();
      const qs = Array.isArray(data?.questions) ? data.questions : [];
      const mapped = qs.map((q, idx) => ({
        id: q.id || (idx + 1),
        type: 'multiple_choice',
        question: q.text || 'Select the best answer',
        options: q.options || [],
        correctAnswer: typeof q.correctIndex === 'number' ? q.correctIndex : (typeof q.correctAnswer === 'number' ? q.correctAnswer : undefined),
        timeLimit: q.max_duration_sec || 60,
      }));
      if (!cancelled) {
        setInterviewQuestions(mapped);
        setCurrentQuestion(0);
        setAnswer('');
        setIsAnswering(mapped[0]?.type === 'multiple_choice');
        setRoundAnswers([]);
        questionStartRef.current = Date.now();
        // Start/Reset round timer
        const dur = Number.isFinite(data?.duration_sec) ? data.duration_sec : (roundNo === 1 ? 5*60 : roundNo === 2 ? 20*60 : 15*60);
        setRoundTimeRemaining(dur);
        if (roundTimerRef.current) clearInterval(roundTimerRef.current);
        roundTimerRef.current = setInterval(() => {
          setRoundTimeRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(roundTimerRef.current);
              submitRoundAndAdvance(roundNo);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        // Refresh speech recognition context
        try { stopSpeechRecognition(); setTimeout(()=>startSpeechRecognition(), 400); } catch {}
      }
    } catch (e) {
      // keep fallback questions but ensure timer exists
      const dur = roundNo === 1 ? 5*60 : roundNo === 2 ? 20*60 : 15*60;
      setRoundTimeRemaining(dur);
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      roundTimerRef.current = setInterval(() => {
        setRoundTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(roundTimerRef.current);
            submitRoundAndAdvance(roundNo);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { cancelled = true; };
  }, [API]);

  useEffect(() => {
    if (sessionPhase === 'monitoring') {
      // Prevent background scroll while session is active
      try { document.body.classList.add('overflow-hidden'); } catch {}
      startInterviewSession();

      // Listen for Electron kiosk quit signal to finalize immediately
      const onKioskQuit = () => {
        try { endInterview(); } catch {}
      };
      window.addEventListener('SecuHireKioskAboutToQuit', onKioskQuit);
      listenersRef.current.onKioskQuit = onKioskQuit;
    }
    
    return () => {
      cleanup();
    };
  }, [sessionPhase]);

  const startInterviewSession = async () => {
    try {
      // Request camera and microphone
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 1280, 
          height: 720,
          facingMode: 'user'
        },
        audio: true
      });

      // Request screen sharing
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
        mediaStreamRef.current = cameraStream;
      }

      // Expose the same camera stream to AI monitoring so analytics follow the live webcam
      setMonitoringStream(cameraStream);

      if (screenRef.current) {
        screenRef.current.srcObject = screenStream;
        screenStreamRef.current = screenStream;
      }

      // Start MediaRecorders
      startRecorders(cameraStream, screenStream);

      // Generate phone join QR once screen sharing is active
      try {
        if (!phoneJoinToken) {
          const { sessionId, phoneJoinToken: pjt } = await createSession();
          setPhoneJoinToken(pjt);
          // keep secureSessionIdRef for uploads distinct from proctor session
        }
      } catch (e) {
        setQrError(e?.message || 'Failed to create session for phone QR');
      }

      // Start secure session (preferred) and keep session_id for unified uploads
      try {
        // FastAPI expects simple params like interview_id as query/form, not JSON body unless modeled
        const res = await fetch(`${API}/secure-interview/start?interview_id=${encodeURIComponent(interview.id)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          secureSessionIdRef.current = data.session_id || data.sessionId || null;
        } else {
          console.warn('Secure session start failed, falling back to legacy start-recording');
          await fetch(`${API}/interviews/${interview.id}/start-recording`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` }
          });
        }
      } catch (e) {
        console.warn('Failed to start secure session; trying legacy start-recording', e);
        try {
          await fetch(`${API}/interviews/${interview.id}/start-recording`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` }
          });
        } catch {}
      }

      // Request fullscreen on the document element
      if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); } catch (e) {}
      }

      // Set up kiosk/tab locking
      setupTabLocking();

      // Start session timer
      const startTime = new Date();
      setSessionData(prev => ({ ...prev, startTime }));

      // Request screen wake lock to prevent sleep
      try {
        if ('wakeLock' in navigator && navigator.wakeLock?.request) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {}

      // Enable answering for MCQ by default
      const q = interviewQuestions[0];
      if (q && q.type === 'multiple_choice') {
        setIsAnswering(true);
      }
      questionStartRef.current = Date.now();
      // Start speech recognition for reading detection if available
      try { startSpeechRecognition(); } catch {}

      // Start heartbeat pings to backend
      try {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      } catch {}
      heartbeatRef.current = setInterval(async () => {
        try {
          await fetch(`${API}/interviews/${interview.id}/heartbeat`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` },
          });
        } catch (e) {
          // If heartbeat fails (network/offline), keep trying; backend will time out separately
        }
      }, 5000);

      // Periodically send summarized AI telemetry (facial / voice / screen) to backend
      try {
        if (telemetryRef.current) clearInterval(telemetryRef.current);
      } catch {}
      telemetryRef.current = setInterval(async () => {
        try {
          const sessionId = secureSessionIdRef.current;
          const a = analysisDataRef.current || {};
          if (!sessionId || !a || !a.facialExpressions || !a.gazeTracking || !a.audioAnalysis) return;

          // Facial telemetry
          try {
            await fetch(`${API}/secure-interview/${sessionId}/facial-analysis`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
              },
              body: JSON.stringify({
                eye_movement_score: a.gazeTracking.score ?? 0,
                head_movement_score: a.headMovement?.score ?? 0,
                facial_expression_score: a.facialExpressions.score ?? 0,
                attention_score: a.facialExpressions.attention ?? 0,
                stress_indicators: [],
              })
            });
          } catch {}

          // Voice telemetry
          try {
            await fetch(`${API}/secure-interview/${sessionId}/voice-analysis`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
              },
              body: JSON.stringify({
                voice_clarity_score: a.audioAnalysis.voiceClarity ?? 0,
                speech_pattern_score: a.audioAnalysis.score ?? 0,
                background_noise_score: a.audioAnalysis.noiseLevel ?? 0,
                voice_authenticity_score: a.audioAnalysis.score ?? 0,
                detected_issues: [],
              })
            });
          } catch {}

          // Screen telemetry (focus / tab switches)
          try {
            await fetch(`${API}/secure-interview/${sessionId}/screen-analysis`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
              },
              body: JSON.stringify({
                tab_switching_detected: !!(a.tabSwitching && a.tabSwitching.detected),
                unauthorized_apps_detected: [],
                screen_sharing_quality: 1.0,
                focus_score: a.gazeTracking.avgFocus ?? a.gazeTracking.score ?? 0,
              })
            });
          } catch {}
        } catch {}
      }, 10000);

      // Load first round
      try { await loadRound(1); setCurrentRound(1); } catch {}
    } catch (error) {
      console.error('Failed to start interview session:', error);
      alert('Failed to start interview session. Please check permissions.');
    }
  };

  const startRecorders = (cameraStream, screenStream) => {
    try {
      // Webcam recorder
      webcamChunksRef.current = [];
      let webcamMime = 'video/webm;codecs=vp9';
      try {
        if (!MediaRecorder.isTypeSupported(webcamMime)) webcamMime = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(webcamMime)) webcamMime = 'video/webm';
      } catch {}
      const webcamRecorder = new MediaRecorder(cameraStream, { mimeType: webcamMime });
      webcamRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) webcamChunksRef.current.push(e.data); };
      webcamRecorder.start(2000);
      webcamRecorderRef.current = webcamRecorder;

      // Screen recorder
      screenChunksRef.current = [];
      let screenMime = 'video/webm;codecs=vp9';
      try {
        if (!MediaRecorder.isTypeSupported(screenMime)) screenMime = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(screenMime)) screenMime = 'video/webm';
      } catch {}
      const screenRecorder = new MediaRecorder(screenStream, { mimeType: screenMime });
      screenRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) screenChunksRef.current.push(e.data); };
      screenRecorder.start(2000);
      screenRecorderRef.current = screenRecorder;

      // Audio-only recorder from microphone (cameraStream audio track)
      const audioTracks = cameraStream.getAudioTracks();
      if (audioTracks && audioTracks.length) {
        audioChunksRef.current = [];
        const micStream = new MediaStream([audioTracks[0]]);
        let audioMime = 'audio/webm;codecs=opus';
        try {
          if (!MediaRecorder.isTypeSupported(audioMime)) audioMime = 'audio/webm';
        } catch {}
        const audioRecorder = new MediaRecorder(micStream, { mimeType: audioMime });
        audioRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
        audioRecorder.start(2000);
        audioRecorderRef.current = audioRecorder;
      }
    } catch (e) {
      console.warn('Failed to start recorders', e);
    }
  };

  const stopRecorders = async () => {
    if (hasStoppedRecordersRef.current) return;
    hasStoppedRecordersRef.current = true;
    const stopOne = (rec) => new Promise((resolve) => {
      if (!rec) return resolve();
      try {
        rec.requestData();
        console.log('Requested data from recorder');
      } catch (e) {
        console.warn('Failed to request data from recorder', e);
      }
      rec.onstop = () => resolve();
      try {
        rec.stop();
        console.log('Stopped recorder');
      } catch (e) {
        console.warn('Failed to stop recorder', e);
        resolve();
      }
    });
    await Promise.all([
      stopOne(webcamRecorderRef.current),
      stopOne(screenRecorderRef.current),
      stopOne(audioRecorderRef.current)
    ]);
  };

  const uploadAllBlobsSecure = async (webcamBlob, screenBlob, audioBlob) => {
    if (!webcamBlob && !screenBlob && !audioBlob) return;
    const sessionId = secureSessionIdRef.current;
    if (!sessionId) return;
    try {
      const form = new FormData();
      if (webcamBlob) form.append('webcam', new File([webcamBlob], 'webcam.webm', { type: 'video/webm' }));
      if (screenBlob) form.append('screen', new File([screenBlob], 'screen.webm', { type: 'video/webm' }));
      if (audioBlob) form.append('audio', new File([audioBlob], 'audio.webm', { type: 'audio/webm' }));
      await fetch(`${API}/secure-interview/${sessionId}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` },
        body: form,
      });
    } catch (e) {
      console.warn('Secure upload failed', e);
    }
  };

  const submitSubmission = async (extra = {}) => {
    const latestAnalysis = sessionData.analysisData || {};
    const facialScore = (latestAnalysis.facialExpressions && typeof latestAnalysis.facialExpressions.attention === 'number')
      ? latestAnalysis.facialExpressions.attention
      : 0;
    const voiceScore = (latestAnalysis.audioAnalysis && typeof latestAnalysis.audioAnalysis.voiceClarity === 'number')
      ? latestAnalysis.audioAnalysis.voiceClarity
      : 0;
    const screenScore = (latestAnalysis.gazeTracking && typeof latestAnalysis.gazeTracking.score === 'number')
      ? latestAnalysis.gazeTracking.score
      : 0;
    const payload = {
      answers: sessionData.answers.map(a => ({
        questionId: a.questionId,
        question: a.question,
        answer: a.answer,
        timeSpent: a.timeSpent
      })),
      notes: null,
      ai_scores: {
        overall: (sessionData.overallScore || 0) / 100,
        facial: facialScore,
        voice: voiceScore,
        screen: screenScore,
      },
      start_time: sessionData.startTime ? new Date(sessionData.startTime).toISOString() : null,
      end_time: sessionData.endTime ? new Date(sessionData.endTime).toISOString() : null,
      duration_sec: sessionData.duration || 0,
      ...extra,
    };
    const r = await fetch(`${API}/interviews/${interview.id}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      throw new Error(data?.detail || 'Failed to submit answers');
    }
  };

  const setupTabLocking = () => {
    // Right-click/context menu
    const onContextMenu = (e) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', onContextMenu);
    listenersRef.current.onContextMenu = onContextMenu;

    // Keydown handler for common shortcuts and dev tools
    const onKeyDown = (e) => {
      const key = e.key?.toLowerCase();
      const combo = [e.ctrlKey ? 'ctrl' : '', e.shiftKey ? 'shift' : '', e.altKey ? 'alt' : '', key]
        .filter(Boolean)
        .join('+');

      const blockedCombos = new Set([
        'f11',
        'f12',
        'escape',
        'ctrl+shift+i',
        'ctrl+shift+c',
        'ctrl+shift+j',
        'ctrl+u',
        'ctrl+w',
        'ctrl+t',
        'ctrl+l',
        'ctrl+r',
        'ctrl+n',
      ]);

      if (blockedCombos.has(combo)) {
        e.preventDefault();
        handleViolation({
          type: 'blocked_shortcut',
          severity: 'warning',
          message: `Blocked shortcut: ${combo}`
        });
      }
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    listenersRef.current.onKeyDown = onKeyDown;

    // Visibility change (tab switch)
    const onVisibilityChange = () => {
      if (document.hidden) {
        handleViolation({
          type: 'tab_switch',
          severity: 'critical',
          message: 'Tab switching detected during interview'
        });
        // Immediately end the interview on tab switch
        endInterview();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    listenersRef.current.onVisibilityChange = onVisibilityChange;

    // Window blur (app lost focus)
    const onBlur = () => {
      handleViolation({
        type: 'window_blur',
        severity: 'critical',
        message: 'Window lost focus during interview'
      });
      // Immediately end the interview on window blur
      endInterview();
    };
    window.addEventListener('blur', onBlur);
    listenersRef.current.onBlur = onBlur;

    // Fullscreen change: if exited unexpectedly, re-enter
    const onFsChange = async () => {
      if (!document.fullscreenElement && sessionPhase === 'monitoring') {
        handleViolation({
          type: 'fullscreen_exit',
          severity: 'critical',
          message: 'Fullscreen was exited; re-entering kiosk mode'
        });
        try { await document.documentElement.requestFullscreen(); } catch {}
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    listenersRef.current.onFsChange = onFsChange;

    // Before unload (navigate away)
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the interview?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    listenersRef.current.onBeforeUnload = onBeforeUnload;
  };

  const submitRoundAndAdvance = async (roundNo) => {
    try {
      const payload = {
        interview_id: interview?.id,
        round: roundNo,
        answers: roundAnswers.map(a => ({ questionId: a.questionId, answer: a.answer, timeSpent: a.timeSpent })),
        duration_sec: (roundNo === 1 ? 5*60 : roundNo === 2 ? 20*60 : 15*60) - roundTimeRemaining,
        warnings: (sessionData?.violations?.length || 0)
      };
      const r = await fetch(`${API}/interview/submitRound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Round submit failed');

      if (roundTimerRef.current) {
        clearInterval(roundTimerRef.current);
      }

      const info = {
        round: roundNo,
        percentage: data?.percentage,
        roundStatus: data?.roundStatus,
        completed: !!data?.completed,
        nextRound: data?.nextRound,
      };
      setRoundCompletionInfo(info);

      if (data?.completed) {
        // All rounds finished; backend has computed finalStatus. Now end the secure interview session.
        endInterview();
        return;
      }

      const nextR = Number(data?.nextRound) || (roundNo + 1);
      setNextRoundToStart(nextR);
      // Auto-show instructions for the next round immediately after round submission
      setShowNextRoundInstructions(true);
    } catch (e) {
      console.warn('submitRound failed', e);
      // On failure, just show completion info without advancing automatically
      setRoundCompletionInfo({ round: roundNo, percentage: 0, roundStatus: 'Failed', completed: false, nextRound: null });
    }
  };

  const handleViolation = (violation) => {
    const newViolation = {
      ...violation,
      id: Date.now(),
      timestamp: new Date(),
      questionId: currentQuestion + 1
    };
    
    setSessionData(prev => ({
      ...prev,
      violations: [...prev.violations, newViolation]
    }));

    // Log to backend (best-effort)
    try {
      logViolation({ type: newViolation.type, severity: newViolation.severity, description: newViolation.message });
    } catch {}

    // Auto-complete after MAX_WARNINGS
    const total = (sessionData?.violations?.length || 0) + 1;
    if (total >= MAX_WARNINGS) {
      try {
        alert(`Maximum warnings reached (${MAX_WARNINGS}). The interview will be ended.`);
      } catch {}
      // Gracefully end interview
      try { endInterview(); } catch {}
    }
  };

  const handleAnalysisUpdate = (analysisData) => {
    analysisDataRef.current = analysisData;
    setSessionData(prev => ({
      ...prev,
      analysisData
    }));
  };

  const startAnswering = () => {
    setIsAnswering(true);
  };

  const submitAnswer = () => {
    if (isFinalizing) return;
    const question = interviewQuestions[currentQuestion];
    const answerData = {
      questionId: question.id,
      question: question.question,
      answer: answer,
      timeSpent: questionStartRef.current ? Math.floor((Date.now() - questionStartRef.current) / 1000) : null,
      timestamp: new Date(),
      analysisData: { ...analysisDataRef.current }
    };

    setSessionData(prev => ({
      ...prev,
      answers: [...prev.answers, answerData]
    }));
    setRoundAnswers(prev => ([...prev, answerData]));

    // No per-question timer to stop; reset state for next question
    setIsAnswering(false);
    setAnswer('');

    // Move to next question or, if last in this round, submit the round
    if (currentQuestion < interviewQuestions.length - 1) {
      const nextIndex = currentQuestion + 1;
      setCurrentQuestion(nextIndex);
      const nextQ = interviewQuestions[nextIndex];
      if (nextQ.type === 'multiple_choice') {
        setIsAnswering(true);
      }
      questionStartRef.current = Date.now();
    } else {
      // Last question of this round answered: submit round; backend will signal completion
      submitRoundAndAdvance(currentRound);
    }
  };

  const calculateOverallScore = () => {
    let score = 0;
    const totalQuestions = interviewQuestions.length || 0;

    // Score MCQs by exact match to correctAnswer index; descriptive gets partial credit
    (sessionData.answers || []).forEach(ans => {
      const q = interviewQuestions.find(qi => qi.id === ans.questionId);
      if (!q) return;
      if (q.type === 'multiple_choice') {
        if (String(ans.answer) === String(q.correctAnswer)) score += 1;
      } else if (q.type === 'descriptive') {
        const len = (ans.answer || '').length;
        const attention = ans.analysisData?.facialExpressions?.attention ?? 0.5;
        score += Math.min(1, (len / 100) * attention);
      }
    });

    // Penalize violations lightly
    const violationPenalty = (sessionData.violations?.length || 0) * 0.1;
    score = Math.max(0, score - violationPenalty);

    const finalScore = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    setSessionData(prev => ({ ...prev, overallScore: finalScore }));
  };

  const endInterview = () => {
    if (isFinalizing) return;
    const endTime = new Date();
    const duration = sessionData.startTime
      ? Math.floor((endTime - sessionData.startTime) / 1000)
      : 0;

    setSessionData(prev => ({
      ...prev,
      endTime,
      duration,
    }));

    calculateOverallScore();
    finalizeInterview();
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (heartbeatRef.current) {
      try { clearInterval(heartbeatRef.current); } catch {}
      heartbeatRef.current = null;
    }
    if (telemetryRef.current) {
      try { clearInterval(telemetryRef.current); } catch {}
      telemetryRef.current = null;
    }
    // Stop speech recognition (best-effort)
    try { stopSpeechRecognition(); } catch {}

    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
    }
    if (screenStreamRef.current) {
      try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
    }

    // Reset recorders/chunks
    webcamRecorderRef.current = null;
    screenRecorderRef.current = null;
    audioRecorderRef.current = null;
    webcamChunksRef.current = [];
    screenChunksRef.current = [];
    audioChunksRef.current = [];

    // Remove listeners if present
    const l = listenersRef.current || {};
    try {
      if (l.onContextMenu) document.removeEventListener('contextmenu', l.onContextMenu);
      if (l.onKeyDown) document.removeEventListener('keydown', l.onKeyDown, { capture: true });
      if (l.onVisibilityChange) document.removeEventListener('visibilitychange', l.onVisibilityChange);
      if (l.onBlur) window.removeEventListener('blur', l.onBlur);
      if (l.onFsChange) document.removeEventListener('fullscreenchange', l.onFsChange);
      if (l.onBeforeUnload) window.removeEventListener('beforeunload', l.onBeforeUnload);
      if (l.onKioskQuit) window.removeEventListener('SecuHireKioskAboutToQuit', l.onKioskQuit);
    } catch {}
    listenersRef.current = {};

    // Release wake lock
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {}

    // Exit fullscreen and restore scroll
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
      document.body.classList.remove('overflow-hidden');
    } catch {}
  };

  const formatTime = (seconds) => {
    const mins = Math.floor((seconds || 0) / 60);
    const secs = Math.max(0, (seconds || 0) % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadVideoToFirebase = async (blob, candidateId, type) => {
    if (!blob) return null;
    const safeCandidate = candidateId || 'unknown';
    const ts = Date.now();
    const path = `interviews/${safeCandidate}/${type}_${ts}.webm`;
    const storageRef = ref(storage, path);

    let attempts = 0;
    // simple retry up to 3 attempts
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        return url;
      } catch (e) {
        attempts += 1;
        if (attempts >= 3) {
          console.warn('Firebase upload failed for', type, e);
          return null;
        }
      }
    }
  };

  const finalizeInterview = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    try {
      await stopRecorders();

      const webcamBlob =
        webcamChunksRef.current.length
          ? new Blob(webcamChunksRef.current, { type: 'video/webm' })
          : null;
      const screenBlob =
        screenChunksRef.current.length
          ? new Blob(screenChunksRef.current, { type: 'video/webm' })
          : null;
      const audioBlob =
        audioChunksRef.current.length
          ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
          : null;

      const candidateId =
        interview?.candidate_id ||
        interview?.candidateId ||
        localStorage.getItem('secuhire_candidate_id') ||
        '';

      const frontCamUrl = await uploadVideoToFirebase(webcamBlob, candidateId, 'frontcam');
      const screenUrl = await uploadVideoToFirebase(screenBlob, candidateId, 'screen');

      // Secure-session upload (if available) and legacy upload for compatibility
      if (secureSessionIdRef.current) {
        await uploadAllBlobsSecure(webcamBlob, screenBlob, audioBlob);
      }

      const uploadLegacy = async (blob, kind) => {
        if (!blob) return;
        try {
          const form = new FormData();
          form.append('recording_type', kind);
          form.append('file', new File([blob], `${kind}.webm`, { type: 'video/webm' }));
          await fetch(`${API}/interviews/${interview.id}/upload-recording`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('secuhire_token')}` },
            body: form,
          });
        } catch (e) {
          console.warn('Legacy upload failed for', kind, e);
        }
      };

      await uploadLegacy(webcamBlob, 'webcam');
      await uploadLegacy(screenBlob, 'screen');
      await uploadLegacy(audioBlob, 'audio');

      await submitSubmission({ frontCamUrl, screenUrl });

      try {
        await fetch(`${API}/interviews/${interview.id}/end-recording`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('secuhire_token')}` },
        });
      } catch (e) {
        console.warn('Failed to end backend recording doc', e);
      }

      try {
        await fetch(`${API}/interviews/${interview.id}/end`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('secuhire_token')}` },
        });
      } catch (e) {
        console.warn('Failed to mark interview completed', e);
      }

      setShowThankYou(true);
    } catch (e) {
      console.warn('Finalize failed', e);
    } finally {
      cleanup();
      setIsFinalizing(false);
    }
  };

  // --- Rendering branches ---

  if (sessionPhase === 'onboarding') {
    return (
      <PreInterviewOnboarding
        interview={interview}
        company={company}
        job={job}
        onProceed={() => setSessionPhase('monitoring')}
        onCancel={onClose}
      />
    );
  }

  if (showThankYou) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-xl text-center">
          <h1 className="text-3xl font-bold mb-4">Thank you for attending the interview.</h1>
          <p className="text-lg text-gray-700 mb-8">
            Your responses and recordings have been submitted.
          </p>
          <Button
            className="px-8 py-3 text-lg"
            onClick={() => {
              try { onEnd && onEnd(); } catch {}
              window.location.href = '/';
            }}
          >
            Exit
          </Button>
        </div>
      </div>
    );
  }

  const handleProceedToInstructions = () => {
    if (!roundCompletionInfo || roundCompletionInfo.completed) return;
    setShowNextRoundInstructions(true);
  };

  const handleStartNextRound = async () => {
    if (!nextRoundToStart) return;
    const roundNo = nextRoundToStart;
    setRoundCompletionInfo(null);
    setShowNextRoundInstructions(false);
    setNextRoundToStart(null);
    setCurrentRound(roundNo);
    await loadRound(roundNo);
  };

  // Monitoring phase UI
  return (
    <div className="fixed inset-0 z-[1000] bg-white flex items-stretch justify-stretch">
      <div className="w-screen h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div>
              <h2 className="text-2xl font-bold">Secure Interview Session</h2>
              <p className="text-gray-600">
                Question {currentQuestion + 1} of {interviewQuestions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge className="bg-purple-100 text-purple-800">
              <Clock className="w-4 h-4 mr-1" />
              Round {currentRound} · {formatTime(roundTimeRemaining)}
            </Badge>
            <Button variant="outline" onClick={endInterview} disabled={isFinalizing}>
              <X className="w-4 h-4 mr-2" />
              End Interview
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Interview Area */}
          <div className="flex-1 p-6 overflow-y-auto min-w-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Webcam preview above questions (uses same stream as recording/analytics) */}
              <Card className="col-span-2 mb-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center space-x-2">
                    <Camera className="w-5 h-5" />
                    <span>Your Webcam</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="bg-gray-900 rounded-lg"
                    style={{ width: '360px', height: '220px', objectFit: 'cover' }}
                  />
                </CardContent>
              </Card>

              {/* Screen Share (hidden from candidate; used only for recording refs) */}
              <Card className="h-full hidden">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Monitor className="w-5 h-5" />
                    <span>Screen Share</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <video ref={screenRef} autoPlay muted className="w-full h-64 bg-gray-900 rounded-lg" />
                </CardContent>
              </Card>

              {/* Question Area */}
              <Card className="col-span-2 mt-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="w-5 h-5" />
                    <span>Interview Question</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentQuestion < interviewQuestions.length && (
                    <div className="space-y-4">
                      <div className="text-lg font-medium text-gray-900">
                        {interviewQuestions[currentQuestion].question}
                      </div>
                      {interviewQuestions[currentQuestion].type === 'multiple_choice' && (
                        <div className="space-y-2">
                          {interviewQuestions[currentQuestion].options.map((option, index) => (
                            <label
                              key={index}
                              className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name="answer"
                                value={index}
                                checked={answer === index.toString()}
                                onChange={(e) => {
                                  if (isFinalizing) return;
                                  setAnswer(e.target.value);
                                  setIsAnswering(true);
                                }}
                                className="w-4 h-4"
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {interviewQuestions[currentQuestion].type === 'descriptive' && (
                        <textarea
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          placeholder="Type your answer here..."
                          className="w-full h-32 p-3 border rounded-lg resize-none"
                          disabled={!isAnswering}
                        />
                      )}
                      <div className="flex justify-end space-x-2">
                        {interviewQuestions[currentQuestion].type === 'descriptive' && !isAnswering && (
                          <Button onClick={startAnswering} className="bg-blue-600 hover:bg-blue-700" disabled={isFinalizing}>
                            Start Answering
                          </Button>
                        )}
                        <Button
                          onClick={submitAnswer}
                          disabled={isFinalizing || !isAnswering || answer === ''}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isFinalizing ? 'Submitting...' : 'Submit Answer'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-80 border-l p-6 overflow-y-auto">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Phone Camera</CardTitle>
                <CardDescription>Scan to connect your phone</CardDescription>
              </CardHeader>
              <CardContent>
                {phoneJoinToken ? (
                  <QRForPhoneJoin phoneJoinToken={phoneJoinToken} />
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-600">QR not generated yet.</div>
                    <Button size="sm" variant="outline" onClick={generatePhoneQR}>
                      Generate QR
                    </Button>
                    {qrError && <div className="text-xs text-red-600">{qrError}</div>}
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-2">Ensure your phone and laptop are on the same Wi‑Fi.</div>
              </CardContent>
            </Card>

            <AIMonitoringSystem
              autoStart
              onViolation={handleViolation}
              onAnalysisUpdate={handleAnalysisUpdate}
            />
          </div>
        </div>

        {/* Round completion lock screen (disabled to avoid extra waiting between rounds) */}
        {false &&
          roundCompletionInfo &&
          !roundCompletionInfo.completed &&
          !showNextRoundInstructions && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1100] p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold flex items-center justify-center space-x-2">
                    <Lock className="w-6 h-6 text-purple-600" />
                    <span>Round {roundCompletionInfo.round} Completed</span>
                  </CardTitle>
                  <CardDescription>
                    Your responses for this round have been submitted. Review the summary and proceed when ready.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-center space-x-4">
                    <Badge className="bg-green-100 text-green-800">
                      Score: {Math.round(roundCompletionInfo.percentage || 0)}%
                    </Badge>
                    <Badge
                      className={
                        roundCompletionInfo.roundStatus === 'Passed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }
                    >
                      {roundCompletionInfo.roundStatus || 'Completed'}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleProceedToInstructions}>
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </div>
            </div>
          )}

        {/* Next round instructions screen */}
        {roundCompletionInfo &&
          !roundCompletionInfo.completed &&
          showNextRoundInstructions &&
          nextRoundToStart && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1100] p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    Round {nextRoundToStart} Instructions
                  </CardTitle>
                  <CardDescription>
                    Please read the instructions carefully before starting the next round. The timer will begin as soon as
                    you click "Start Test".
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="list-disc list-inside text-left text-sm text-gray-700 space-y-1">
                    <li>Ensure you are in a quiet environment with a stable internet connection.</li>
                    <li>Do not refresh, close, or switch away from this window during the test.</li>
                    <li>Each round has a single timer for all questions. Manage your time carefully.</li>
                    <li>Once the timer ends, your answers will be submitted automatically.</li>
                  </ul>
                  <div className="flex justify-end space-x-3">
                    <Button variant="outline" onClick={handleProceedToInstructions}>
                      Back
                    </Button>
                    <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleStartNextRound}>
                      Start Test
                    </Button>
                  </div>
                </CardContent>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default SecureInterviewSession;
