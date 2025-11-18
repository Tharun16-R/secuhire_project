import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, Users, DollarSign, 
  Clock, Target, Award, Calendar, Filter, Download, 
  RefreshCw, Eye, ChevronRight, AlertTriangle, CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export const AdvancedAnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [selectedRecruiter, setSelectedRecruiter] = useState('all');

  useEffect(() => {
    fetchAnalytics();
  }, [period, selectedRecruiter]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsRes, performanceRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/analytics/dashboard?period=${period}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/analytics/performance?period=${period}${selectedRecruiter !== 'all' ? `&recruiter_id=${selectedRecruiter}` : ''}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      if (analyticsRes.ok && performanceRes.ok) {
        const analyticsData = await analyticsRes.json();
        const performanceData = await performanceRes.json();
        setAnalytics(analyticsData);
        setPerformance(performanceData);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <p className="text-gray-600">Comprehensive recruitment insights and performance metrics</p>
        </div>
        <div className="flex space-x-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewMetrics analytics={analytics} period={period} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <PerformanceAnalytics performance={performance} period={period} />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <RevenueAnalytics analytics={analytics} performance={performance} />
        </TabsContent>

        <TabsContent value="sources" className="space-y-6">
          <SourceAnalytics performance={performance} />
        </TabsContent>

        <TabsContent value="forecasting" className="space-y-6">
          <ForecastingDashboard analytics={analytics} performance={performance} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const OverviewMetrics = ({ analytics, period }) => {
  if (!analytics) return null;

  const metrics = analytics.metrics || {};
  const interviews = analytics.interviews || [];
  
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Candidates"
          value={metrics.total_candidates || 0}
          icon={<Users className="w-5 h-5" />}
          color="blue"
          trend={12}
        />
        <MetricCard
          title="Active Jobs"
          value={metrics.total_jobs || 0}
          icon={<Target className="w-5 h-5" />}
          color="green"
          trend={8}
        />
        <MetricCard
          title="Applications"
          value={metrics.total_applications || 0}
          icon={<BarChart3 className="w-5 h-5" />}
          color="purple"
          trend={-3}
        />
        <MetricCard
          title="Pipeline Value"
          value={`$${(metrics.pipeline_value || 0).toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="orange"
          trend={15}
        />
      </div>

      {/* Aptitude Interview Summary */}
      {interviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Aptitude Interview Performance</span>
              <span className="text-xs text-gray-500">Last {Math.min(interviews.length, 10)} interviews</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Candidate</th>
                    <th className="py-2 pr-4">Job</th>
                    <th className="py-2 pr-4">Final Status</th>
                    <th className="py-2 pr-4">Rounds</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.slice(0, 10).map((it) => {
                    const rounds = it.rounds || [];
                    const jobIdShort = (it.job_id || '').slice(0, 8) || '-';
                    const finalStatus = it.finalStatus || '-';
                    return (
                      <tr key={it.interview_id} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 whitespace-nowrap">{it.candidate_name || it.candidate_id || '-'}</td>
                        <td className="py-1.5 pr-4 text-gray-600 whitespace-nowrap">{jobIdShort}</td>
                        <td className="py-1.5 pr-4 whitespace-nowrap">
                          <span className={finalStatus === 'Selected' ? 'text-green-700 font-semibold' : finalStatus === 'Rejected' ? 'text-red-700 font-semibold' : 'text-slate-700'}>
                            {finalStatus}
                          </span>
                        </td>
                        <td className="py-1.5 pr-4">
                          {rounds.length === 0 ? (
                            <span className="text-gray-400">No rounds</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {rounds.map((r) => (
                                <span
                                  key={r.round}
                                  className={`px-1.5 py-0.5 rounded-full border text-[10px] ${
                                    r.roundStatus === 'Passed'
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                      : r.roundStatus === 'Failed'
                                      ? 'border-red-300 bg-red-50 text-red-800'
                                      : 'border-slate-200 bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  R{r.round}: {typeof r.percentage === 'number' ? `${r.percentage.toFixed(1)}%` : '-'}
                                  {r.roundStatus ? ` · ${r.roundStatus}` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Indicators */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-700">Placement Rate</h3>
                <div className="text-3xl font-bold text-green-600">
                  {metrics.placement_rate || 0}%
                </div>
              </div>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Award className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(metrics.placement_rate || 0, 100)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {metrics.total_placements || 0} placements this {period}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-700">Interview Success</h3>
                <div className="text-3xl font-bold text-blue-600">
                  {metrics.interview_completion_rate || 0}%
                </div>
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(metrics.interview_completion_rate || 0, 100)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {metrics.completed_interviews || 0} of {metrics.total_interviews || 0} completed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-700">Active Deals</h3>
                <div className="text-3xl font-bold text-purple-600">
                  {metrics.active_deals || 0}
                </div>
              </div>
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <Target className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-500">
                Pipeline value: ${(metrics.pipeline_value || 0).toLocaleString()}
              </div>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600">+15% from last {period}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ActivityItem
              icon={<CheckCircle className="w-5 h-5 text-green-500" />}
              title="New placement completed"
              description="Senior Developer at TechCorp - $120,000"
              time="2 hours ago"
            />
            <ActivityItem
              icon={<Users className="w-5 h-5 text-blue-500" />}
              title="5 new candidates added"
              description="AI Resume Parser processed batch upload"
              time="4 hours ago"
            />
            <ActivityItem
              icon={<Target className="w-5 h-5 text-purple-500" />}
              title="Deal moved to negotiation"
              description="Frontend Engineer role - $85,000 value"
              time="6 hours ago"
            />
            <ActivityItem
              icon={<Calendar className="w-5 h-5 text-orange-500" />}
              title="3 interviews scheduled"
              description="For Software Engineer positions"
              time="1 day ago"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color, trend }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600'
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
        {trend && (
          <div className={`flex items-center mt-4 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? (
              <TrendingUp className="w-4 h-4 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 mr-1" />
            )}
            <span>{Math.abs(trend)}% from last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ActivityItem = ({ icon, title, description, time }) => (
  <div className="flex items-start space-x-3">
    <div className="flex-shrink-0 mt-1">{icon}</div>
    <div className="flex-1">
      <h4 className="font-medium text-gray-900">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <div className="text-sm text-gray-400">{time}</div>
  </div>
);

const PerformanceAnalytics = ({ performance, period }) => {
  if (!performance) return null;

  const metrics = performance.metrics || {};

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Time to Hire Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Time to Hire</span>
                <span className="font-semibold text-2xl text-blue-600">
                  {metrics.average_time_to_hire || 0} days
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Median Time to Hire</span>
                <span className="font-semibold text-xl text-gray-800">
                  {metrics.median_time_to_hire || 0} days
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full" 
                  style={{ width: `${Math.min((metrics.average_time_to_hire || 0) / 60 * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">
                Industry benchmark: 30-45 days
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interview Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.interview_stats && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {metrics.interview_stats.completion_rate || 0}%
                      </div>
                      <div className="text-sm text-gray-500">Completion Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {metrics.interview_stats.no_show_rate || 0}%
                      </div>
                      <div className="text-sm text-gray-500">No Show Rate</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Interviews</span>
                      <span>{metrics.interview_stats.total || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Completed</span>
                      <span className="text-green-600">{metrics.interview_stats.completed || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>No Shows</span>
                      <span className="text-red-600">{metrics.interview_stats.no_show || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cancelled</span>
                      <span className="text-orange-600">{metrics.interview_stats.cancelled || 0}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source Effectiveness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.source_effectiveness && Object.entries(metrics.source_effectiveness).map(([source, stats]) => (
              <div key={source} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center font-semibold text-sm">
                    {source.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-medium capitalize">{source.replace('_', ' ')}</h4>
                    <p className="text-sm text-gray-500">{stats.count} candidates</p>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="font-semibold text-green-600">{stats.hired}</div>
                    <div className="text-xs text-gray-500">Hired</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">{stats.conversion_rate}%</div>
                    <div className="text-xs text-gray-500">Conversion</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RevenueAnalytics = ({ analytics, performance }) => {
  if (!performance?.metrics?.revenue_stats) return null;

  const revenue = performance.metrics.revenue_stats;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              ${revenue.won_value?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-500">Revenue Won</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              ${revenue.pipeline_value?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-500">Pipeline Value</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {revenue.win_rate || 0}%
            </div>
            <div className="text-sm text-gray-500">Win Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              {revenue.total_deals || 0}
            </div>
            <div className="text-sm text-gray-500">Total Deals</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deal Pipeline Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">{revenue.won_deals || 0}</div>
              <div className="text-sm text-gray-500 mb-4">Won Deals</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${revenue.total_deals > 0 ? (revenue.won_deals / revenue.total_deals * 100) : 0}%` }}
                ></div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-2">{revenue.lost_deals || 0}</div>
              <div className="text-sm text-gray-500 mb-4">Lost Deals</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full" 
                  style={{ width: `${revenue.total_deals > 0 ? (revenue.lost_deals / revenue.total_deals * 100) : 0}%` }}
                ></div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {revenue.total_deals - (revenue.won_deals || 0) - (revenue.lost_deals || 0)}
              </div>
              <div className="text-sm text-gray-500 mb-4">Active Deals</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ 
                    width: `${revenue.total_deals > 0 ? ((revenue.total_deals - (revenue.won_deals || 0) - (revenue.lost_deals || 0)) / revenue.total_deals * 100) : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SourceAnalytics = ({ performance }) => {
  if (!performance?.metrics?.source_effectiveness) return null;

  const sources = Object.entries(performance.metrics.source_effectiveness)
    .sort(([,a], [,b]) => b.conversion_rate - a.conversion_rate);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Candidate Source Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sources.map(([source, stats], index) => (
              <div key={source} className="relative">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold capitalize">{source.replace('_', ' ')}</h4>
                      <p className="text-sm text-gray-500">{stats.count} candidates sourced</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <div className="font-bold text-green-600">{stats.hired}</div>
                      <div className="text-xs text-gray-500">Hired</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-blue-600">{stats.conversion_rate}%</div>
                      <div className="text-xs text-gray-500">Success Rate</div>
                    </div>
                    <div className="w-24">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full" 
                          style={{ width: `${Math.min(stats.conversion_rate, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sources.slice(0, 5).map(([source, stats]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className="font-medium capitalize">{source.replace('_', ' ')}</span>
                  <Badge className="bg-green-100 text-green-800">
                    {stats.conversion_rate}% success
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volume Leaders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sources
                .sort(([,a], [,b]) => b.count - a.count)
                .slice(0, 5)
                .map(([source, stats]) => (
                  <div key={source} className="flex items-center justify-between">
                    <span className="font-medium capitalize">{source.replace('_', ' ')}</span>
                    <Badge className="bg-blue-100 text-blue-800">
                      {stats.count} candidates
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ForecastingDashboard = ({ analytics, performance }) => {
  // Mock forecasting data - in production, this would come from ML models
  const forecast = {
    nextMonth: {
      expectedPlacements: 12,
      expectedRevenue: 85000,
      confidence: 78
    },
    nextQuarter: {
      expectedPlacements: 36,
      expectedRevenue: 245000,
      confidence: 65
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <span>Next Month Forecast</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Expected Placements</span>
                <span className="text-2xl font-bold text-green-600">
                  {forecast.nextMonth.expectedPlacements}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Expected Revenue</span>
                <span className="text-2xl font-bold text-blue-600">
                  ${forecast.nextMonth.expectedRevenue.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Confidence Level</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${forecast.nextMonth.confidence}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold">{forecast.nextMonth.confidence}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-purple-500" />
              <span>Quarterly Projection</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Expected Placements</span>
                <span className="text-2xl font-bold text-green-600">
                  {forecast.nextQuarter.expectedPlacements}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Expected Revenue</span>
                <span className="text-2xl font-bold text-blue-600">
                  ${forecast.nextQuarter.expectedRevenue.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Confidence Level</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${forecast.nextQuarter.confidence}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold">{forecast.nextQuarter.confidence}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Performance Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">On Track</h3>
              <p className="text-sm text-gray-600 mt-2">
                Meeting 85% of monthly targets
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-semibold text-lg">Needs Attention</h3>
              <p className="text-sm text-gray-600 mt-2">
                Interview no-show rate higher than expected
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg">Trending Up</h3>
              <p className="text-sm text-gray-600 mt-2">
                Candidate sourcing efficiency improving
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;