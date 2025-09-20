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
import { 
  Building2, Users, Briefcase, TrendingUp, Plus, Search, Filter, 
  MapPin, DollarSign, Calendar, Phone, Mail, FileText, 
  ChevronRight, Star, Clock, CheckCircle, User, Edit,
  BarChart3, PieChart, Target, Award
} from "lucide-react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context for Recruiters
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [recruiter, setRecruiter] = useState(null);
  const [company, setCompany] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('recruiter_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, [token]);

  const login = (recruiterData, companyData, userToken) => {
    console.log('Login called with:', { recruiterData, companyData, userToken });
    setRecruiter(recruiterData);
    setCompany(companyData);
    setToken(userToken);
    localStorage.setItem('recruiter_token', userToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
  };

  const logout = () => {
    setRecruiter(null);
    setCompany(null);
    setToken(null);
    localStorage.removeItem('recruiter_token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ recruiter, company, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Landing Page for ATS/CRM
const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="px-6 py-4 border-b border-blue-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-800">RecruitPro ATS</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" className="text-slate-600 hover:text-blue-600">Features</Button>
            <Button variant="ghost" className="text-slate-600 hover:text-blue-600">Pricing</Button>
            <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => window.location.href = '/auth'}>Login</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.location.href = '/auth'}>Start Free Trial</Button>
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
                  Complete ATS & CRM
                  <span className="text-blue-600 block">For Modern Recruiters</span>
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed">
                  Streamline your entire hiring process with advanced applicant tracking, 
                  candidate management, and powerful analytics. From job posting to hiring.
                </p>
              </div>
              
              <div className="flex items-center space-x-6">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4" onClick={() => window.location.href = '/auth'}>
                  Start Your Free Trial
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" className="border-slate-300 text-slate-700 px-8 py-4">
                  Watch Demo
                </Button>
              </div>

              <div className="flex items-center space-x-8 pt-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-slate-600">Candidate Database</span>
                </div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-slate-600">Analytics Dashboard</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-slate-600">Pipeline Management</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?crop=entropy&cs=srgb&fm=jpg&q=85"
                alt="Team Collaboration"
                className="rounded-2xl shadow-2xl w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 bg-blue-600/10 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-slate-800 mb-4">Everything You Need to Hire Better</h3>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Complete ATS and CRM solution with advanced features for modern recruiting teams
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center pb-4">
                <Briefcase className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Job Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-center">Create, publish and manage job postings with advanced tracking</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center pb-4">
                <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Candidate Database</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-center">Searchable candidate pool with resume parsing and skill matching</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center pb-4">
                <Target className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Pipeline Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-center">Visual hiring pipeline with drag-drop stage management</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl font-bold text-slate-800 mb-6">Ready to Transform Your Hiring?</h3>
          <p className="text-xl text-slate-600 mb-8">
            Join thousands of companies using RecruitPro to streamline their hiring process.
          </p>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4" onClick={() => window.location.href = '/auth'}>
            Start Free Trial Today
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
};

// Auth Component for Recruiters
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    company_domain: '',
    company_size: '',
    industry: ''
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
        : formData;

      const response = await axios.post(`${API}${endpoint}`, payload);
      login(response.data.recruiter, response.data.company, response.data.token);
    } catch (error) {
      alert(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <Building2 className="w-10 h-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">
            {isLogin ? 'Welcome Back' : 'Create Your ATS Account'}
          </CardTitle>
          <CardDescription className="text-slate-600">
            {isLogin ? 'Sign in to your recruiting dashboard' : 'Start your free trial today'}
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
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="company_domain">Company Domain</Label>
                  <Input
                    id="company_domain"
                    value={formData.company_domain}
                    onChange={(e) => setFormData({...formData, company_domain: e.target.value})}
                    required
                    className="mt-1"
                    placeholder="company.com"
                  />
                </div>

                <div>
                  <Label htmlFor="company_size">Company Size</Label>
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
                  <Label htmlFor="industry">Industry</Label>
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
              </>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              disabled={loading}
            >
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
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
  const { recruiter, company, logout } = useAuth();

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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">RecruitPro ATS</h1>
              <p className="text-sm text-slate-600">{company?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-600">Welcome, {recruiter?.full_name}</span>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Main Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-5 w-full max-w-2xl">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="candidates">Candidates</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Dashboard Overview */}
            <TabsContent value="dashboard" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Dashboard Overview</h2>
                <Button onClick={seedData} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Demo Data
                </Button>
              </div>

              {/* Stats Cards */}
              <div className="grid md:grid-cols-4 gap-6">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Active Jobs</p>
                        <p className="text-3xl font-bold text-slate-800">{analytics.overview?.active_jobs || 0}</p>
                      </div>
                      <Briefcase className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Total Candidates</p>
                        <p className="text-3xl font-bold text-slate-800">{analytics.overview?.total_candidates || 0}</p>
                      </div>
                      <Users className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Applications</p>
                        <p className="text-3xl font-bold text-slate-800">{analytics.overview?.total_applications || 0}</p>
                      </div>
                      <FileText className="w-8 h-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Recent Hires</p>
                        <p className="text-3xl font-bold text-slate-800">{analytics.recent_activity?.hires_30_days || 0}</p>
                      </div>
                      <Award className="w-8 h-8 text-emerald-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pipeline Overview */}
              {analytics.pipeline && (
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle>Pipeline Overview</CardTitle>
                    <CardDescription>Applications by stage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      {Object.entries(analytics.pipeline).map(([stage, count]) => (
                        <div key={stage} className="text-center p-4 bg-slate-50 rounded-lg">
                          <div className="text-2xl font-bold text-slate-800">{count}</div>
                          <div className="text-sm text-slate-600 capitalize">{stage.replace('_', ' ')}</div>
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
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Job
                </Button>
              </div>

              <div className="grid gap-6">
                {jobs.length > 0 ? jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                )) : (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-12 text-center">
                      <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-slate-600 mb-2">No jobs yet</h3>
                      <p className="text-slate-500 mb-4">Create your first job posting to get started</p>
                      <Button className="bg-blue-600 hover:bg-blue-700">Create Your First Job</Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Candidates Database */}
            <TabsContent value="candidates" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-slate-800">Candidate Database</h2>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Candidate
                </Button>
              </div>

              {/* Search and Filters */}
              <div className="flex space-x-4">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                  <Input placeholder="Search candidates..." className="pl-10" />
                </div>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>

              <div className="grid gap-6">
                {candidates.length > 0 ? candidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} />
                )) : (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-12 text-center">
                      <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-slate-600 mb-2">No candidates yet</h3>
                      <p className="text-slate-500 mb-4">Add candidates to build your talent pipeline</p>
                      <Button className="bg-blue-600 hover:bg-blue-700">Add First Candidate</Button>
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
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-12 text-center">
                      <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
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
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle>Hiring Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Time to Hire (avg)</span>
                        <span className="font-medium">14 days</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Applications per Job</span>
                        <span className="font-medium">25</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Interview to Hire Ratio</span>
                        <span className="font-medium">3:1</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Applications (30 days)</span>
                        <span className="font-medium">{analytics.recent_activity?.applications_30_days || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hires (30 days)</span>
                        <span className="font-medium">{analytics.recent_activity?.hires_30_days || 0}</span>
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
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">{job.title}</h3>
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
          <Badge className={getStatusColor(job.status)}>
            {job.status}
          </Badge>
        </div>

        <p className="text-slate-600 mb-4">{job.description}</p>

        <div className="mb-4">
          <h4 className="font-medium text-slate-800 mb-2">Skills Required:</h4>
          <div className="flex flex-wrap gap-2">
            {job.skills?.map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          {job.status === 'draft' && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
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
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-800">{candidate.full_name}</h3>
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
          <Badge variant="secondary">{candidate.experience_years}+ years</Badge>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-slate-800 mb-2">Skills:</h4>
          <div className="flex flex-wrap gap-2">
            {candidate.skills?.map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            View Resume
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
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
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'screening': return 'bg-yellow-100 text-yellow-800';
      case 'phone_screen': return 'bg-purple-100 text-purple-800';
      case 'technical_interview': return 'bg-orange-100 text-orange-800';
      case 'final_interview': return 'bg-indigo-100 text-indigo-800';
      case 'offer': return 'bg-green-100 text-green-800';
      case 'hired': return 'bg-emerald-100 text-emerald-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!candidate || !job) return null;

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{candidate.full_name}</h3>
            <p className="text-slate-600">Applied for {job.title}</p>
            <p className="text-sm text-slate-500">Applied on {new Date(application.applied_date).toLocaleDateString()}</p>
          </div>
          <Badge className={getStageColor(application.stage)}>
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
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            View Profile
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            Move Stage
          </Button>
        </div>
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
        <Building2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={token ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route path="/auth" element={token ? <Navigate to="/dashboard" /> : <AuthPage />} />
          <Route path="/dashboard" element={token ? <ATSDashboard /> : <Navigate to="/auth" />} />
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