import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Calendar, Clock, Video, Shield, AlertTriangle, CheckCircle, 
  Building2, Users, FileText, Camera, Monitor, Lock, Eye,
  Volume2, Smartphone, Laptop, Headphones, X
} from 'lucide-react';

const PreInterviewOnboarding = ({ interview, company, job, onProceed, onCancel }) => {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isTestingMedia, setIsTestingMedia] = useState(false);
  const [mediaTestStatus, setMediaTestStatus] = useState(null); // 'success' | 'error' | null
  const [mediaTestError, setMediaTestError] = useState('');
  const mediaPreviewRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const handleTestMedia = async () => {
    setIsTestingMedia(true);
    setMediaTestStatus(null);
    setMediaTestError('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Your browser does not support camera/microphone access. Please use a modern browser like Chrome.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360, facingMode: 'user' },
        audio: true,
      });

      if (mediaPreviewRef.current) {
        const videoEl = mediaPreviewRef.current;
        videoEl.srcObject = stream;
        // Some browsers require an explicit play() after assigning srcObject
        videoEl.play?.().catch(() => {
          // Ignore autoplay errors; user interaction already happened via button click
        });
      }
      mediaStreamRef.current = stream;
      setMediaTestStatus('success');
    } catch (err) {
      console.error('Media test failed', err);
      setMediaTestStatus('error');
      setMediaTestError(err?.message || 'Unable to access camera or microphone. Please check your browser permissions and device.');
    } finally {
      setIsTestingMedia(false);
    }
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const interviewDate = new Date(interview.scheduled_date);
  const timeUntilInterview = Math.max(0, interviewDate.getTime() - Date.now());
  const hoursUntil = Math.floor(timeUntilInterview / (1000 * 60 * 60));
  const minutesUntil = Math.floor((timeUntilInterview % (1000 * 60 * 60)) / (1000 * 60));

  const onboardingSteps = [
    {
      title: "Interview Details",
      icon: <Calendar className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Date & Time</p>
                <p className="font-semibold">{interviewDate.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-semibold">{interview.duration_minutes} minutes</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Interview Type: {interview.interview_type}</h4>
            <p className="text-blue-800 text-sm">
              This will be a secure video interview with AI-powered monitoring to ensure authenticity.
            </p>
          </div>

          {timeUntilInterview > 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <Clock className="w-4 h-4" />
              <AlertDescription>
                <strong>Time until interview:</strong> {hoursUntil}h {minutesUntil}m
              </AlertDescription>
            </Alert>
          )}
        </div>
      )
    },
    {
      title: "Company Information",
      icon: <Building2 className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{company?.name || 'Company Name'}</h3>
              <p className="text-gray-600">{company?.industry || 'Technology'}</p>
              <p className="text-sm text-gray-500">{company?.size || '50-200 employees'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Position</h4>
              <p className="text-gray-700">{job?.title || 'Software Developer'}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Department</h4>
              <p className="text-gray-700">{job?.department || 'Engineering'}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Job Description</h4>
            <p className="text-gray-700 text-sm leading-relaxed">
              {job?.description || 'We are looking for a talented developer to join our team...'}
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Interview Guidelines",
      icon: <Shield className="w-6 h-6" />,
      content: (
        <div className="space-y-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Important:</strong> This is a monitored interview. Please read all guidelines carefully.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                Required Setup
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <Camera className="w-4 h-4 text-blue-600 mr-2" />
                  Front camera must be enabled and working
                </li>
                <li className="flex items-center">
                  <Monitor className="w-4 h-4 text-blue-600 mr-2" />
                  Screen sharing will be required
                </li>
                <li className="flex items-center">
                  <Volume2 className="w-4 h-4 text-blue-600 mr-2" />
                  Microphone must be enabled
                </li>
                <li className="flex items-center">
                  <Headphones className="w-4 h-4 text-blue-600 mr-2" />
                  Use headphones to prevent echo
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                Prohibited Actions
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <Lock className="w-4 h-4 text-red-600 mr-2" />
                  No tab switching during interview
                </li>
                <li className="flex items-center">
                  <Eye className="w-4 h-4 text-red-600 mr-2" />
                  Face must remain visible at all times
                </li>
                <li className="flex items-center">
                  <Smartphone className="w-4 h-4 text-red-600 mr-2" />
                  No external devices or phones
                </li>
                <li className="flex items-center">
                  <Users className="w-4 h-4 text-red-600 mr-2" />
                  No assistance from others
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">AI Monitoring</h4>
            <p className="text-yellow-800 text-sm">
              Our AI system will monitor your behavior, including eye movement, head position, 
              and facial expressions to ensure interview integrity. Any suspicious activity 
              will be flagged for review.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Technical Requirements",
      icon: <Laptop className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">System Requirements</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Modern web browser (Chrome, Firefox, Safari, Edge)
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Stable internet connection (minimum 2 Mbps)
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Webcam with 720p resolution or higher
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Microphone for audio communication
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Environment Setup</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Well-lit room with good lighting
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Quiet environment without distractions
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Clean, professional background
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Stable seating position
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Test Your Setup</h4>
            <p className="text-blue-800 text-sm mb-3">
              Before starting the interview, we'll test your camera, microphone, and internet connection.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700"
              onClick={handleTestMedia}
              disabled={isTestingMedia}
            >
              <Video className="w-4 h-4 mr-2" />
              {isTestingMedia ? 'Testing...' : 'Test Camera & Microphone'}
            </Button>
            {mediaTestStatus === 'success' && (
              <div className="mt-4 flex items-start space-x-4">
                <video
                  ref={mediaPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-40 h-28 bg-black rounded-md border border-blue-200 object-cover"
                />
                <div className="text-sm text-blue-900 space-y-1">
                  <p className="font-medium flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    Camera and microphone look good.
                  </p>
                  <p className="text-blue-800">
                    If you can see yourself and the icon shows access granted, you are ready to start.
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                    onClick={onProceed}
                  >
                    Start Secure Interview
                  </Button>
                </div>
              </div>
            )}
            {mediaTestStatus === 'error' && (
              <div className="mt-3 text-sm text-red-700 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <p>{mediaTestError}</p>
              </div>
            )}
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    // Check if all requirements are met
    const checkReadiness = () => {
      // In a real implementation, you would check:
      // - Camera access
      // - Microphone access
      // - Internet speed
      // - Browser compatibility
      setIsReady(true);
    };

    checkReadiness();
  }, []);

  const handleProceed = () => {
    if (agreedToTerms && isReady) {
      onProceed();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div>
              <h2 className="text-2xl font-bold">Pre-Interview Onboarding</h2>
              <p className="text-gray-600">Prepare for your secure interview</p>
            </div>
          </div>
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>

        <div className="flex">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-gray-50 p-6 border-r">
            <div className="space-y-2">
              {onboardingSteps.map((step, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentStep === index
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {step.icon}
                    <span className="font-medium">{step.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-3xl">
              <div className="flex items-center space-x-3 mb-6">
                {onboardingSteps[currentStep].icon}
                <h3 className="text-xl font-bold text-gray-900">
                  {onboardingSteps[currentStep].title}
                </h3>
              </div>

              {onboardingSteps[currentStep].content}

              {/* Navigation */}
              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                >
                  Previous
                </Button>
                
                {currentStep < onboardingSteps.length - 1 ? (
                  <Button
                    onClick={() => setCurrentStep(Math.min(onboardingSteps.length - 1, currentStep + 1))}
                  >
                    Next
                  </Button>
                ) : (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="terms"
                        checked={agreedToTerms}
                        onCheckedChange={setAgreedToTerms}
                      />
                      <label htmlFor="terms" className="text-sm text-gray-700">
                        I agree to the terms and conditions
                      </label>
                    </div>
                    <Button
                      onClick={handleProceed}
                      disabled={!agreedToTerms || !isReady}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Start Secure Interview
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreInterviewOnboarding;
