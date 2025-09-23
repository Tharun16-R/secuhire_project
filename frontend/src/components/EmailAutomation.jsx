import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, Clock, Users, BarChart3, Plus, Edit, Trash2, 
  Play, Pause, Square, Eye, CheckCircle, XCircle, AlertTriangle,
  MessageSquare, Linkedin, Smartphone, Calendar, Target, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

export const EmailAutomationSystem = () => {
  const [sequences, setSequences] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSequenceDialog, setShowSequenceDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);

  useEffect(() => {
    fetchSequences();
    fetchCampaigns();
  }, []);

  const fetchSequences = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/automation/email-sequences`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSequences(data);
      }
    } catch (error) {
      console.error('Failed to fetch sequences:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/automation/email-campaigns`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Email Automation</h2>
        <div className="flex space-x-2">
          <Dialog open={showSequenceDialog} onOpenChange={setShowSequenceDialog}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                New Sequence
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Email Sequence</DialogTitle>
              </DialogHeader>
              <SequenceBuilder onSave={(sequence) => {
                // Handle sequence save
                setShowSequenceDialog(false);
                fetchSequences();
              }} />
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Send className="w-4 h-4 mr-2" />
                Start Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Start Email Campaign</DialogTitle>
              </DialogHeader>
              <CampaignBuilder sequences={sequences} onSave={(campaign) => {
                // Handle campaign save
                setShowCampaignDialog(false);
                fetchCampaigns();
              }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="sequences" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sequences">Email Sequences</TabsTrigger>
          <TabsTrigger value="campaigns">Active Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="sequences" className="space-y-4">
          <div className="grid gap-4">
            {sequences.map((sequence) => (
              <SequenceCard key={sequence.id} sequence={sequence} onUpdate={fetchSequences} />
            ))}
            {sequences.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="w-12 h-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No email sequences yet</h3>
                  <p className="text-gray-500 text-center mb-4">
                    Create automated email sequences to nurture candidates and clients
                  </p>
                  <Button onClick={() => setShowSequenceDialog(true)}>
                    Create Your First Sequence
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} onUpdate={fetchCampaigns} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <EmailAnalytics campaigns={campaigns} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SequenceBuilder = ({ onSave }) => {
  const [sequence, setSequence] = useState({
    name: '',
    sequence_type: 'candidate_outreach',
    steps: []
  });

  const addStep = () => {
    const newStep = {
      delay_days: 1,
      subject: '',
      body: '',
      channel: 'email'
    };
    setSequence(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const updateStep = (index, field, value) => {
    setSequence(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, [field]: value } : step
      )
    }));
  };

  const removeStep = (index) => {
    setSequence(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const saveSequence = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/automation/email-sequences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sequence)
      });

      if (response.ok) {
        onSave(sequence);
      }
    } catch (error) {
      console.error('Failed to save sequence:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Sequence Name</Label>
          <Input
            value={sequence.name}
            onChange={(e) => setSequence(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Software Engineer Outreach"
          />
        </div>
        <div>
          <Label>Sequence Type</Label>
          <Select value={sequence.sequence_type} onValueChange={(value) => setSequence(prev => ({ ...prev, sequence_type: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="candidate_outreach">Candidate Outreach</SelectItem>
              <SelectItem value="client_follow_up">Client Follow-up</SelectItem>
              <SelectItem value="interview_reminder">Interview Reminders</SelectItem>
              <SelectItem value="placement_follow_up">Placement Follow-up</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Email Steps</h3>
          <Button onClick={addStep} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Step
          </Button>
        </div>

        {sequence.steps.map((step, index) => (
          <Card key={index} className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Step {index + 1}</h4>
                <Button variant="ghost" size="sm" onClick={() => removeStep(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label>Delay (days)</Label>
                  <Input
                    type="number"
                    value={step.delay_days}
                    onChange={(e) => updateStep(index, 'delay_days', parseInt(e.target.value))}
                    min="0"
                  />
                </div>
                <div>
                  <Label>Channel</Label>
                  <Select value={step.channel} onValueChange={(value) => updateStep(index, 'channel', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </div>
                      </SelectItem>
                      <SelectItem value="linkedin">
                        <div className="flex items-center">
                          <Linkedin className="w-4 h-4 mr-2" />
                          LinkedIn
                        </div>
                      </SelectItem>
                      <SelectItem value="sms">
                        <div className="flex items-center">
                          <Smartphone className="w-4 h-4 mr-2" />
                          SMS
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Subject Line</Label>
                  <Input
                    value={step.subject}
                    onChange={(e) => updateStep(index, 'subject', e.target.value)}
                    placeholder="e.g., Exciting opportunity at {company_name}"
                  />
                </div>
                <div>
                  <Label>Message Body</Label>
                  <Textarea
                    value={step.body}
                    onChange={(e) => updateStep(index, 'body', e.target.value)}
                    placeholder="Hi {candidate_name}, I hope this message finds you well..."
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use variables: {'{candidate_name}'}, {'{company_name}'}, {'{job_title}'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {sequence.steps.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <Mail className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No steps added yet. Click "Add Step" to get started.</p>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline">Cancel</Button>
        <Button onClick={saveSequence} disabled={!sequence.name || sequence.steps.length === 0}>
          Save Sequence
        </Button>
      </div>
    </div>
  );
};

const SequenceCard = ({ sequence, onUpdate }) => {
  const getSequenceTypeColor = (type) => {
    switch (type) {
      case 'candidate_outreach': return 'bg-blue-100 text-blue-800';
      case 'client_follow_up': return 'bg-green-100 text-green-800';
      case 'interview_reminder': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold">{sequence.name}</h3>
              <Badge className={getSequenceTypeColor(sequence.sequence_type)}>
                {sequence.sequence_type.replace('_', ' ')}
              </Badge>
              {sequence.is_active ? (
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {sequence.steps?.length || 0} steps
              </span>
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {sequence.execution_count || 0} executions
              </span>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className={sequence.is_active ? "text-red-600" : "text-green-600"}
            >
              {sequence.is_active ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Activate
                </>
              )}
            </Button>
          </div>
        </div>

        {sequence.steps && sequence.steps.length > 0 && (
          <div className="mt-4 flex space-x-2">
            {sequence.steps.map((step, index) => (
              <div key={index} className="flex items-center text-xs">
                <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center font-medium">
                  {index + 1}
                </div>
                {index < sequence.steps.length - 1 && (
                  <div className="w-4 h-px bg-gray-300"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CampaignBuilder = ({ sequences, onSave }) => {
  const [campaign, setCampaign] = useState({
    name: '',
    sequence_id: '',
    recipients: []
  });

  const saveCampaign = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/automation/email-campaigns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(campaign)
      });

      if (response.ok) {
        onSave(campaign);
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Campaign Name</Label>
          <Input
            value={campaign.name}
            onChange={(e) => setCampaign(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Q1 Developer Outreach"
          />
        </div>
        <div>
          <Label>Email Sequence</Label>
          <Select value={campaign.sequence_id} onValueChange={(value) => setCampaign(prev => ({ ...prev, sequence_id: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select sequence" />
            </SelectTrigger>
            <SelectContent>
              {sequences.map(seq => (
                <SelectItem key={seq.id} value={seq.id}>{seq.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline">Cancel</Button>
        <Button onClick={saveCampaign} disabled={!campaign.name || !campaign.sequence_id}>
          Start Campaign
        </Button>
      </div>
    </div>
  );
};

const CampaignCard = ({ campaign, onUpdate }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = campaign.stats || { sent: 0, opened: 0, replied: 0, clicked: 0 };
  const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : 0;
  const replyRate = stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) : 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold">{campaign.name}</h3>
              <Badge className={getStatusColor(campaign.status)}>
                {campaign.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">
              Started {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'Not started'}
            </p>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <BarChart3 className="w-4 h-4 mr-1" />
              Analytics
            </Button>
            <Button variant="outline" size="sm" className="text-red-600">
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
            <div className="text-sm text-gray-500">Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.opened}</div>
            <div className="text-sm text-gray-500">Opened ({openRate}%)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.replied}</div>
            <div className="text-sm text-gray-500">Replied ({replyRate}%)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.clicked}</div>
            <div className="text-sm text-gray-500">Clicked</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const EmailAnalytics = ({ campaigns }) => {
  const totalStats = campaigns.reduce((acc, campaign) => {
    const stats = campaign.stats || { sent: 0, opened: 0, replied: 0, clicked: 0 };
    return {
      sent: acc.sent + stats.sent,
      opened: acc.opened + stats.opened,
      replied: acc.replied + stats.replied,
      clicked: acc.clicked + stats.clicked
    };
  }, { sent: 0, opened: 0, replied: 0, clicked: 0 });

  const avgOpenRate = totalStats.sent > 0 ? ((totalStats.opened / totalStats.sent) * 100).toFixed(1) : 0;
  const avgReplyRate = totalStats.sent > 0 ? ((totalStats.replied / totalStats.sent) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{totalStats.sent}</div>
            <div className="text-sm text-gray-500">Total Emails Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{avgOpenRate}%</div>
            <div className="text-sm text-gray-500">Average Open Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{avgReplyRate}%</div>
            <div className="text-sm text-gray-500">Average Reply Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">{campaigns.length}</div>
            <div className="text-sm text-gray-500">Active Campaigns</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const stats = campaign.stats || { sent: 0, opened: 0, replied: 0 };
              const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : 0;
              const replyRate = stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) : 0;
              
              return (
                <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{campaign.name}</h4>
                    <p className="text-sm text-gray-500">{stats.sent} emails sent</p>
                  </div>
                  <div className="flex space-x-6 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-green-600">{openRate}%</div>
                      <div className="text-gray-500">Open Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-purple-600">{replyRate}%</div>
                      <div className="text-gray-500">Reply Rate</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailAutomationSystem;