import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Progress } from "./components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { 
  Shield, Users, Briefcase, TrendingUp, Plus, Search, Filter, 
  MapPin, DollarSign, Calendar, Phone, Mail, FileText, 
  ChevronRight, Star, Clock, CheckCircle, User, Edit,
  BarChart3, PieChart, Target, Award, Zap, Brain, Building2,
  Eye, Heart, Send, Video, AlertTriangle, Verified
} from "lucide-react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context for Both Recruiters and Candidates
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('secuhire_token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, [token]);

  const login = (userData, userToken, role, companyData = null) => {
    console.log('Login called with:', { userData, userToken, role, companyData });
    setUser(userData);
    setCompany(companyData);
    setToken(userToken);
    setUserRole(role);
    localStorage.setItem('secuhire_token', userToken);
    localStorage.setItem('user_role', role);
    if (companyData) {
      localStorage.setItem('company_data', JSON.stringify(companyData));
    }
    axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
  };

  const logout = () => {
    setUser(null);
    setCompany(null);
    setToken(null);
    setUserRole(null);
    localStorage.removeItem('secuhire_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('company_data');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, company, token, userRole, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Landing Page for SecuHire with Dual Options
const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50">
      {/* Header */}
      <header className="px-6 py-4 border-b border-purple-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Shield className="w-8 h-8 text-purple-600" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full animate-pulse"></div>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-teal-600 to-orange-500 bg-clip-text text-transparent">SecuHire</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" className="text-slate-600 hover:text-purple-600 hover:bg-purple-50">Features</Button>
            <Button variant="ghost" className="text-slate-600 hover:text-teal-600 hover:bg-teal-50">Pricing</Button>
            <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => window.location.href = '/auth?type=recruiter'}>Recruiter Login</Button>
            <Button variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50" onClick={() => window.location.href = '/auth?type=candidate'}>Candidate Login</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-100 to-teal-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                  <Zap className="w-4 h-4" />
                  <span>AI-Powered Secure Hiring Platform</span>
                </div>
                <h2 className="text-5xl font-bold text-slate-800 leading-tight mb-6">
                  Secure & Intelligent
                  <span className="bg-gradient-to-r from-purple-600 via-teal-600 to-orange-500 bg-clip-text text-transparent block">Hiring Platform</span>
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed">
                  Connect talented candidates with innovative companies through our secure platform. 
                  Advanced verification, AI-powered matching, and streamlined hiring process.
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white px-8 py-4 shadow-xl" onClick={() => window.location.href = '/auth?type=recruiter'}>
                  <Building2 className="w-5 h-5 mr-2" />
                  For Recruiters
                </Button>
                <Button size="lg" className="bg-gradient-to-r from-teal-600 to-orange-500 hover:from-teal-700 hover:to-orange-600 text-white px-8 py-4 shadow-xl" onClick={() => window.location.href = '/auth?type=candidate'}>
                  <User className="w-5 h-5 mr-2" />
                  For Candidates
                </Button>
              </div>

              <div className="flex items-center space-x-8 pt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-slate-600 font-medium">Secure Verification</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-slate-600 font-medium">AI-Powered Matching</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-slate-600 font-medium">Smart Pipeline</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-teal-600/20 rounded-3xl blur-3xl"></div>
              <img 
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?crop=entropy&cs=srgb&fm=jpg&q=85"
                alt="Professional Team Collaboration"
                className="relative rounded-2xl shadow-2xl w-full h-[500px] object-cover border border-white/20"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Dual Features Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-slate-50 to-purple-50/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-slate-800 mb-4">For Every Step of Your Career Journey</h3>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Whether you're hiring talent or seeking opportunities, SecuHire provides the tools you need
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* For Recruiters */}
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-2xl font-bold text-slate-800 mb-2">For Recruiters</h4>
                <p className="text-slate-600">Complete ATS & CRM solution for modern hiring teams</p>
              </div>

              <div className="space-y-4">
                <Card className="border-0 shadow-lg bg-white group hover:shadow-xl transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Briefcase className="w-6 h-6 text-purple-600" />
                      <div>
                        <h5 className="font-semibold text-slate-800">Smart Job Management</h5>
                        <p className="text-sm text-slate-600">AI-assisted job creation and publishing</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white group hover:shadow-xl transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Users className="w-6 h-6 text-purple-600" />
                      <div>
                        <h5 className="font-semibold text-slate-800">Candidate Database</h5>
                        <p className="text-sm text-slate-600">Verified profiles with skill matching</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white group hover:shadow-xl transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="w-6 h-6 text-purple-600" />
                      <div>
                        <h5 className="font-semibold text-slate-800">Analytics Dashboard</h5>
                        <p className="text-sm text-slate-600">Hiring metrics and pipeline insights</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* For Candidates */}
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-2xl font-bold text-slate-800 mb-2">For Candidates</h4>
                <p className="text-slate-600">Secure platform to find and apply for dream jobs</p>
              </div>

              <div className="space-y-4">
                <Card className="border-0 shadow-lg bg-white group hover:shadow-xl transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Search className="w-6 h-6 text-teal-600" />
                      <div>
                        <h5 className="font-semibold text-slate-800">Job Discovery</h5>
                        <p className="text-sm text-slate-600">Find relevant opportunities with smart matching</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white group hover:shadow-xl transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Verified className="w-6 h-6 text-teal-600" />
                      <div>
                        <h5 className="font-semibold text-slate-800">Secure Verification</h5>
                        <p className="text-sm text-slate-600">Email and phone verification for authenticity</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white group hover:shadow-xl transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Video className="w-6 h-6 text-teal-600" />
                      <div>
                        <h5 className="font-semibold text-slate-800">Secure Interviews</h5>
                        <p className="text-sm text-slate-600">AI-monitored interviews with fraud detection</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-purple-600 via-teal-600 to-orange-500 rounded-3xl p-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/20 rounded-3xl"></div>
            <div className="relative">
              <h3 className="text-4xl font-bold mb-6">Ready to Transform Your Career?</h3>
              <p className="text-xl text-purple-100 mb-8">
                Join thousands of professionals and companies using SecuHire for secure, efficient hiring.
              </p>
              <div className="flex justify-center space-x-4">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-purple-50 px-8 py-4 text-lg font-semibold shadow-xl" onClick={() => window.location.href = '/auth?type=recruiter'}>
                  Start Hiring
                </Button>
                <Button size="lg" className="bg-purple-800 text-white hover:bg-purple-900 px-8 py-4 text-lg font-semibold shadow-xl" onClick={() => window.location.href = '/auth?type=candidate'}>
                  Find Jobs
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// Dual Auth Component for Both Recruiters and Candidates
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('type') || 'recruiter';
  });
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    company_domain: '',
    company_size: '',
    industry: '',
    phone: '',
    location: '',
    current_title: '',
    current_company: '',
    experience_years: '',
    education: '',
    skills: '',
    expected_salary: '',
    linkedin_url: '',
    portfolio_url: '',
    bio: ''
  });
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState(null);
  const [verificationCodes, setVerificationCodes] = useState({});
  const [verificationInputs, setVerificationInputs] = useState({
    emailCode: '',
    phoneOtp: ''
  });
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? 
        (userType === 'recruiter' ? '/recruiters/auth/login' : '/candidates/auth/login') :
        (userType === 'recruiter' ? '/recruiters/auth/register' : '/candidates/auth/register');
      
      let payload;
      if (isLogin) {
        payload = { email: formData.email, password: formData.password };
      } else {
        if (userType === 'recruiter') {
          payload = {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            company_name: formData.company_name,
            company_domain: formData.company_domain,
            company_size: formData.company_size,
            industry: formData.industry
          };
        } else {
          payload = {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            phone: formData.phone,
            location: formData.location,
            current_title: formData.current_title,
            current_company: formData.current_company,
            experience_years: parseInt(formData.experience_years) || 0,
            education: formData.education,
            skills: formData.skills.split(',').map(s => s.trim()).filter(s => s),
            expected_salary: formData.expected_salary ? parseInt(formData.expected_salary) : null,
            linkedin_url: formData.linkedin_url,
            portfolio_url: formData.portfolio_url,
            bio: formData.bio
          };
        }
      }

      console.log('Submitting to:', `${API}${endpoint}`, payload);
      const response = await axios.post(`${API}${endpoint}`, payload);
      console.log('Auth response:', response.data);
      
      if (response.data.verification_required && userType === 'candidate' && !isLogin) {
        // Handle verification flow for new candidates
        setVerificationCodes({
          email: response.data.email_verification_code,
          phone: response.data.phone_otp,
          userId: response.data.user.id
        });
        setVerificationStep('verify');
        login(response.data.user, response.data.token, response.data.role, response.data.company);
      } else {
        // Direct login
        login(response.data.user, response.data.token, response.data.role, response.data.company);
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (type) => {
    try {
      setLoading(true);
      const endpoint = type === 'email' ? '/candidates/verify-email' : '/candidates/verify-phone';
      const code = type === 'email' ? verificationInputs.emailCode : verificationInputs.phoneOtp;
      
      await axios.post(`${API}${endpoint}`, {
        user_id: verificationCodes.userId,
        [type === 'email' ? 'verification_code' : 'otp_code']: code
      });
      
      alert(`${type === 'email' ? 'Email' : 'Phone'} verified successfully!`);
      
      // Check if both are verified, then proceed
      if (type === 'email') {
        setVerificationInputs({...verificationInputs, emailVerified: true});
      } else {
        setVerificationInputs({...verificationInputs, phoneVerified: true});
      }
      
    } catch (error) {
      alert(error.response?.data?.detail || `${type} verification failed`);
    } finally {
      setLoading(false);
    }
  };

  if (verificationStep === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Verified className="w-12 h-12 text-teal-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">
              Verify Your Account
            </CardTitle>
            <CardDescription className="text-slate-600">
              Complete verification to secure your account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Email Verification */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-medium">Email Verification</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter email code"
                  value={verificationInputs.emailCode}
                  onChange={(e) => setVerificationInputs({...verificationInputs, emailCode: e.target.value})}
                  className="flex-1"
                />
                <Button 
                  onClick={() => handleVerification('email')}
                  disabled={loading || !verificationInputs.emailCode}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  Verify
                </Button>
              </div>
              <p className="text-xs text-slate-500">Demo code: {verificationCodes.email}</p>
            </div>

            {/* Phone Verification */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-medium">Phone Verification</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter OTP"
                  value={verificationInputs.phoneOtp}
                  onChange={(e) => setVerificationInputs({...verificationInputs, phoneOtp: e.target.value})}
                  className="flex-1"
                />
                <Button 
                  onClick={() => handleVerification('phone')}
                  disabled={loading || !verificationInputs.phoneOtp}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Verify
                </Button>
              </div>
              <p className="text-xs text-slate-500">Demo OTP: {verificationCodes.phone}</p>
            </div>

            <Button 
              onClick={() => setVerificationStep(null)}
              className="w-full bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700"
            >
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              {userType === 'recruiter' ? (
                <Building2 className="w-12 h-12 text-purple-600" />
              ) : (
                <User className="w-12 h-12 text-teal-600" />
              )}
            </div>
          </div>
          
          {/* User Type Selector */}
          <div className="flex justify-center space-x-2 mb-6">
            <Button
              variant={userType === 'recruiter' ? 'default' : 'outline'}
              className={userType === 'recruiter' ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-300 text-purple-700'}
              onClick={() => setUserType('recruiter')}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Recruiter
            </Button>
            <Button
              variant={userType === 'candidate' ? 'default' : 'outline'}
              className={userType === 'candidate' ? 'bg-teal-600 hover:bg-teal-700' : 'border-teal-300 text-teal-700'}
              onClick={() => setUserType('candidate')}
            >
              <User className="w-4 h-4 mr-2" />
              Candidate
            </Button>
          </div>

          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-teal-600 bg-clip-text text-transparent">
            {isLogin ? 'Welcome Back to SecuHire' : `Join SecuHire as ${userType === 'recruiter' ? 'a Recruiter' : 'a Candidate'}`}
          </CardTitle>
          <CardDescription className="text-slate-600">
            {isLogin ? 
              `Sign in to your ${userType} dashboard` : 
              `Create your ${userType} account and get started`
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Common Fields */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  className="mt-1 border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  className="mt-1 border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
            </div>

            {!isLogin && (
              <>
                <div>
                  <Label htmlFor="full_name" className="text-slate-700 font-medium">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    required
                    className="mt-1 border-slate-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>

                {userType === 'recruiter' ? (
                  // Recruiter-specific fields
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="company_name" className="text-slate-700 font-medium">Company Name</Label>
                        <Input
                          id="company_name"
                          value={formData.company_name}
                          onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                          required
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="company_domain" className="text-slate-700 font-medium">Company Domain</Label>
                        <Input
                          id="company_domain"
                          value={formData.company_domain}
                          onChange={(e) => setFormData({...formData, company_domain: e.target.value})}
                          required
                          className="mt-1"
                          placeholder="company.com"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="company_size" className="text-slate-700 font-medium">Company Size</Label>
                        <Select onValueChange={(value) => setFormData({...formData, company_size: value})}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select company size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-200">51-200 employees</SelectItem>
                            <SelectItem value="200+">200+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="industry" className="text-slate-700 font-medium">Industry</Label>
                        <Select onValueChange={(value) => setFormData({...formData, industry: value})}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Technology">Technology</SelectItem>
                            <SelectItem value="Healthcare">Healthcare</SelectItem>
                            <SelectItem value="Finance">Finance</SelectItem>
                            <SelectItem value="Education">Education</SelectItem>
                            <SelectItem value="Retail">Retail</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                ) : (
                  // Candidate-specific fields
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone" className="text-slate-700 font-medium">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          required
                          className="mt-1"
                          placeholder="+1234567890"
                        />
                      </div>

                      <div>
                        <Label htmlFor="location" className="text-slate-700 font-medium">Location</Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                          required
                          className="mt-1"
                          placeholder="City, State"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="current_title" className="text-slate-700 font-medium">Current Job Title</Label>
                        <Input
                          id="current_title"
                          value={formData.current_title}
                          onChange={(e) => setFormData({...formData, current_title: e.target.value})}
                          required
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="current_company" className="text-slate-700 font-medium">Current Company</Label>
                        <Input
                          id="current_company"
                          value={formData.current_company}
                          onChange={(e) => setFormData({...formData, current_company: e.target.value})}
                          required
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="experience_years" className="text-slate-700 font-medium">Years of Experience</Label>
                        <Input
                          id="experience_years"
                          type="number"
                          value={formData.experience_years}
                          onChange={(e) => setFormData({...formData, experience_years: e.target.value})}
                          required
                          className="mt-1"
                          min="0"
                        />
                      </div>

                      <div>
                        <Label htmlFor="education" className="text-slate-700 font-medium">Education</Label>
                        <Input
                          id="education"
                          value={formData.education}
                          onChange={(e) => setFormData({...formData, education: e.target.value})}
                          required
                          className="mt-1"
                          placeholder="BS Computer Science"
                        />
                      </div>

                      <div>
                        <Label htmlFor="expected_salary" className="text-slate-700 font-medium">Expected Salary</Label>
                        <Input
                          id="expected_salary"
                          type="number"
                          value={formData.expected_salary}
                          onChange={(e) => setFormData({...formData, expected_salary: e.target.value})}
                          className="mt-1"
                          placeholder="120000"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="skills" className="text-slate-700 font-medium">Skills (comma-separated)</Label>
                      <Input
                        id="skills"
                        value={formData.skills}
                        onChange={(e) => setFormData({...formData, skills: e.target.value})}
                        required
                        className="mt-1"
                        placeholder="React, Python, JavaScript, MongoDB"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="linkedin_url" className="text-slate-700 font-medium">LinkedIn URL (Optional)</Label>
                        <Input
                          id="linkedin_url"
                          type="url"
                          value={formData.linkedin_url}
                          onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
                          className="mt-1"
                          placeholder="https://linkedin.com/in/yourprofile"
                        />
                      </div>

                      <div>
                        <Label htmlFor="portfolio_url" className="text-slate-700 font-medium">Portfolio URL (Optional)</Label>
                        <Input
                          id="portfolio_url"
                          type="url"
                          value={formData.portfolio_url}
                          onChange={(e) => setFormData({...formData, portfolio_url: e.target.value})}
                          className="mt-1"
                          placeholder="https://yourportfolio.com"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="bio" className="text-slate-700 font-medium">Professional Bio (Optional)</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData({...formData, bio: e.target.value})}
                        className="mt-1"
                        rows={3}
                        placeholder="Tell us about your professional background and goals..."
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white shadow-lg" 
              disabled={loading}
            >
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-purple-600 hover:text-teal-600 font-medium transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Candidate Dashboard Component
const CandidateDashboard = () => {
  const [activeTab, setActiveTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [myInterviews, setMyInterviews] = useState([]);
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    location: '',
    job_type: '',
    experience_level: ''
  });
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchCandidateData();
  }, []);

  const fetchCandidateData = async () => {
    try {
      const [jobsRes, applicationsRes, interviewsRes] = await Promise.all([
        axios.get(`${API}/candidates/jobs`),
        axios.get(`${API}/candidates/my-applications`),
        axios.get(`${API}/candidates/interviews`)
      ]);

      setJobs(jobsRes.data);
      setMyApplications(applicationsRes.data);
      setMyInterviews(interviewsRes.data);
    } catch (error) {
      console.error('Failed to fetch candidate data:', error);
    }
  };

  const applyForJob = async (jobId, coverLetter) => {
    try {
      await axios.post(`${API}/candidates/applications`, {
        job_id: jobId,
        cover_letter: coverLetter
      });
      alert('Application submitted successfully!');
      fetchCandidateData(); // Refresh data
    } catch (error) {
      alert(error.response?.data?.detail || 'Application failed');
    }
  };

  const searchJobs = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await axios.get(`${API}/candidates/jobs?${params}`);
      setJobs(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/20">
      {/* Header */}
      <header className="bg-white border-b border-teal-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Shield className="w-8 h-8 text-teal-600" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 via-purple-600 to-orange-500 bg-clip-text text-transparent">SecuHire</h1>
              <p className="text-sm text-slate-600">Candidate Portal</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {user?.is_email_verified ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Email Verified
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Email Pending
                </Badge>
              )}
              {user?.is_phone_verified ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Phone Verified
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Phone Pending
                </Badge>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600">Welcome back,</p>
              <p className="font-semibold text-slate-800">{user?.full_name}</p>
            </div>
            <Button variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Main Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-white border border-teal-200 shadow-sm">
              <TabsTrigger value="jobs" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">Browse Jobs</TabsTrigger>
              <TabsTrigger value="applications" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">My Applications</TabsTrigger>
              <TabsTrigger value="interviews" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">Interviews</TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">Profile</TabsTrigger>
            </TabsList>

            {/* Job Browsing */}
            <TabsContent value="jobs" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Available Jobs</h2>
                <Badge className="bg-teal-100 text-teal-800 border-teal-200">
                  {jobs.length} opportunities
                </Badge>
              </div>

              {/* Search and Filters */}
              <Card className="border-0 shadow-lg bg-white">
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Search</Label>
                      <div className="relative mt-1">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <Input
                          placeholder="Job title, skills..."
                          className="pl-10"
                          value={searchFilters.search}
                          onChange={(e) => setSearchFilters({...searchFilters, search: e.target.value})}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-slate-700">Location</Label>
                      <Input
                        placeholder="City, State"
                        className="mt-1"
                        value={searchFilters.location}
                        onChange={(e) => setSearchFilters({...searchFilters, location: e.target.value})}
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-slate-700">Job Type</Label>
                      <Select value={searchFilters.job_type} onValueChange={(value) => setSearchFilters({...searchFilters, job_type: value})}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All types</SelectItem>
                          <SelectItem value="Full-time">Full-time</SelectItem>
                          <SelectItem value="Part-time">Part-time</SelectItem>
                          <SelectItem value="Contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-slate-700">Experience Level</Label>
                      <Select value={searchFilters.experience_level} onValueChange={(value) => setSearchFilters({...searchFilters, experience_level: value})}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="All levels" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All levels</SelectItem>
                          <SelectItem value="Entry">Entry Level</SelectItem>
                          <SelectItem value="Mid">Mid Level</SelectItem>
                          <SelectItem value="Senior">Senior Level</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={searchJobs} className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 text-white">
                    <Search className="w-4 h-4 mr-2" />
                    Search Jobs
                  </Button>
                </CardContent>
              </Card>

              {/* Job Listings */}
              <div className="grid gap-6">
                {jobs.length > 0 ? jobs.map((item, index) => (
                  <CandidateJobCard key={index} jobData={item} onApply={applyForJob} />
                )) : (
                  <Card className="border-0 shadow-lg bg-white">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Search className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-600 mb-2">No jobs found</h3>
                      <p className="text-slate-500 mb-4">Try adjusting your search filters to find more opportunities</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* My Applications */}
            <TabsContent value="applications" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">My Applications</h2>
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  {myApplications.length} applications
                </Badge>
              </div>

              <div className="grid gap-6">
                {myApplications.length > 0 ? myApplications.map((item, index) => (
                  <CandidateApplicationCard key={index} applicationData={item} />
                )) : (
                  <Card className="border-0 shadow-lg bg-white">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-600 mb-2">No applications yet</h3>
                      <p className="text-slate-500 mb-4">Start applying to jobs to track your applications here</p>
                      <Button onClick={() => setActiveTab('jobs')} className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700">
                        Browse Jobs
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Interviews */}
            <TabsContent value="interviews" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">My Interviews</h2>
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                  {myInterviews.length} scheduled
                </Badge>
              </div>

              <div className="grid gap-6">
                {myInterviews.length > 0 ? myInterviews.map((item, index) => (
                  <InterviewCard key={index} interviewData={item} />
                )) : (
                  <Card className="border-0 shadow-lg bg-white">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Calendar className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-600 mb-2">No interviews scheduled</h3>
                      <p className="text-slate-500 mb-4">Interviews will appear here once companies schedule them</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Profile */}
            <TabsContent value="profile" className="space-y-6">
              <CandidateProfile user={user} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

// Candidate Job Card Component
const CandidateJobCard = ({ jobData, onApply }) => {
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const { job, company, has_applied } = jobData;

  const handleApply = () => {
    onApply(job.id, coverLetter);
    setShowApplyDialog(false);
    setCoverLetter('');
  };

  const getSalaryRange = () => {
    if (job.salary_min && job.salary_max) {
      return `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`;
    }
    return 'Salary not specified';
  };

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-xl font-semibold text-slate-800 group-hover:text-teal-700 transition-colors">{job.title}</h3>
              {company && (
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                  {company.name}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-slate-600 mb-3">
              <div className="flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign className="w-4 h-4" />
                <span>{getSalaryRange()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Briefcase className="w-4 h-4" />
                <span>{job.job_type}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4" />
                <span>{job.experience_level}</span>
              </div>
            </div>
          </div>

          {has_applied ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Applied
            </Badge>
          ) : (
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              Open
            </Badge>
          )}
        </div>

        <p className="text-slate-600 mb-4 line-clamp-3">{job.description}</p>

        <div className="mb-4">
          <h4 className="font-medium text-slate-800 mb-2">Required Skills:</h4>
          <div className="flex flex-wrap gap-2">
            {job.skills?.map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        {!has_applied && (
          <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 text-white w-full">
                <Send className="w-4 h-4 mr-2" />
                Apply Now
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply for {job.title}</DialogTitle>
                <DialogDescription>
                  Submit your application to {company?.name || 'this company'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cover-letter">Cover Letter</Label>
                  <Textarea
                    id="cover-letter"
                    placeholder="Write a compelling cover letter for this position..."
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={6}
                    className="mt-1"
                  />
                </div>
                <div className="flex space-x-3">
                  <Button onClick={handleApply} className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 flex-1">
                    Submit Application
                  </Button>
                  <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

// Candidate Application Card Component
const CandidateApplicationCard = ({ applicationData }) => {
  const { application, job, company } = applicationData;

  const getStageColor = (stage) => {
    switch (stage) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'screening': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'phone_screen': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'technical_interview': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'final_interview': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'offer': return 'bg-green-100 text-green-800 border-green-200';
      case 'hired': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStage = (stage) => {
    return stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!job || !company) return null;

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800 group-hover:text-purple-700 transition-colors mb-1">
              {job.title}
            </h3>
            <p className="text-slate-600 mb-2">{company.name}</p>
            <p className="text-sm text-slate-500">
              Applied on {new Date(application.applied_date).toLocaleDateString()}
            </p>
          </div>
          
          <Badge className={`${getStageColor(application.stage)} border font-medium`}>
            {formatStage(application.stage)}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm text-slate-600">
          <div className="flex items-center space-x-1">
            <MapPin className="w-4 h-4" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Briefcase className="w-4 h-4" />
            <span>{job.job_type}</span>
          </div>
        </div>

        <div className="mb-4">
          <Label className="text-sm font-medium text-slate-700">Cover Letter:</Label>
          <p className="text-slate-600 text-sm mt-1 bg-slate-50 p-3 rounded-lg">
            {application.cover_letter}
          </p>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-50">
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </Button>
          {application.stage === 'offer' && (
            <Button size="sm" className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white">
              <CheckCircle className="w-4 h-4 mr-2" />
              Accept Offer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Interview Card Component
const InterviewCard = ({ interviewData }) => {
  const { interview, application, job, company } = interviewData;

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'no_show': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getInterviewTypeIcon = (type) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'phone': return <Phone className="w-4 h-4" />;
      case 'onsite': return <Building2 className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  if (!job || !company) return null;

  const interviewDate = new Date(interview.scheduled_date);
  const isUpcoming = interviewDate > new Date();

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800 group-hover:text-orange-700 transition-colors mb-1">
              {job.title} Interview
            </h3>
            <p className="text-slate-600 mb-2">{company.name}</p>
            <div className="flex items-center space-x-4 text-sm text-slate-500">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{interviewDate.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{interviewDate.toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                {getInterviewTypeIcon(interview.interview_type)}
                <span className="capitalize">{interview.interview_type}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>{interview.duration_minutes} minutes</span>
              </div>
            </div>
          </div>
          
          <Badge className={`${getStatusColor(interview.status)} border font-medium`}>
            {interview.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
        </div>

        {interview.meeting_link && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Label className="text-sm font-medium text-blue-800">Meeting Link:</Label>
            <a 
              href={interview.meeting_link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm block mt-1 underline"
            >
              {interview.meeting_link}
            </a>
          </div>
        )}

        <div className="flex space-x-3">
          {isUpcoming && interview.status === 'scheduled' && (
            <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white">
              <Video className="w-4 h-4 mr-2" />
              Join Interview
            </Button>
          )}
          <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-50">
            <Calendar className="w-4 h-4 mr-2" />
            Add to Calendar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Candidate Profile Component
const CandidateProfile = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(user || {});

  const handleSave = async () => {
    try {
      await axios.put(`${API}/candidates/profile`, profileData);
      alert('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      alert('Failed to update profile: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">My Profile</h2>
        <Button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 text-white"
        >
          {isEditing ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Changes
            </>
          ) : (
            <>
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </>
          )}
        </Button>
      </div>

      {/* Verification Status */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Verified className="w-5 h-5 text-teal-600" />
            <span>Verification Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Email</p>
                  <p className="text-sm text-green-600">{user?.email}</p>
                </div>
              </div>
              {user?.is_email_verified ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Button size="sm" variant="outline" className="border-green-300 text-green-700">
                  Verify
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">Phone</p>
                  <p className="text-sm text-blue-600">{user?.phone}</p>
                </div>
              </div>
              {user?.is_phone_verified ? (
                <CheckCircle className="w-5 h-5 text-blue-600" />
              ) : (
                <Button size="sm" variant="outline" className="border-blue-300 text-blue-700">
                  Verify
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Keep your profile up-to-date to attract the right opportunities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={profileData.full_name || ''}
                onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="current_title">Current Title</Label>
              <Input
                id="current_title"
                value={profileData.current_title || ''}
                onChange={(e) => setProfileData({...profileData, current_title: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="current_company">Current Company</Label>
              <Input
                id="current_company"
                value={profileData.current_company || ''}
                onChange={(e) => setProfileData({...profileData, current_company: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profileData.location || ''}
                onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="experience_years">Years of Experience</Label>
              <Input
                id="experience_years"
                type="number"
                value={profileData.experience_years || ''}
                onChange={(e) => setProfileData({...profileData, experience_years: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="expected_salary">Expected Salary</Label>
              <Input
                id="expected_salary"
                type="number"
                value={profileData.expected_salary || ''}
                onChange={(e) => setProfileData({...profileData, expected_salary: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
                placeholder="120000"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Professional Bio</Label>
            <Textarea
              id="bio"
              value={profileData.bio || ''}
              onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
              disabled={!isEditing}
              className="mt-1"
              rows={4}
              placeholder="Tell employers about your professional background and goals..."
            />
          </div>

          <div>
            <Label htmlFor="skills">Skills</Label>
            <Input
              id="skills"
              value={Array.isArray(profileData.skills) ? profileData.skills.join(', ') : ''}
              onChange={(e) => setProfileData({...profileData, skills: e.target.value.split(',').map(s => s.trim())})}
              disabled={!isEditing}
              className="mt-1"
              placeholder="React, Python, JavaScript, Node.js"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                type="url"
                value={profileData.linkedin_url || ''}
                onChange={(e) => setProfileData({...profileData, linkedin_url: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>

            <div>
              <Label htmlFor="portfolio_url">Portfolio URL</Label>
              <Input
                id="portfolio_url"
                type="url"
                value={profileData.portfolio_url || ''}
                onChange={(e) => setProfileData({...profileData, portfolio_url: e.target.value})}
                disabled={!isEditing}
                className="mt-1"
                placeholder="https://yourportfolio.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main ATS Dashboard
const ATSDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analytics, setAnalytics] = useState({});
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [applications, setApplications] = useState([]);
  const { user, company, logout } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [analyticsRes, jobsRes, candidatesRes, applicationsRes] = await Promise.all([
        axios.get(`${API}/analytics/dashboard`),
        axios.get(`${API}/jobs`),
        axios.get(`${API}/candidates`),
        axios.get(`${API}/applications`)
      ]);

      setAnalytics(analyticsRes.data);
      setJobs(jobsRes.data);
      setCandidates(candidatesRes.data);
      setApplications(applicationsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const seedData = async () => {
    try {
      await axios.post(`${API}/seed/data`);
      alert('Demo data created successfully!');
      fetchDashboardData();
    } catch (error) {
      alert('Failed to seed data: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/20">
      {/* Header */}
      <header className="bg-white border-b border-purple-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Shield className="w-8 h-8 text-purple-600" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-teal-600 to-orange-500 bg-clip-text text-transparent">SecuHire</h1>
              <p className="text-sm text-slate-600">{company?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-slate-600">Welcome back,</p>
              <p className="font-semibold text-slate-800">{recruiter?.full_name}</p>
            </div>
            <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Main Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-5 w-full max-w-2xl bg-white border border-purple-200 shadow-sm">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">Dashboard</TabsTrigger>
              <TabsTrigger value="jobs" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">Jobs</TabsTrigger>
              <TabsTrigger value="candidates" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">Candidates</TabsTrigger>
              <TabsTrigger value="pipeline" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">Pipeline</TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">Analytics</TabsTrigger>
            </TabsList>

            {/* Dashboard Overview */}
            <TabsContent value="dashboard" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Dashboard Overview</h2>
                <Button onClick={seedData} className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white shadow-lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Demo Data
                </Button>
              </div>

              {/* Stats Cards */}
              <div className="grid md:grid-cols-4 gap-6">
                <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-purple-50/50 hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Active Jobs</p>
                        <p className="text-3xl font-bold text-slate-800">{analytics.overview?.active_jobs || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Briefcase className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-teal-50/50 hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Total Candidates</p>
                        <p className="text-3xl font-bold text-slate-800">{analytics.overview?.total_candidates || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-orange-50/50 hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Applications</p>
                        <p className="text-3xl font-bold text-slate-800">{analytics.overview?.total_applications || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-green-50/50 hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Recent Hires</p>
                        <p className="text-3xl font-bold text-slate-800">{analytics.recent_activity?.hires_30_days || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                        <Award className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pipeline Overview */}
              {analytics.pipeline && (
                <Card className="border-0 shadow-lg bg-white">
                  <CardHeader>
                    <CardTitle className="text-slate-800">Hiring Pipeline Overview</CardTitle>
                    <CardDescription>Applications by stage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      {Object.entries(analytics.pipeline).map(([stage, count]) => (
                        <div key={stage} className="text-center p-4 bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-xl border border-purple-100">
                          <div className="text-2xl font-bold text-slate-800">{count}</div>
                          <div className="text-sm text-slate-600 capitalize font-medium">{stage.replace('_', ' ')}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Jobs Management */}
            <TabsContent value="jobs" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Jobs Management</h2>
                <Button className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white shadow-lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Job
                </Button>
              </div>

              <div className="grid gap-6">
                {jobs.length > 0 ? jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                )) : (
                  <Card className="border-0 shadow-lg bg-white">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Briefcase className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-600 mb-2">No jobs yet</h3>
                      <p className="text-slate-500 mb-4">Create your first job posting to get started</p>
                      <Button className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white">Create Your First Job</Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Candidates Database */}
            <TabsContent value="candidates" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Candidate Database</h2>
                <Button className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white shadow-lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Candidate
                </Button>
              </div>

              {/* Search and Filters */}
              <div className="flex space-x-4">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <Input placeholder="Search candidates..." className="pl-10 border-purple-200 focus:border-purple-500 focus:ring-purple-500" />
                </div>
                <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>

              <div className="grid gap-6">
                {candidates.length > 0 ? candidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} />
                )) : (
                  <Card className="border-0 shadow-lg bg-white">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Users className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-600 mb-2">No candidates yet</h3>
                      <p className="text-slate-500 mb-4">Add candidates to build your talent pipeline</p>
                      <Button className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white">Add First Candidate</Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Pipeline Management */}
            <TabsContent value="pipeline" className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-800">Hiring Pipeline</h2>
              
              <div className="grid gap-6">
                {applications.length > 0 ? applications.map((item, index) => (
                  <ApplicationCard key={index} application={item.application} candidate={item.candidate} job={item.job} />
                )) : (
                  <Card className="border-0 shadow-lg bg-white">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Target className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-600 mb-2">No applications yet</h3>
                      <p className="text-slate-500 mb-4">Applications will appear here once candidates apply</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Analytics */}
            <TabsContent value="analytics" className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-800">Analytics & Reports</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-0 shadow-lg bg-white">
                  <CardHeader>
                    <CardTitle className="text-slate-800">Hiring Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Time to Hire (avg)</span>
                        <span className="font-medium text-slate-800">14 days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Applications per Job</span>
                        <span className="font-medium text-slate-800">25</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Interview to Hire Ratio</span>
                        <span className="font-medium text-slate-800">3:1</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white">
                  <CardHeader>
                    <CardTitle className="text-slate-800">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Applications (30 days)</span>
                        <span className="font-medium text-slate-800">{analytics.recent_activity?.applications_30_days || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Hires (30 days)</span>
                        <span className="font-medium text-slate-800">{analytics.recent_activity?.hires_30_days || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

// Job Card Component
const JobCard = ({ job }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'paused': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'closed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2 group-hover:text-purple-700 transition-colors">{job.title}</h3>
            <div className="flex items-center space-x-4 text-sm text-slate-600">
              <div className="flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign className="w-4 h-4" />
                <span>${job.salary_min?.toLocaleString()} - ${job.salary_max?.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{job.posted_date ? new Date(job.posted_date).toLocaleDateString() : 'Draft'}</span>
              </div>
            </div>
          </div>
          <Badge className={`${getStatusColor(job.status)} border font-medium`}>
            {job.status}
          </Badge>
        </div>

        <p className="text-slate-600 mb-4">{job.description}</p>

        <div className="mb-4">
          <h4 className="font-medium text-slate-800 mb-2">Skills Required:</h4>
          <div className="flex flex-wrap gap-2">
            {job.skills?.map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-50">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          {job.status === 'draft' && (
            <Button size="sm" className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white">
              Publish Job
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Candidate Card Component
const CandidateCard = ({ candidate }) => {
  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-800 group-hover:text-teal-700 transition-colors">{candidate.full_name}</h3>
              <p className="text-slate-600">{candidate.current_title} at {candidate.current_company}</p>
              <div className="flex items-center space-x-4 text-sm text-slate-500 mt-1">
                <div className="flex items-center space-x-1">
                  <Mail className="w-4 h-4" />
                  <span>{candidate.email}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>{candidate.location}</span>
                </div>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="bg-teal-100 text-teal-800 border-teal-200">{candidate.experience_years}+ years</Badge>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-slate-800 mb-2">Skills:</h4>
          <div className="flex flex-wrap gap-2">
            {candidate.skills?.map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" size="sm" className="border-teal-300 text-teal-700 hover:bg-teal-50">
            <FileText className="w-4 h-4 mr-2" />
            View Resume
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white">
            Add to Job
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Application Card Component
const ApplicationCard = ({ application, candidate, job }) => {
  const getStageColor = (stage) => {
    switch (stage) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'screening': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'phone_screen': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'technical_interview': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'final_interview': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'offer': return 'bg-green-100 text-green-800 border-green-200';
      case 'hired': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!candidate || !job) return null;

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 group-hover:text-orange-700 transition-colors">{candidate.full_name}</h3>
            <p className="text-slate-600">Applied for {job.title}</p>
            <p className="text-sm text-slate-500">Applied on {new Date(application.applied_date).toLocaleDateString()}</p>
          </div>
          <Badge className={`${getStageColor(application.stage)} border font-medium`}>
            {application.stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
        </div>

        <div className="flex items-center space-x-4 text-sm text-slate-600 mb-4">
          <div className="flex items-center space-x-1">
            <Mail className="w-4 h-4" />
            <span>{candidate.email}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Phone className="w-4 h-4" />
            <span>{candidate.phone}</span>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-50">
            <FileText className="w-4 h-4 mr-2" />
            View Profile
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white">
            Move Stage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Main App Component
function App() {
  const { token, loading, user, userRole } = useAuth();

  console.log('App render - Token:', token ? 'exists' : 'none', 'Loading:', loading, 'User:', user?.full_name, 'Role:', userRole);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-teal-50">
        <div className="relative">
          <Shield className="w-12 h-12 text-purple-600 animate-spin" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={token ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/auth" element={token ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
          <Route 
            path="/dashboard" 
            element={
              token ? 
                (userRole === 'recruiter' ? <ATSDashboard /> : <CandidateDashboard />) : 
                <Navigate to="/auth" replace />
            } 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithAuth;