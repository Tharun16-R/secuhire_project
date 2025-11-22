import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { 
  Eye, Camera, Volume2, Monitor, AlertTriangle, CheckCircle, 
  Brain, Activity, Zap, Shield, Lock, Users, Smartphone
} from 'lucide-react';

const AIMonitoringSystem = ({ onViolation, onAnalysisUpdate, autoStart }) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [analysisData, setAnalysisData] = useState({
    gazeTracking: { score: 0, deviations: 0, avgFocus: 0 },
    headMovement: { score: 0, tilts: 0, rotations: 0 },
    facialExpressions: { score: 0, stressLevel: 0, attention: 0 },
    audioAnalysis: { score: 0, noiseLevel: 0, voiceClarity: 0 },
    tabSwitching: { detected: false, count: 0, lastSwitch: null },
    environment: { stable: true, changes: 0, suspiciousActivity: false, peopleCount: 0, multipleFaces: false }
  });
  
  const [violations, setViolations] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  
  const videoRef = useRef(null);
  const webcamPreviewRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analysisIntervalRef = useRef(null);
  const ownsStreamRef = useRef(false);
  const frameRafRef = useRef(null);
  const faceMeshRef = useRef(null);
  const faceReadyRef = useRef(false);
  const lastLandmarksRef = useRef(null);
  const faceCountRef = useRef(0);
  const recordingRef = useRef(null);
  const rafCanvasCountRef = useRef(0);
  // smoothing state
  const smoothRef = useRef({ focus: 0, stability: 0, attention: 0 });
  // calibration & pose & audio VU
  const [isCalibrated, setIsCalibrated] = useState(false);
  const calibrationRef = useRef(null); // { noseOffset: {x,y}, yaw0, pitch0 }
  const autoCalibrateTimerRef = useRef(null);
  const [pose, setPose] = useState({ yaw: 0, pitch: 0 });
  const analyserRef = useRef(null);
  const [vu, setVu] = useState(0);
  const tabSwitchRef = useRef({ detected: false, count: 0, lastSwitch: null });

  // Load MediaPipe FaceMesh dynamically (no bundler config needed)
  const loadFaceMesh = async () => {
    if (window.FaceMesh) {
      return;
    }
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
    script1.async = true;
    const script2 = document.createElement('script');
    script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
    script2.async = true;
    const script3 = document.createElement('script');
    script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
    script3.async = true;
    await new Promise(res => { script1.onload = res; document.body.appendChild(script1); });
    await new Promise(res => { script2.onload = res; document.body.appendChild(script2); });
    await new Promise(res => { script3.onload = res; document.body.appendChild(script3); });
  };

  // Initialize FaceMesh processing on the webcam video
  const initFaceMesh = async () => {
    try {
      await loadFaceMesh();
      if (!window.FaceMesh) return;
      const fm = new window.FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
      fm.setOptions({ maxNumFaces: 2, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      fm.onResults((results) => {
        const faces = results.multiFaceLandmarks || [];
        const count = faces.length;
        faceCountRef.current = count;

        if (count === 0) {
          lastLandmarksRef.current = null;
          faceReadyRef.current = false;
          return;
        }

        // Multiple faces detection: only raise a violation when more than one distinct face is present
        if (count > 1) {
          const violation = {
            id: Date.now(),
            type: 'multiple_faces',
            severity: 'critical',
            message: 'Multiple faces detected in camera view',
            timestamp: new Date(),
          };
          setViolations((prev) => [...prev, violation]);
          onViolation?.([violation]);
        }

        faceReadyRef.current = true;
        lastLandmarksRef.current = faces[0];
        // Draw overlay
        if (canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          // Only update canvas size occasionally to reduce layout thrash
          if (rafCanvasCountRef.current % 10 === 0) {
            const vw = videoRef.current.videoWidth || 640;
            const vh = videoRef.current.videoHeight || 360;
            if (vw && vh) {
              canvas.width = vw;
              canvas.height = vh;
            }
          }
          rafCanvasCountRef.current++;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (window.drawConnectors && window.drawLandmarks) {
            const FACEMESH_TESSELATION = window.FACEMESH_TESSELATION || [];
            window.drawConnectors(ctx, lastLandmarksRef.current, FACEMESH_TESSELATION, { color: '#00FF00', lineWidth: 0.5 });
          }
        }
        // Update head pose from landmarks
        updateHeadPose();
      });
      faceMeshRef.current = fm;
    } catch (e) {
      console.warn('FaceMesh load/init failed:', e);
    }
  };

  // Estimate gaze/head metrics from landmarks
  const computeFaceMetrics = () => {
    const lm = lastLandmarksRef.current;
    if (!lm) return null;
    // Basic heuristic: use some landmark pairs to approximate head stability and gaze deviations
    const leftEyeIdx = 33; // approximate outer left eye
    const rightEyeIdx = 263; // approximate outer right eye
    const noseIdx = 1; // nose tip
    const leftEye = lm[leftEyeIdx];
    const rightEye = lm[rightEyeIdx];
    const nose = lm[noseIdx];
    if (!leftEye || !rightEye || !nose) return null;
    // Eye horizontal vector length
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const eyeDist = Math.sqrt(dx*dx + dy*dy) || 1;
    // Head tilt proxy using y-diff between eyes (roll)
    const roll = Math.abs(dy) / eyeDist; // 0..1
    // Gaze proxy: nose deviation from midpoint between eyes
    const midX = (leftEye.x + rightEye.x) / 2;
    const midY = (leftEye.y + rightEye.y) / 2;
    // Calibration-adjusted deviation
    let nx = nose.x - midX;
    let ny = nose.y - midY;
    if (calibrationRef.current) {
      nx -= calibrationRef.current.noseOffset.x;
      ny -= calibrationRef.current.noseOffset.y;
    }
    const gazeDev = Math.sqrt(nx*nx + ny*ny) / eyeDist; // 0..~
    // Map to scores 0..1 (lower deviation -> higher focus)
    const focus = Math.max(0, Math.min(1, 1 - gazeDev * 1.5));
    const stability = Math.max(0, Math.min(1, 1 - roll * 2));
    // Exponential smoothing with alpha
    const alpha = 0.3;
    const prev = smoothRef.current;
    const sFocus = alpha * focus + (1 - alpha) * (prev.focus || focus);
    const sStability = alpha * stability + (1 - alpha) * (prev.stability || stability);
    const sAttention = alpha * focus + (1 - alpha) * (prev.attention || focus);
    smoothRef.current = { focus: sFocus, stability: sStability, attention: sAttention };
    return {
      gazeTracking: { score: sFocus, deviations: gazeDev > 0.15 ? 1 : 0, avgFocus: sFocus },
      headMovement: { score: sStability, tilts: roll > 0.1 ? 1 : 0, rotations: 0 },
      facialExpressions: { score: sAttention, stressLevel: 1 - sAttention, attention: sAttention }
    };
  };

  // Head pose from landmarks (approx yaw/pitch in degrees)
  const updateHeadPose = () => {
    const lm = lastLandmarksRef.current;
    if (!lm) return;
    const leftEye = lm[33];
    const rightEye = lm[263];
    const noseTip = lm[1];
    if (!leftEye || !rightEye || !noseTip) return;
    const eyeMid = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const eyeVec = { x: rightEye.x - leftEye.x, y: rightEye.y - leftEye.y };
    const eyeDist = Math.sqrt(eyeVec.x*eyeVec.x + eyeVec.y*eyeVec.y) || 1;
    let yaw = ((noseTip.x - eyeMid.x) / eyeDist) * 90;
    let pitch = ((eyeMid.y - noseTip.y) / eyeDist) * 90;
    if (calibrationRef.current) {
      yaw -= calibrationRef.current.yaw0;
      pitch -= calibrationRef.current.pitch0;
    }
    yaw = Math.max(-45, Math.min(45, yaw));
    pitch = Math.max(-45, Math.min(45, pitch));
    setPose({ yaw: Number(yaw.toFixed(1)), pitch: Number(pitch.toFixed(1)) });
  };

  // Manual calibration based on current face
  const calibrate = () => {
    const lm = lastLandmarksRef.current;
    if (!lm) return;
    const leftEye = lm[33];
    const rightEye = lm[263];
    const nose = lm[1];
    if (!leftEye || !rightEye || !nose) return;
    const midX = (leftEye.x + rightEye.x) / 2;
    const midY = (leftEye.y + rightEye.y) / 2;
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const eyeDist = Math.sqrt(dx*dx + dy*dy) || 1;
    const yaw0 = ((nose.x - midX) / eyeDist) * 90;
    const pitch0 = ((midY - nose.y) / eyeDist) * 90;
    calibrationRef.current = {
      noseOffset: { x: nose.x - midX, y: nose.y - midY },
      yaw0,
      pitch0
    };
    setIsCalibrated(true);
  };

  // Simulated metrics fallback
  const performAIAnalysis = useCallback(() => {
    if (!isMonitoring) return;

    // If FaceMesh has valid landmarks, compute real metrics
    const faceMetrics = computeFaceMetrics();
    let gazeScore, gazeDeviations, avgFocus, headScore, headTilts, headRotations, facialScore, stressLevel, attention;
    if (faceMetrics) {
      gazeScore = faceMetrics.gazeTracking.score;
      gazeDeviations = faceMetrics.gazeTracking.deviations;
      avgFocus = faceMetrics.gazeTracking.avgFocus;
      headScore = faceMetrics.headMovement.score;
      headTilts = faceMetrics.headMovement.tilts;
      headRotations = faceMetrics.headMovement.rotations;
      facialScore = faceMetrics.facialExpressions.score;
      stressLevel = faceMetrics.facialExpressions.stressLevel;
      attention = faceMetrics.facialExpressions.attention;
    } else {
      // If face is not ready, keep previous smoothed metrics and do not generate violations
      gazeScore = smoothRef.current.focus || 0.8;
      gazeDeviations = 0;
      avgFocus = smoothRef.current.focus || 0.8;
      headScore = smoothRef.current.stability || 0.8;
      headTilts = 0;
      headRotations = 0;
      facialScore = smoothRef.current.attention || 0.8;
      stressLevel = 0;
      attention = smoothRef.current.attention || 0.8;
    }

    // Basic audio metrics (no random violations)
    const audioScore = 1.0;
    const noiseLevel = 0.0;
    const voiceClarity = 1.0;

    // Use real tab switch data from visibility handler
    const tabSwitching = !!tabSwitchRef.current.detected;
    const tabCount = tabSwitchRef.current.count || 0;

    const environmentStable = true;
    const environmentChanges = 0;
    const suspiciousActivity = false;
    const peopleCount = faceCountRef.current || 0;
    const multipleFaces = peopleCount > 1;

    const newAnalysisData = {
      gazeTracking: { 
        score: gazeScore, 
        deviations: gazeDeviations, 
        avgFocus: avgFocus 
      },
      headMovement: { 
        score: headScore, 
        tilts: headTilts, 
        rotations: headRotations 
      },
      facialExpressions: { 
        score: facialScore, 
        stressLevel: stressLevel, 
        attention: attention 
      },
      audioAnalysis: { 
        score: audioScore, 
        noiseLevel: noiseLevel, 
        voiceClarity: voiceClarity 
      },
      tabSwitching: { 
        detected: tabSwitching, 
        count: tabCount, 
        lastSwitch: tabSwitchRef.current.lastSwitch || null,
      },
      environment: { 
        stable: environmentStable, 
        changes: environmentChanges, 
        suspiciousActivity: suspiciousActivity,
        peopleCount,
        multipleFaces,
      }
    };

    setAnalysisData(newAnalysisData);

    // Do not generate automatic gaze/stress/environment violations here.
    // Only explicit events (tab visibility, suspicious keyboard, multiple faces) trigger violations.

    onAnalysisUpdate?.(newAnalysisData);
  }, [isMonitoring, onViolation, onAnalysisUpdate]);

  const startMonitoring = async () => {
    try {
      // Always request our own camera + microphone stream for monitoring
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: 'user',
        },
        audio: true,
      });
      ownsStreamRef.current = true;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize FaceMesh processing
      await initFaceMesh();
      if (videoRef.current) {
        await new Promise((res) => {
          if (videoRef.current.readyState >= 2) return res();
          videoRef.current.onloadedmetadata = () => res();
        });
      }

      // Explicit requestAnimationFrame loop to drive FaceMesh with live frames
      if (faceMeshRef.current && videoRef.current) {
        const processFrame = async () => {
          if (!videoRef.current || !faceMeshRef.current) {
            frameRafRef.current = requestAnimationFrame(processFrame);
            return;
          }
          try {
            await faceMeshRef.current.send({ image: videoRef.current });
          } catch (e) {
            // Swallow FaceMesh errors to keep loop alive
          }
          frameRafRef.current = requestAnimationFrame(processFrame);
        };
        frameRafRef.current = requestAnimationFrame(processFrame);
      }

      // Set up audio analysis
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setIsMonitoring(true);
      setIsRecording(true);

      // Start analysis interval (250ms for more realtime feel), also compute VU
      analysisIntervalRef.current = setInterval(() => {
        performAIAnalysis();
        try {
          if (analyserRef.current) {
            const bufferLength = analyserRef.current.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              const v = (dataArray[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / bufferLength);
            setVu(Math.min(100, Math.max(0, Math.round(rms * 200))));
          }
        } catch {}
      }, 250);

      // Set up tab visibility detection
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Set up keyboard shortcuts detection
      document.addEventListener('keydown', handleKeyDown);

    } catch (error) {
      console.error('Failed to start monitoring:', error);
      alert('Failed to access camera and microphone. Please check permissions.');
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setIsRecording(false);
    
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }

    if (frameRafRef.current) {
      cancelAnimationFrame(frameRafRef.current);
      frameRafRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject && ownsStreamRef.current) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('keydown', handleKeyDown);
  };

  const handleVisibilityChange = () => {
    if (document.hidden && isMonitoring) {
      const now = new Date();
      // Update tab switch tracking
      tabSwitchRef.current = {
        detected: true,
        count: (tabSwitchRef.current.count || 0) + 1,
        lastSwitch: now,
      };

      const violation = {
        id: now.getTime(),
        type: 'tab_switch',
        severity: 'critical',
        message: 'Tab switching detected during interview',
        timestamp: now,
      };
      setViolations(prev => [...prev, violation]);
      onViolation?.([violation]);
    }
  };

  const handleKeyDown = (event) => {
    if (!isMonitoring) return;

    // Detect common cheating shortcuts (including DevTools keys)
    const cheatingKeys = ['F12', 'F11', 'F10'];
    const keyCombo = event.ctrlKey || event.altKey || event.shiftKey;
    
    if (cheatingKeys.includes(event.key) || (keyCombo && event.key === 'I')) {
      const violation = {
        id: Date.now(),
        type: 'suspicious_keyboard',
        severity: 'warning',
        message: `Suspicious keyboard activity: ${event.key}`,
        timestamp: new Date()
      };
      setViolations(prev => [...prev, violation]);
      onViolation?.([violation]);
    }
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

  const getViolationSeverity = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  useEffect(() => {
    if (autoStart) {
      // Defer auto start to allow refs to mount
      setTimeout(async () => {
        await startMonitoring();
        // Auto-calibrate after 1.5s if not calibrated
        autoCalibrateTimerRef.current = setTimeout(() => {
          if (!isCalibrated) calibrate();
        }, 1500);
      }, 300);
    }
    return () => {
      stopMonitoring();
      if (autoCalibrateTimerRef.current) clearTimeout(autoCalibrateTimerRef.current);
    };
  }, [autoStart, isCalibrated]);

  return (
    <div className="space-y-6">
      {/* Monitoring Controls */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-6 h-6 text-purple-600" />
            <span>AI Monitoring System</span>
            <Badge className={isMonitoring ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
              {isMonitoring ? "Active" : "Inactive"}
            </Badge>
            <Badge className={isCalibrated ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}>
              {isCalibrated ? "Calibrated" : "Needs Calibration"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Real-time behavior analysis and fraud detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              className={isMonitoring ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isMonitoring ? (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Stop Monitoring
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  Start Monitoring
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={calibrate}
              disabled={!isMonitoring}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              Calibrate
            </Button>
            
            {isRecording && (
              <div className="flex items-center space-x-2 text-red-600">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Recording</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Video Feed */}
      {isMonitoring && (
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="w-5 h-5" />
              <span>Live Video Feed</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-64 bg-gray-900 rounded-lg"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ opacity: 0.3 }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Metrics */}
      <div
        className="w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '20px',
          alignItems: 'stretch',
        }}
      >
        {/* Gaze Tracking */}
        <Card className="border-0 shadow-lg bg-white h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-blue-600" />
              <span>Gaze Tracking</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Focus Score</span>
              <Badge className={getScoreBadge(analysisData.gazeTracking.avgFocus)}>
                {(analysisData.gazeTracking.avgFocus * 100).toFixed(1)}%
              </Badge>
            </div>
            <Progress value={analysisData.gazeTracking.avgFocus * 100} className="h-2" />
            <div className="text-sm text-gray-600">
              Deviations: {analysisData.gazeTracking.deviations}
            </div>
          </CardContent>
        </Card>

        {/* Head Movement */}
        <Card className="border-0 shadow-lg bg-white h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-green-600" />
              <span>Head Movement</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Stability Score</span>
              <Badge className={getScoreBadge(analysisData.headMovement.score)}>
                {(analysisData.headMovement.score * 100).toFixed(1)}%
              </Badge>
            </div>
            <Progress value={analysisData.headMovement.score * 100} className="h-2" />
            <div className="text-sm text-gray-600">
              Tilts: {analysisData.headMovement.tilts} | Rotations: {analysisData.headMovement.rotations}
            </div>
            <div className="text-sm text-gray-600">
              Yaw: {pose.yaw}° | Pitch: {pose.pitch}°
            </div>
          </CardContent>
        </Card>

        {/* Facial Expressions */}
        <Card className="border-0 shadow-lg bg-white h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <span>Facial Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Attention Score</span>
              <Badge className={getScoreBadge(analysisData.facialExpressions.attention)}>
                {(analysisData.facialExpressions.attention * 100).toFixed(1)}%
              </Badge>
            </div>
            <Progress value={analysisData.facialExpressions.attention * 100} className="h-2" />
            <div className="text-sm text-gray-600">
              Stress Level: {(analysisData.facialExpressions.stressLevel * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* Audio Analysis */}
        <Card className="border-0 shadow-lg bg-white h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-orange-600" />
              <span>Audio Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Voice Clarity</span>
              <Badge className={getScoreBadge(analysisData.audioAnalysis.voiceClarity)}>
                {(analysisData.audioAnalysis.voiceClarity * 100).toFixed(1)}%
              </Badge>
            </div>
            <Progress value={analysisData.audioAnalysis.voiceClarity * 100} className="h-2" />
            <div className="text-sm text-gray-600">
              Noise Level: {(analysisData.audioAnalysis.noiseLevel * 100).toFixed(1)}%
            </div>
            <div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Voice Activity</span>
                <span className="text-xs text-gray-500">{vu}%</span>
              </div>
              <Progress value={vu} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Tab Switching */}
        <Card className="border-0 shadow-lg bg-white h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="w-5 h-5 text-red-600" />
              <span>Tab Monitoring</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Status</span>
              <Badge className={analysisData.tabSwitching.detected ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                {analysisData.tabSwitching.detected ? "Violation" : "Clean"}
              </Badge>
            </div>
            <div className="text-sm text-gray-600">
              Switch Count: {analysisData.tabSwitching.count}
            </div>
            {analysisData.tabSwitching.lastSwitch && (
              <div className="text-sm text-gray-600">
                Last Switch: {analysisData.tabSwitching.lastSwitch.toLocaleTimeString()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Environment */}
        <Card className="border-0 shadow-lg bg-white h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <span>Environment</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Stability</span>
              <Badge className={analysisData.environment.stable ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                {analysisData.environment.stable ? "Stable" : "Unstable"}
              </Badge>
            </div>
            <div className="text-sm text-gray-600">
              Changes: {analysisData.environment.changes}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">People in Frame</span>
              <Badge className={analysisData.environment.multipleFaces ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                {analysisData.environment.peopleCount || 0}
              </Badge>
            </div>
            {analysisData.environment.suspiciousActivity && (
              <div className="text-sm text-red-600 font-medium">
                Suspicious Activity Detected!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <span>Security Violations</span>
              <Badge className="bg-red-100 text-red-800">
                {violations.length} detected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {violations.slice(-10).reverse().map((violation) => (
                <Alert key={violation.id} className={getViolationSeverity(violation.severity)}>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-center">
                      <span>{violation.message}</span>
                      <span className="text-xs text-gray-500">
                        {violation.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default AIMonitoringSystem;
