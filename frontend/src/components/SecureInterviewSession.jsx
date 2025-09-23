import React, { useState, useEffect, useRef, useCallback } from 'react';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
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
import PreInterviewOnboarding from './PreInterviewOnboarding';

const SecureInterviewSession = ({ interview, company, job, onEnd, onClose }) => {
  const [sessionPhase, setSessionPhase] = useState('onboarding'); // onboarding, monitoring, completed
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
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  const videoRef = useRef(null);
  const screenRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const timerRef = useRef(null);
  const analysisDataRef = useRef({});

  // Recording refs
  const webcamRecorderRef = useRef(null);
  const screenRecorderRef = useRef(null);
  const webcamChunksRef = useRef([]);
  const screenChunksRef = useRef([]);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Sample interview questions
  const interviewQuestions = [
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
      type: 'descriptive',
      question: 'Explain the concept of closures in JavaScript with an example.',
      timeLimit: 120
    },
    {
      id: 3,
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
      id: 4,
      type: 'descriptive',
      question: 'Describe your experience with version control systems like Git.',
      timeLimit: 90
    }
  ];

  useEffect(() => {
    if (sessionPhase === 'monitoring') {
      // Prevent background scroll while session is active
      try { document.body.classList.add('overflow-hidden'); } catch {}
      startInterviewSession();
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

      if (screenRef.current) {
        screenRef.current.srcObject = screenStream;
        screenStreamRef.current = screenStream;
      }

      // Start MediaRecorders
      startRecorders(cameraStream, screenStream);

      // Notify backend that recording session started (creates DB doc)
      try {
        await fetch(`${API}/interviews/${interview.id}/start-recording`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` }
        });
      } catch (e) {
        console.warn('Failed to start backend recording doc', e);
      }

      // Request fullscreen
      if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); } catch (e) {}
      }

      // Set up tab locking
      setupTabLocking();

      // Start session timer
      const startTime = new Date();
      setSessionData(prev => ({ ...prev, startTime }));
      
      // Start question timer
      startQuestionTimer();
      // Enable answering for MCQ by default
      const q = interviewQuestions[0];
      if (q && q.type === 'multiple_choice') {
        setIsAnswering(true);
      }

    } catch (error) {
      console.error('Failed to start interview session:', error);
      alert('Failed to start interview session. Please check permissions.');
    }
  };

  const startRecorders = (cameraStream, screenStream) => {
    try {
      // Webcam recorder
      webcamChunksRef.current = [];
      const webcamRecorder = new MediaRecorder(cameraStream, { mimeType: 'video/webm;codecs=vp9' });
      webcamRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) webcamChunksRef.current.push(e.data); };
      webcamRecorder.start(2000);
      webcamRecorderRef.current = webcamRecorder;

      // Screen recorder
      screenChunksRef.current = [];
      const screenRecorder = new MediaRecorder(screenStream, { mimeType: 'video/webm;codecs=vp9' });
      screenRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) screenChunksRef.current.push(e.data); };
      screenRecorder.start(2000);
      screenRecorderRef.current = screenRecorder;

      // Audio-only recorder from microphone (cameraStream audio track)
      const audioTracks = cameraStream.getAudioTracks();
      if (audioTracks && audioTracks.length) {
        audioChunksRef.current = [];
        const micStream = new MediaStream([audioTracks[0]]);
        const audioRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' });
        audioRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
        audioRecorder.start(2000);
        audioRecorderRef.current = audioRecorder;
      }
    } catch (e) {
      console.warn('Failed to start recorders', e);
    }
  };

  const stopRecorders = async () => {
    const stopOne = (rec) => new Promise((resolve) => {
      if (!rec) return resolve();
      try {
        rec.onstop = () => resolve();
        rec.stop();
      } catch {
        resolve();
      }
    });
    await Promise.all([
      stopOne(webcamRecorderRef.current),
      stopOne(screenRecorderRef.current),
      stopOne(audioRecorderRef.current)
    ]);
  };

  const uploadBlob = async (blob, kind) => {
    if (!blob) return;
    try {
      const form = new FormData();
      form.append('recording_type', kind);
      form.append('file', new File([blob], `${kind}.webm`, { type: 'video/webm' }));
      await fetch(`${API}/interviews/${interview.id}/upload-recording`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` },
        body: form
      });
    } catch (e) {
      console.warn('Upload failed for', kind, e);
    }
  };

  const submitSubmission = async () => {
    try {
      const payload = {
        answers: sessionData.answers.map(a => ({
          questionId: a.questionId,
          question: a.question,
          answer: a.answer,
          timeSpent: a.timeSpent
        })),
        notes: null,
        ai_scores: { overall: sessionData.overallScore }
      };
      await fetch(`${API}/interviews/${interview.id}/submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}`
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Failed to submit answers', e);
    }
  };

  const setupTabLocking = () => {
    // Disable right-click
    document.addEventListener('contextmenu', e => e.preventDefault());
    
    // Disable developer tools
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'C') ||
          (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        handleViolation({
          type: 'dev_tools_attempt',
          severity: 'critical',
          message: 'Attempted to open developer tools'
        });
      }
    });

    // Monitor tab visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleViolation({
          type: 'tab_switch',
          severity: 'critical',
          message: 'Tab switching detected during interview'
        });
      }
    });

    // Disable window controls
    window.addEventListener('beforeunload', (e) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the interview?';
    });
  };

  const startQuestionTimer = () => {
    if (currentQuestion < interviewQuestions.length) {
      const question = interviewQuestions[currentQuestion];
      setTimeRemaining(question.timeLimit);
      
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleTimeUp = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (isAnswering) {
      submitAnswer();
    }
    
    // Move to next question
    if (currentQuestion < interviewQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setAnswer('');
      setIsAnswering(false);
      startQuestionTimer();
    } else {
      endInterview();
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
    const question = interviewQuestions[currentQuestion];
    const answerData = {
      questionId: question.id,
      question: question.question,
      answer: answer,
      timeSpent: question.timeLimit - timeRemaining,
      timestamp: new Date(),
      analysisData: { ...analysisDataRef.current }
    };

    setSessionData(prev => ({
      ...prev,
      answers: [...prev.answers, answerData]
    }));

    // Stop current timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsAnswering(false);
    setAnswer('');

    // Move to next question or finish
    if (currentQuestion < interviewQuestions.length - 1) {
      const nextIndex = currentQuestion + 1;
      setCurrentQuestion(nextIndex);
      // Auto-enable for MCQ
      const nextQ = interviewQuestions[nextIndex];
      if (nextQ.type === 'multiple_choice') {
        setIsAnswering(true);
      }
      // Restart timer for next question
      setTimeout(() => startQuestionTimer(), 0);
    } else {
      endInterview();
    }
  };

  const endInterview = () => {
    const endTime = new Date();
    const duration = sessionData.startTime ? 
      Math.floor((endTime - sessionData.startTime) / 1000) : 0;
    
    setSessionData(prev => ({
      ...prev,
      endTime,
      duration
    }));

    // Calculate overall score
    calculateOverallScore();
    
    // Finalize: stop recorders, upload, submit answers
    finalizeInterview();
  };

  const finalizeInterview = async () => {
    try {
      await stopRecorders();
      // Create blobs
      const webcamBlob = webcamChunksRef.current.length ? new Blob(webcamChunksRef.current, { type: 'video/webm' }) : null;
      const screenBlob = screenChunksRef.current.length ? new Blob(screenChunksRef.current, { type: 'video/webm' }) : null;
      const audioBlob = audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: 'audio/webm' }) : null;
      // Upload in sequence
      if (webcamBlob) await uploadBlob(webcamBlob, 'webcam');
      if (screenBlob) await uploadBlob(screenBlob, 'screen');
      if (audioBlob) await uploadBlob(audioBlob, 'audio');
      // Submit answers
      await submitSubmission();

      // Notify backend that recording ended (updates DB and marks interview completed)
      try {
        await fetch(`${API}/interviews/${interview.id}/end-recording`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` }
        });
      } catch (e) {
        console.warn('Failed to end backend recording doc', e);
      }

      // Also mark interview completed status (defensive)
      try {
        await fetch(`${API}/interviews/${interview.id}/end`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('secuhire_token')}` }
        });
      } catch (e) {
        console.warn('Failed to mark interview completed', e);
      }
    } catch (e) {
      console.warn('Finalize failed', e);
    } finally {
      setSessionPhase('completed');
      cleanup();
    }
  };

  const calculateOverallScore = () => {
    // Calculate score based on answers and behavior
    let score = 0;
    let totalQuestions = interviewQuestions.length;
    
    // Score based on correct answers
    sessionData.answers.forEach(answer => {
      const question = interviewQuestions.find(q => q.id === answer.questionId);
      if (question && question.type === 'multiple_choice') {
        if (answer.answer === question.correctAnswer.toString()) {
          score += 1;
        }
      } else if (question && question.type === 'descriptive') {
        // For descriptive questions, give partial credit based on length and analysis
        const answerLength = answer.answer.length;
        const analysisScore = answer.analysisData?.facialExpressions?.attention || 0.5;
        score += Math.min(1, (answerLength / 100) * analysisScore);
      }
    });

    // Penalize for violations
    const violationPenalty = sessionData.violations.length * 0.1;
    score = Math.max(0, score - violationPenalty);

    // Normalize to percentage
    const finalScore = Math.round((score / totalQuestions) * 100);
    
    setSessionData(prev => ({
      ...prev,
      overallScore: finalScore
    }));
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Reset recorders
    webcamRecorderRef.current = null;
    screenRecorderRef.current = null;
    audioRecorderRef.current = null;
    webcamChunksRef.current = [];
    screenChunksRef.current = [];
    audioChunksRef.current = [];

    // Re-enable features
    document.removeEventListener('contextmenu', e => e.preventDefault());
    document.removeEventListener('keydown', e => e.preventDefault());
    document.removeEventListener('visibilitychange', () => {});
    window.removeEventListener('beforeunload', e => e.preventDefault());

    // Exit fullscreen and restore page scroll
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
      document.body.classList.remove('overflow-hidden');
    } catch {}
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

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

  if (sessionPhase === 'completed') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Interview Completed
            </CardTitle>
            <CardDescription>
              Thank you for completing the interview. Your results are being processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Results Summary */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {sessionData.overallScore}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Score</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {sessionData.violations.length}
                  </div>
                  <div className="text-sm text-gray-600">Violations</div>
                </CardContent>
              </Card>
            </div>

            {/* Violations Summary */}
            {sessionData.violations.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Security Violations</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {sessionData.violations.map((violation, index) => (
                    <Alert key={index} className="border-red-200 bg-red-50">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription className="text-sm">
                        {violation.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-white flex items-stretch justify-stretch">
      <div className="w-screen h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div>
              <h2 className="text-2xl font-bold">Secure Interview Session</h2>
              <p className="text-gray-600">Question {currentQuestion + 1} of {interviewQuestions.length}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge className="bg-green-100 text-green-800">
              <Clock className="w-4 h-4 mr-1" />
              {formatTime(timeRemaining)}
            </Badge>
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              End Interview
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Interview Area */}
          <div className="flex-1 p-6 overflow-y-auto min-w-0">
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Video Feed */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Camera className="w-5 h-5" />
                    <span>Your Video</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-64 bg-gray-900 rounded-lg"
                  />
                </CardContent>
              </Card>

              {/* Screen Share */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Monitor className="w-5 h-5" />
                    <span>Screen Share</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <video
                    ref={screenRef}
                    autoPlay
                    muted
                    className="w-full h-64 bg-gray-900 rounded-lg"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Question Area */}
            <Card className="mt-6">
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
                          <label key={index} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="radio"
                              name="answer"
                              value={index}
                              checked={answer === index.toString()}
                              onChange={(e) => {
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
                        <Button onClick={startAnswering} className="bg-blue-600 hover:bg-blue-700">
                          Start Answering
                        </Button>
                      )}
                      <Button onClick={submitAnswer} disabled={!isAnswering || answer === ''} className="bg-green-600 hover:bg-green-700">
                        Submit Answer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Monitoring Panel */}
          <div className="w-80 border-l p-6 overflow-y-auto">
            <AIMonitoringSystem
              autoStart
              onViolation={handleViolation}
              onAnalysisUpdate={handleAnalysisUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecureInterviewSession;
