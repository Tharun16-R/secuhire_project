import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { 
  Shield, Camera, Monitor, Mic, Eye, AlertTriangle, 
  CheckCircle, X, Lock, Unlock, Video, Volume2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const SecureInterview = ({ interview, onClose }) => {
  const [sessionId, setSessionId] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [permissions, setPermissions] = useState({
    camera: false,
    microphone: false,
    screen: false
  });
  const [aiScores, setAiScores] = useState({
    facial: 0,
    voice: 0,
    screen: 0,
    overall: 0
  });
  const [violations, setViolations] = useState([]);
  const [isTabLocked, setIsTabLocked] = useState(false);
  // Pre-interview
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [serverOtpDemo, setServerOtpDemo] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  
  const videoRef = useRef(null);
  const screenRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const analysisIntervalRef = useRef(null);
  // Recording refs
  const webcamRecorderRef = useRef(null);
  const screenRecorderRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const webcamChunksRef = useRef([]);
  const screenChunksRef = useRef([]);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Request permissions and OTP but do not start session until verified
    requestPermissions();
    requestInterviewOtp();
    
    // Set up tab locking
    setupTabLocking();
    
    // Analysis interval will start once session is active
    
    // Prevent background scroll while interview overlay is active
    try { document.body.classList.add('overflow-hidden'); } catch {}

    return () => {
      cleanup();
    };
  }, []);

  // Log a violation to backend so recruiters can review it later
  const logViolation = useCallback(async (payload) => {
    try {
      if (!interview?.id) return;
      await fetch(`${API}/interviews/${interview.id}/security-violation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // non-blocking
      console.warn('Failed to log violation', e);
    }
  }, [interview?.id]);

  const requestPermissions = async () => {
    try {
      // Request camera permission
      const cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 1280, 
          height: 720,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
        mediaStreamRef.current = cameraStream;
        setPermissions(prev => ({ ...prev, camera: true }));
      }

      // Request microphone permission
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissions(prev => ({ ...prev, microphone: true }));
      // Store mic stream for separate recording
      // Attach mic to refs for recording
      mediaStreamRef.current && mediaStreamRef.current.addTrack(micStream.getAudioTracks()[0]);

      // Request screen sharing permission
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true,
        audio: true 
      });
      
      if (screenRef.current) {
        screenRef.current.srcObject = screenStream;
        screenStreamRef.current = screenStream;
        setPermissions(prev => ({ ...prev, screen: true }));
      }

      // Handle screen sharing end
      screenStream.getVideoTracks()[0].onended = () => {
        const v = {
          id: Date.now(),
          type: 'screen_sharing_ended',
          severity: 'critical',
          message: 'Screen sharing was stopped unexpectedly'
        };
        setViolations(prev => [...prev, v]);
        logViolation({ type: v.type, severity: v.severity, description: v.message });
      };

    } catch (error) {
      console.error('Permission denied:', error);
      const v = {
        id: Date.now(),
        type: 'permission_denied',
        severity: 'critical',
        message: `Permission denied: ${error.message}`
      };
      setViolations(prev => [...prev, v]);
      logViolation({ type: v.type, severity: v.severity, description: v.message });
    }
  };

  const requestInterviewOtp = async () => {
    try {
      const res = await fetch(`${API}/secure-interview/${interview.id}/request-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        }
      });
      const data = await res.json();
      setOtpRequested(true);
      // Demo display only; in prod this wouldn’t be shown
      setServerOtpDemo(data.otp_code || "");
    } catch (e) {
      console.error('Failed to request OTP', e);
    }
  };

  const verifyInterviewOtp = async () => {
    try {
      const res = await fetch(`${API}/secure-interview/${interview.id}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: JSON.stringify({ otp_code: otpInput })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'OTP verification failed');
      }
      setOtpVerified(true);
      // Try to enter full screen as soon as interview is about to start
      if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); } catch (e) {}
      }
      // Start session only after OTP + consent
      if (consentAccepted) {
        await startSecureSession();
        startAIAnalysis();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const startSecureSession = async () => {
    try {
      const response = await fetch(`${API}/secure-interview/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: JSON.stringify({
          interview_id: interview.id
        })
      });

      const data = await response.json();
      setSessionId(data.session_id);
      setIsActive(true);
      // Begin local recordings once session starts
      startRecordings();
      startAIAnalysis();
    } catch (error) {
      console.error('Failed to start secure session:', error);
    }
  };

  const createRecorder = (stream, chunksRef, mimeTypes) => {
    if (!stream) return null;
    const supported = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    const options = supported ? { mimeType: supported, bitsPerSecond: 1_000_000 } : {};
    const rec = new MediaRecorder(stream, options);
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start(2000); // timeslice to flush chunks
    return rec;
  };

  const startRecordings = () => {
    try {
      if (mediaStreamRef.current) {
        webcamChunksRef.current = [];
        webcamRecorderRef.current = createRecorder(
          mediaStreamRef.current,
          webcamChunksRef,
          ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']
        );
      }
      if (screenStreamRef.current) {
        screenChunksRef.current = [];
        screenRecorderRef.current = createRecorder(
          screenStreamRef.current,
          screenChunksRef,
          ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']
        );
      }
      // Separate audio recording (if available)
      const audioTracks = mediaStreamRef.current?.getAudioTracks?.() || [];
      if (audioTracks.length > 0) {
        const audioStream = new MediaStream([audioTracks[0]]);
        audioChunksRef.current = [];
        audioRecorderRef.current = createRecorder(
          audioStream,
          audioChunksRef,
          ['audio/webm;codecs=opus','audio/webm']
        );
      }
    } catch (e) {
      console.warn('Recording start failed:', e);
    }
  };

  const stopRecorder = (rec) => new Promise((resolve) => {
    if (!rec) return resolve();
    if (rec.state !== 'inactive') {
      rec.onstop = resolve;
      rec.stop();
    } else {
      resolve();
    }
  });

  const uploadRecordings = async () => {
    try {
      const form = new FormData();
      // Build blobs
      if (webcamChunksRef.current.length) {
        const blob = new Blob(webcamChunksRef.current, { type: 'video/webm' });
        form.append('webcam', blob, `webcam-${Date.now()}.webm`);
      }
      if (screenChunksRef.current.length) {
        const blob = new Blob(screenChunksRef.current, { type: 'video/webm' });
        form.append('screen', blob, `screen-${Date.now()}.webm`);
      }
      if (audioChunksRef.current.length) {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        form.append('audio', blob, `audio-${Date.now()}.webm`);
      }
      if ([...form.keys()].length === 0) return; // nothing to upload
      await fetch(`${API}/secure-interview/${sessionId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: form,
      });
    } catch (e) {
      console.error('Upload failed:', e);
    }
  };

  const setupTabLocking = () => {
    // Lock all other tabs
    const lockTabs = () => {
      // Close all other tabs except current
      if (window.history.length > 1) {
        window.history.go(-(window.history.length - 1));
      }
      
      // Disable right-click context menu
      document.addEventListener('contextmenu', e => e.preventDefault());
      
      // Disable F12, Ctrl+Shift+I, etc.
      document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.shiftKey && e.key === 'C') ||
            (e.ctrlKey && e.key === 'u')) {
          e.preventDefault();
          const v = {
            id: Date.now(),
            type: 'dev_tools_attempt',
            severity: 'warning',
            message: 'Attempted to open developer tools'
          };
          setViolations(prev => [...prev, v]);
          logViolation({ type: v.type, severity: v.severity, description: v.message });
        }
      });

      // Monitor tab visibility
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          const v = {
            id: Date.now(),
            type: 'tab_switch',
            severity: 'critical',
            message: 'Tab switching detected during interview'
          };
          setViolations(prev => [...prev, v]);
          logViolation({ type: v.type, severity: v.severity, description: v.message });
        }
      });

      setIsTabLocked(true);
    };

    lockTabs();
  };

  const startAIAnalysis = () => {
    analysisIntervalRef.current = setInterval(async () => {
      if (!sessionId || !isActive) return;

      // Analyze facial expressions and movements
      await analyzeFacialExpressions();
      
      // Analyze voice
      await analyzeVoice();
      
      // Analyze screen activity
      await analyzeScreenActivity();
      
    }, 5000); // Analyze every 5 seconds
  };

  const analyzeFacialExpressions = async () => {
    // Simulate facial analysis (in real implementation, use computer vision)
    const facialData = {
      eye_movement_score: Math.random() * 0.3 + 0.7, // 0.7-1.0
      head_movement_score: Math.random() * 0.2 + 0.8, // 0.8-1.0
      facial_expression_score: Math.random() * 0.3 + 0.7, // 0.7-1.0
      attention_score: Math.random() * 0.2 + 0.8, // 0.8-1.0
      stress_indicators: Math.random() > 0.8 ? ['rapid_blinking', 'facial_tension'] : []
    };

    try {
      await fetch(`${API}/secure-interview/${sessionId}/facial-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: JSON.stringify(facialData)
      });

      setAiScores(prev => ({ ...prev, facial: facialData.attention_score }));
    } catch (error) {
      console.error('Facial analysis failed:', error);
    }
  };

  const analyzeVoice = async () => {
    // Simulate voice analysis (in real implementation, use speech recognition)
    const voiceData = {
      voice_clarity_score: Math.random() * 0.2 + 0.8, // 0.8-1.0
      speech_pattern_score: Math.random() * 0.3 + 0.7, // 0.7-1.0
      background_noise_score: Math.random() * 0.3 + 0.7, // 0.7-1.0
      voice_authenticity_score: Math.random() * 0.2 + 0.8, // 0.8-1.0
      detected_issues: Math.random() > 0.9 ? ['background_noise'] : []
    };

    try {
      await fetch(`${API}/secure-interview/${sessionId}/voice-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: JSON.stringify(voiceData)
      });

      setAiScores(prev => ({ ...prev, voice: voiceData.voice_authenticity_score }));
    } catch (error) {
      console.error('Voice analysis failed:', error);
    }
  };

  const analyzeScreenActivity = async () => {
    // Simulate screen analysis (in real implementation, monitor screen activity)
    const screenData = {
      tab_switching_detected: false,
      unauthorized_apps_detected: [],
      screen_sharing_quality: Math.random() * 0.2 + 0.8, // 0.8-1.0
      focus_score: Math.random() * 0.2 + 0.8 // 0.8-1.0
    };

    try {
      await fetch(`${API}/secure-interview/${sessionId}/screen-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: JSON.stringify(screenData)
      });

      setAiScores(prev => ({ ...prev, screen: screenData.focus_score }));
    } catch (error) {
      console.error('Screen analysis failed:', error);
    }
  };

  const endInterview = async () => {
    if (sessionId) {
      try {
        // Stop recorders and upload files before ending
        await Promise.all([
          stopRecorder(webcamRecorderRef.current),
          stopRecorder(screenRecorderRef.current),
          stopRecorder(audioRecorderRef.current),
        ]);
        await uploadRecordings();
        await fetch(`${API}/secure-interview/${sessionId}/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
          }
        });
      } catch (error) {
        console.error('Failed to end interview:', error);
      }
    }
    
    cleanup();
    onClose();
  };

  const cleanup = () => {
    // Stop all media streams
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Clear analysis interval
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }

    // Re-enable right-click and other features
    document.removeEventListener('contextmenu', e => e.preventDefault());
    document.removeEventListener('keydown', e => e.preventDefault());
    // Exit fullscreen and restore scrolling
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
      document.body.classList.remove('overflow-hidden');
    } catch {}
    
    setIsTabLocked(false);
  };

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-white flex items-stretch justify-stretch">
      <div className="w-screen h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div>
              <h2 className="text-2xl font-bold">Secure Interview Session</h2>
              <p className="text-gray-600">AI-Powered Monitoring Active</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={isTabLocked ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
              {isTabLocked ? <Lock className="w-4 h-4 mr-1" /> : <Unlock className="w-4 h-4 mr-1" />}
              {isTabLocked ? "Locked" : "Unlocked"}
            </Badge>
            <Button variant="outline" onClick={endInterview}>
              <X className="w-4 h-4 mr-2" />
              End Interview
            </Button>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Main Video Area */}
          <div className="flex-1 p-6">
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Pre-Interview Setup Panel */}
              {!isActive && (
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle>Pre-Interview Setup</CardTitle>
                    <CardDescription>Verify identity, accept consent, and begin in full-screen.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>Camera: {permissions.camera ? <span className="text-green-600">Ready</span> : <span className="text-red-600">Missing</span>}</div>
                      <div>Microphone: {permissions.microphone ? <span className="text-green-600">Ready</span> : <span className="text-red-600">Missing</span>}</div>
                      <div>Screen Share: {permissions.screen ? <span className="text-green-600">Ready</span> : <span className="text-red-600">Missing</span>}</div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input id="consent" type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} />
                      <label htmlFor="consent" className="text-sm text-gray-700">I agree to AI monitoring and screen sharing terms.</label>
                    </div>

                    <div className="space-y-2">
                      {!otpRequested ? (
                        <Button onClick={requestInterviewOtp} className="bg-purple-600 hover:bg-purple-700">Send OTP</Button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <input
                            className="border rounded px-3 py-2 text-sm w-40"
                            placeholder="Enter OTP"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                          />
                          <Button onClick={verifyInterviewOtp} disabled={!otpInput || !consentAccepted} className="bg-teal-600 hover:bg-teal-700">Verify & Start</Button>
                          {serverOtpDemo && <span className="text-xs text-gray-500">Demo OTP: {serverOtpDemo}</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (!document.fullscreenElement) {
                            try { await document.documentElement.requestFullscreen(); } catch (e) {}
                          }
                        }}
                      >Enter Full Screen</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Webcam Feed */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Camera className="w-5 h-5" />
                    <span>Webcam Feed</span>
                    {permissions.camera && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Keep webcam stream attached but hide the preview for privacy */}
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-0 h-0 opacity-0 absolute"
                    aria-hidden="true"
                  />
                  <div className="w-full h-40 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center p-4">
                    <div>
                      <p className="text-sm text-gray-700 font-medium">Your webcam is being captured securely.</p>
                      <p className="text-xs text-gray-500">The preview is hidden during the test. The recording will be saved for the recruiter after you end/submit the interview.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600">Facial Analysis Score:</span>
                    <Badge className={getScoreBadge(aiScores.facial)}>
                      {(aiScores.facial * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Screen Share */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Monitor className="w-5 h-5" />
                    <span>Screen Share</span>
                    {permissions.screen && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Keep an offscreen/hidden video element attached to the stream so recording works, but do not show preview to candidate */}
                  <video
                    ref={screenRef}
                    autoPlay
                    muted
                    className="w-0 h-0 opacity-0 absolute"
                    aria-hidden="true"
                  />
                  <div className="w-full h-40 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center p-4">
                    <div>
                      <p className="text-sm text-gray-700 font-medium">Your screen is being captured securely.</p>
                      <p className="text-xs text-gray-500">The preview is hidden for privacy, but the recording will be saved for the recruiter after you end/submit the interview.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600">Focus Score:</span>
                    <Badge className={getScoreBadge(aiScores.screen)}>
                      {(aiScores.screen * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* AI Monitoring Panel */}
          <div className="w-80 border-l p-6 space-y-6">
            {/* AI Scores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>AI Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Facial Expression</span>
                    <span className={`text-sm font-medium ${getScoreColor(aiScores.facial)}`}>
                      {(aiScores.facial * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={aiScores.facial * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Voice Authenticity</span>
                    <span className={`text-sm font-medium ${getScoreColor(aiScores.voice)}`}>
                      {(aiScores.voice * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={aiScores.voice * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Screen Focus</span>
                    <span className={`text-sm font-medium ${getScoreColor(aiScores.screen)}`}>
                      {(aiScores.screen * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={aiScores.screen * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Security Violations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Security Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {violations.length === 0 ? (
                  <p className="text-sm text-gray-500">No violations detected</p>
                ) : (
                  <div className="space-y-2">
                    {violations.slice(-5).map((violation) => (
                      <Alert key={violation.id} className={
                        violation.severity === 'critical' ? 'border-red-200 bg-red-50' :
                        violation.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                        'border-blue-200 bg-blue-50'
                      }>
                        <AlertDescription className="text-xs">
                          {violation.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Permissions Status */}
            <Card>
              <CardHeader>
                <CardTitle>Permissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Camera</span>
                  {permissions.camera ? 
                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                    <X className="w-4 h-4 text-red-600" />
                  }
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Microphone</span>
                  {permissions.microphone ? 
                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                    <X className="w-4 h-4 text-red-600" />
                  }
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Screen Share</span>
                  {permissions.screen ? 
                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                    <X className="w-4 h-4 text-red-600" />
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecureInterview;
