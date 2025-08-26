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
import { Shield, Users, Eye, Clock, CheckCircle, Building, MapPin, DollarSign, Calendar, Star, ArrowRight, Lock, Zap, Target } from "lucide-react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
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
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // You could validate token here
    }
    setLoading(false);
  }, [token]);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('token', userToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Landing Page Component
const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-800">SecuHire</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" className="text-slate-600 hover:text-emerald-600">About</Button>
            <Button variant="ghost" className="text-slate-600 hover:text-emerald-600">Features</Button>
            <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => window.location.href = '/auth'}>Login</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => window.location.href = '/auth'}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-5xl font-bold text-slate-800 leading-tight mb-6">
                  AI-Driven Interview
                  <span className="text-emerald-600 block">Security Platform</span>
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed">
                  Protect hiring integrity with advanced AI monitoring, real-time fraud detection, 
                  and comprehensive interview security for authentic candidate evaluation.
                </p>
              </div>
              
              <div className="flex items-center space-x-6">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4">
                  Start Secure Hiring
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" className="border-slate-300 text-slate-700 px-8 py-4">
                  Watch Demo
                </Button>
              </div>

              <div className="flex items-center space-x-8 pt-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm text-slate-600">99.9% Fraud Detection</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm text-slate-600">Enterprise Security</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm text-slate-600">Real-time Analysis</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1690673321498-4ad58d8837be?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwyfHxBSSUyMGludGVydmlld3xlbnwwfHx8fDE3NTYyMzA1OTN8MA&ixlib=rb-4.1.0&q=85"
                alt="Professional Interview Setup"
                className="rounded-2xl shadow-2xl w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 bg-emerald-600/10 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-slate-800 mb-4">Advanced Security Features</h3>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Comprehensive AI-powered monitoring and detection capabilities to ensure authentic interviews
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center pb-4">
                <Eye className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Facial Recognition</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-center">Advanced facial analysis and eye movement tracking to detect candidate authenticity</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center pb-4">
                <Users className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Voice Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-center">Multi-voice detection and behavioral pattern analysis for interview integrity</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center pb-4">
                <Target className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Screen Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-center">Real-time screen activity monitoring and unauthorized resource detection</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl font-bold text-slate-800 mb-6">Ready to Secure Your Hiring?</h3>
          <p className="text-xl text-slate-600 mb-8">
            Join leading companies using SecuHire to ensure authentic interviews and protect hiring integrity.
          </p>
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4">
            Get Started Today
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
};

// Auth Component
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    experience_years: '',
    skills: ''
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : { 
            ...formData, 
            experience_years: parseInt(formData.experience_years),
            skills: formData.skills.split(',').map(skill => skill.trim())
          };

      const response = await axios.post(`${API}${endpoint}`, payload);
      login(response.data.user, response.data.token);
    } catch (error) {
      alert(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <Shield className="w-10 h-10 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">
            {isLogin ? 'Welcome Back' : 'Join SecuHire'}
          </CardTitle>
          <CardDescription className="text-slate-600">
            {isLogin ? 'Sign in to your candidate account' : 'Create your candidate profile'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
                className="mt-1"
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  <Input
                    id="experience_years"
                    type="number"
                    value={formData.experience_years}
                    onChange={(e) => setFormData({...formData, experience_years: e.target.value})}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Input
                    id="skills"
                    value={formData.skills}
                    onChange={(e) => setFormData({...formData, skills: e.target.value})}
                    required
                    className="mt-1"
                    placeholder="React, Python, JavaScript"
                  />
                </div>
              </>
            )}

            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700" 
              disabled={loading}
            >
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState('jobs');
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, jobsRes, appsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/jobs`),
        axios.get(`${API}/applications/my`)
      ]);

      setStats(statsRes.data);
      setJobs(jobsRes.data);
      setApplications(appsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const applyForJob = async (jobId, coverLetter) => {
    try {
      await axios.post(`${API}/applications`, null, {
        params: { job_id: jobId, cover_letter: coverLetter }
      });
      alert('Application submitted successfully!');
      fetchDashboardData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Application failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-800">SecuHire</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-600">Welcome, {user?.full_name}</span>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Applications</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.total_applications || 0}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Pending Review</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.pending_applications || 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Scheduled Interviews</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.scheduled_interviews || 0}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Available Jobs</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.total_jobs || 0}</p>
                  </div>
                  <Building className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="jobs">Available Jobs</TabsTrigger>
              <TabsTrigger value="applications">My Applications</TabsTrigger>
            </TabsList>

            <TabsContent value="jobs" className="space-y-6">
              <div className="grid gap-6">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onApply={applyForJob} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="applications" className="space-y-6">
              <div className="grid gap-6">
                {applications.map((item, index) => (
                  <ApplicationCard key={index} application={item.application} job={item.job} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

// Job Card Component
const JobCard = ({ job, onApply }) => {
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  const handleApply = () => {
    onApply(job.id, coverLetter);
    setShowApplyDialog(false);
    setCoverLetter('');
  };

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">{job.title}</h3>
            <div className="flex items-center space-x-4 text-sm text-slate-600">
              <div className="flex items-center space-x-1">
                <Building className="w-4 h-4" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign className="w-4 h-4" />
                <span>{job.salary_range}</span>
              </div>
            </div>
          </div>
          <Badge variant="secondary">{job.job_type}</Badge>
        </div>

        <p className="text-slate-600 mb-4">{job.description}</p>

        <div className="mb-4">
          <h4 className="font-medium text-slate-800 mb-2">Requirements:</h4>
          <div className="flex flex-wrap gap-2">
            {job.requirements.map((req, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {req}
              </Badge>
            ))}
          </div>
        </div>

        <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">Apply Now</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for {job.title}</DialogTitle>
              <DialogDescription>
                Write a cover letter for your application to {job.company}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Write your cover letter here..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={6}
              />
              <div className="flex space-x-3">
                <Button onClick={handleApply} className="bg-emerald-600 hover:bg-emerald-700">
                  Submit Application
                </Button>
                <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

// Application Card Component
const ApplicationCard = ({ application, job }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'reviewing': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!job) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{job.title}</h3>
            <p className="text-slate-600">{job.company}</p>
          </div>
          <Badge className={getStatusColor(application.status)}>
            {application.status}
          </Badge>
        </div>

        <div className="text-sm text-slate-600 mb-4">
          Applied on: {new Date(application.applied_date).toLocaleDateString()}
        </div>

        {application.interview_date && (
          <div className="text-sm text-slate-600 mb-4">
            Interview scheduled: {new Date(application.interview_date).toLocaleString()}
          </div>
        )}

        <p className="text-slate-700">{application.cover_letter}</p>
      </CardContent>
    </Card>
  );
};

// Main App Component
function App() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Shield className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={token ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route path="/auth" element={token ? <Navigate to="/dashboard" /> : <AuthPage />} />
          <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/auth" />} />
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