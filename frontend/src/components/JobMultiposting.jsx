import React, { useState, useEffect } from 'react';
import { 
  Globe, Share2, DollarSign, TrendingUp, Eye, CheckCircle, 
  XCircle, Clock, AlertTriangle, ExternalLink, Settings,
  BarChart3, Users, Calendar, Filter, Search, Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export const JobMultipostingSystem = () => {
  const [jobBoards, setJobBoards] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [postings, setPostings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showMultipostDialog, setShowMultipostDialog] = useState(false);

  useEffect(() => {
    fetchJobBoards();
    fetchJobs();
    fetchPostings();
  }, []);

  const fetchJobBoards = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/job-boards`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setJobBoards(data);
      }
    } catch (error) {
      console.error('Failed to fetch job boards:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/jobs`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const fetchPostings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/job-postings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPostings(data);
      }
    } catch (error) {
      console.error('Failed to fetch postings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Job Multiposting</h2>
          <p className="text-gray-600">Post jobs to 5000+ job boards simultaneously</p>
        </div>
        <Button 
          onClick={() => setShowMultipostDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Multipost Job
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="job-boards">Job Boards</TabsTrigger>
          <TabsTrigger value="postings">Active Postings</TabsTrigger>
          <TabsTrigger value="analytics">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <PostingOverview postings={postings} />
        </TabsContent>

        <TabsContent value="job-boards" className="space-y-4">
          <JobBoardsGrid jobBoards={jobBoards} />
        </TabsContent>

        <TabsContent value="postings" className="space-y-4">
          <ActivePostings postings={postings} onUpdate={fetchPostings} />
        </TabsContent>

        <TabsContent value="analytics">
          <PostingAnalytics postings={postings} />
        </TabsContent>
      </Tabs>

      <Dialog open={showMultipostDialog} onOpenChange={setShowMultipostDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Multipost Job to Job Boards</DialogTitle>
          </DialogHeader>
          <MultipostDialog 
            jobs={jobs} 
            jobBoards={jobBoards} 
            onPost={(results) => {
              setShowMultipostDialog(false);
              fetchPostings();
            }} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PostingOverview = ({ postings }) => {
  const totalPostings = postings.length;
  const activePostings = postings.filter(p => p.status === 'posted').length;
  const expiredPostings = postings.filter(p => p.status === 'expired').length;
  const totalApplications = postings.reduce((sum, p) => sum + (p.applications_received || 0), 0);
  const totalCost = postings.reduce((sum, p) => sum + (p.cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{totalPostings}</div>
            <div className="text-sm text-gray-500">Total Postings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{activePostings}</div>
            <div className="text-sm text-gray-500">Active Postings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">{expiredPostings}</div>
            <div className="text-sm text-gray-500">Expired</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{totalApplications}</div>
            <div className="text-sm text-gray-500">Applications</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">${totalCost.toFixed(2)}</div>
            <div className="text-sm text-gray-500">Total Spend</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Posting Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {postings.slice(0, 10).map((posting) => (
              <div key={posting.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    posting.status === 'posted' ? 'bg-green-500' :
                    posting.status === 'expired' ? 'bg-orange-500' : 'bg-gray-500'
                  }`}></div>
                  <div>
                    <h4 className="font-medium">{posting.job_title}</h4>
                    <p className="text-sm text-gray-500">{posting.job_board_name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-purple-600">{posting.applications_received || 0} applications</span>
                  <span className="text-gray-500">${posting.cost || 0}</span>
                  <Badge className={
                    posting.status === 'posted' ? 'bg-green-100 text-green-800' :
                    posting.status === 'expired' ? 'bg-orange-100 text-orange-800' : 
                    'bg-gray-100 text-gray-800'
                  }>
                    {posting.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const JobBoardsGrid = ({ jobBoards }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredBoards = jobBoards.filter(board => {
    const matchesSearch = board.name.toLowerCase().includes(search.toLowerCase()) ||
                         board.category.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || board.category === filter;
    return matchesSearch && matchesFilter;
  });

  const categories = [...new Set(jobBoards.map(board => board.category))];

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'tech': return '💻';
      case 'healthcare': return '🏥';
      case 'finance': return '💰';
      case 'startup': return '🚀';
      case 'professional': return '👔';
      default: return '🌐';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <Input
            placeholder="Search job boards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredBoards.map((board) => (
          <Card key={board.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{getCategoryIcon(board.category)}</span>
                  <div>
                    <h4 className="font-semibold text-sm">{board.name}</h4>
                    <p className="text-xs text-gray-500">{board.category}</p>
                  </div>
                </div>
                {board.is_active ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cost:</span>
                  <span className="font-medium">${board.posting_cost || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Auth Required:</span>
                  <span>{board.requires_auth ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className="mt-3 flex space-x-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Visit
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBoards.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No job boards found</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
};

const MultipostDialog = ({ jobs, jobBoards, onPost }) => {
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedBoards, setSelectedBoards] = useState([]);
  const [posting, setPosting] = useState(false);
  const [postingResults, setPostingResults] = useState([]);

  const toggleBoard = (boardId) => {
    setSelectedBoards(prev => 
      prev.includes(boardId) 
        ? prev.filter(id => id !== boardId)
        : [...prev, boardId]
    );
  };

  const selectAllBoards = () => {
    setSelectedBoards(jobBoards.map(board => board.id));
  };

  const clearSelection = () => {
    setSelectedBoards([]);
  };

  const calculateTotalCost = () => {
    return selectedBoards.reduce((total, boardId) => {
      const board = jobBoards.find(b => b.id === boardId);
      return total + (board?.posting_cost || 0);
    }, 0);
  };

  const performMultipost = async () => {
    if (!selectedJob || selectedBoards.length === 0) return;

    setPosting(true);
    setPostingResults([]);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/jobs/${selectedJob}/multipost`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_boards: selectedBoards
        })
      });

      if (response.ok) {
        const results = await response.json();
        setPostingResults(results.results);
        
        if (onPost) {
          onPost(results);
        }
      }
    } catch (error) {
      console.error('Multiposting failed:', error);
    } finally {
      setPosting(false);
    }
  };

  if (postingResults.length > 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Posting Results</h3>
          <p className="text-gray-600">Job posted to {postingResults.filter(r => r.status === 'success').length} of {postingResults.length} job boards</p>
        </div>

        <div className="space-y-3">
          {postingResults.map((result, index) => (
            <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
              result.status === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center space-x-3">
                {result.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">{result.board}</span>
              </div>
              <div className="flex items-center space-x-2">
                {result.status === 'success' && (
                  <Badge className="bg-green-100 text-green-800">
                    ${result.cost}
                  </Badge>
                )}
                {result.status === 'error' && (
                  <span className="text-sm text-red-600">{result.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setPostingResults([])}>
            Post Another Job
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>Select Job to Post</Label>
        <Select value={selectedJob} onValueChange={setSelectedJob}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a job..." />
          </SelectTrigger>
          <SelectContent>
            {jobs.map(job => (
              <SelectItem key={job.id} value={job.id}>
                {job.title} - {job.location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Label>Select Job Boards ({selectedBoards.length} selected)</Label>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={selectAllBoards}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear All
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border rounded-lg p-4">
          {jobBoards.map(board => (
            <div key={board.id} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50">
              <Checkbox
                checked={selectedBoards.includes(board.id)}
                onCheckedChange={() => toggleBoard(board.id)}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{board.name}</span>
                  <Badge variant="outline" className="text-xs">
                    ${board.posting_cost || 0}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">{board.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedBoards.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Posting Summary</h4>
                <p className="text-sm text-gray-600">
                  {selectedBoards.length} job boards selected
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  ${calculateTotalCost().toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">Total Cost</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end space-x-2">
        <Button variant="outline">Cancel</Button>
        <Button 
          onClick={performMultipost} 
          disabled={!selectedJob || selectedBoards.length === 0 || posting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {posting ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 mr-2" />
              Post to {selectedBoards.length} Boards
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

const ActivePostings = ({ postings, onUpdate }) => {
  const [filter, setFilter] = useState('all');

  const filteredPostings = postings.filter(posting => {
    if (filter === 'all') return true;
    return posting.status === filter;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'posted': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'removed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Active Job Postings</h3>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="posted">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filteredPostings.map(posting => (
          <Card key={posting.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(posting.status)}
                  <div>
                    <h4 className="font-medium">{posting.job_title}</h4>
                    <p className="text-sm text-gray-500">{posting.job_board_name}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="font-semibold text-purple-600">{posting.applications_received || 0}</div>
                    <div className="text-xs text-gray-500">Applications</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-600">${posting.cost || 0}</div>
                    <div className="text-xs text-gray-500">Cost</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600">
                      {posting.posted_at ? new Date(posting.posted_at).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">Posted</div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPostings.length === 0 && (
        <div className="text-center py-8">
          <Share2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No postings found</h3>
          <p className="text-gray-500">No job postings match your current filter</p>
        </div>
      )}
    </div>
  );
};

const PostingAnalytics = ({ postings }) => {
  const boardPerformance = postings.reduce((acc, posting) => {
    const boardName = posting.job_board_name || 'Unknown';
    if (!acc[boardName]) {
      acc[boardName] = {
        name: boardName,
        postings: 0,
        applications: 0,
        cost: 0,
        avgCostPerApplication: 0
      };
    }
    acc[boardName].postings += 1;
    acc[boardName].applications += posting.applications_received || 0;
    acc[boardName].cost += posting.cost || 0;
    return acc;
  }, {});

  // Calculate avg cost per application
  Object.values(boardPerformance).forEach(board => {
    board.avgCostPerApplication = board.applications > 0 
      ? (board.cost / board.applications).toFixed(2)
      : 0;
  });

  const sortedBoards = Object.values(boardPerformance).sort((a, b) => b.applications - a.applications);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Job Board Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedBoards.map((board, index) => (
              <div key={board.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium">{board.name}</h4>
                    <p className="text-sm text-gray-500">{board.postings} postings</p>
                  </div>
                </div>
                
                <div className="flex space-x-8 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-purple-600">{board.applications}</div>
                    <div className="text-gray-500">Applications</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-600">${board.cost.toFixed(2)}</div>
                    <div className="text-gray-500">Total Cost</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-orange-600">${board.avgCostPerApplication}</div>
                    <div className="text-gray-500">Cost/App</div>
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
            <CardTitle>Top Performing Boards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedBoards.slice(0, 5).map((board, index) => (
                <div key={board.name} className="flex items-center justify-between">
                  <span className="font-medium">{board.name}</span>
                  <Badge className="bg-purple-100 text-purple-800">
                    {board.applications} applications
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedBoards
                .filter(board => board.applications > 0)
                .sort((a, b) => parseFloat(a.avgCostPerApplication) - parseFloat(b.avgCostPerApplication))
                .slice(0, 5)
                .map((board) => (
                  <div key={board.name} className="flex items-center justify-between">
                    <span className="font-medium">{board.name}</span>
                    <Badge className="bg-green-100 text-green-800">
                      ${board.avgCostPerApplication}/app
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

export default JobMultipostingSystem;