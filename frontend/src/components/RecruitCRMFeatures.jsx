import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Search, Users, Mail, Calendar, BarChart3, Settings, 
  Brain, Zap, Phone, LinkedinIcon, Target, DollarSign, 
  FileText, Clock, TrendingUp, Filter, Download, Send,
  Plus, Edit, Trash2, Eye, ExternalLink, Copy, Star,
  CheckCircle, AlertTriangle, XCircle, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import FileUpload from './ui/file-upload';

// AI Resume Parser Component
export const AIResumeParser = ({ onCandidatesParsed }) => {
  const [files, setFiles] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
  };

  const parseResumes = async () => {
    if (files.length === 0) return;

    setParsing(true);
    setProgress(0);
    const parsedResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/candidates/parse-resume`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          parsedResults.push({
            filename: file.name,
            success: true,
            data: result.data,
            raw_text: result.raw_text
          });
        } else {
          parsedResults.push({
            filename: file.name,
            success: false,
            error: 'Parsing failed'
          });
        }
      } catch (error) {
        parsedResults.push({
          filename: file.name,
          success: false,
          error: error.message
        });
      }

      setProgress(((i + 1) / files.length) * 100);
    }

    setResults(parsedResults);
    setParsing(false);
    
    if (onCandidatesParsed) {
      onCandidatesParsed(parsedResults.filter(r => r.success));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <span>AI Resume Parser</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          accept={{
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
          }}
          maxFiles={10}
          multiple={true}
          title="Upload Resumes"
          description="Support for PDF, DOC, DOCX files with multi-language parsing"
        />

        {files.length > 0 && (
          <div className="flex space-x-3">
            <Button 
              onClick={parseResumes} 
              disabled={parsing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {parsing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Parsing... {Math.round(progress)}%
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Parse {files.length} Resume{files.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => { setFiles([]); setResults([]); }}>
              Clear All
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Parsing Results</h3>
            <div className="grid gap-4">
              {results.map((result, index) => (
                <Card key={index} className={`border-l-4 ${result.success ? 'border-l-green-500' : 'border-l-red-500'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{result.filename}</span>
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    
                    {result.success ? (
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="font-medium">Personal Info</Label>
                          <p>Name: {result.data.personal_info?.name || 'Not found'}</p>
                          <p>Email: {result.data.personal_info?.email || 'Not found'}</p>
                          <p>Phone: {result.data.personal_info?.phone || 'Not found'}</p>
                        </div>
                        <div>
                          <Label className="font-medium">Skills Extracted</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.data.skills?.slice(0, 5).map((skill, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="font-medium">Experience</Label>
                          <p>{result.data.experience?.length || 0} positions found</p>
                        </div>
                        <div>
                          <Label className="font-medium">Education</Label>
                          <p>{result.data.education?.length || 0} degrees found</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-red-600 text-sm">{result.error}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Advanced Candidate Search Component
export const AdvancedCandidateSearch = ({ onSearchResults }) => {
  const [searchParams, setSearchParams] = useState({
    boolean_query: '',
    required_skills: [],
    min_experience: '',
    max_experience: '',
    location: '',
    education_level: '',
    min_salary: '',
    max_salary: ''
  });
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [skillInput, setSkillInput] = useState('');

  const addSkill = () => {
    if (skillInput.trim() && !searchParams.required_skills.includes(skillInput.trim())) {
      setSearchParams(prev => ({
        ...prev,
        required_skills: [...prev.required_skills, skillInput.trim()]
      }));
      setSkillInput('');
    }
  };

  const removeSkill = (skill) => {
    setSearchParams(prev => ({
      ...prev,
      required_skills: prev.required_skills.filter(s => s !== skill)
    }));
  };

  const performAdvancedSearch = async () => {
    setSearching(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/candidates/advanced-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchParams)
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.candidates);
        if (onSearchResults) {
          onSearchResults(data.candidates);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-blue-500" />
          <span>Advanced Candidate Search</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Boolean Search */}
        <div>
          <Label className="font-medium">Boolean Query</Label>
          <Input
            placeholder="e.g., (Python OR JavaScript) AND (React OR Vue) NOT Junior"
            value={searchParams.boolean_query}
            onChange={(e) => setSearchParams(prev => ({ ...prev, boolean_query: e.target.value }))}
            className="mt-1"
          />
          <p className="text-sm text-gray-500 mt-1">
            Use AND, OR, NOT operators for complex searches
          </p>
        </div>

        {/* Skills */}
        <div>
          <Label className="font-medium">Required Skills</Label>
          <div className="flex space-x-2 mt-1">
            <Input
              placeholder="Add skill..."
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSkill()}
            />
            <Button onClick={addSkill} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {searchParams.required_skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {searchParams.required_skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                  <span>{skill}</span>
                  <button onClick={() => removeSkill(skill)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Experience Range */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Minimum Experience (years)</Label>
            <Input
              type="number"
              placeholder="0"
              value={searchParams.min_experience}
              onChange={(e) => setSearchParams(prev => ({ ...prev, min_experience: e.target.value }))}
            />
          </div>
          <div>
            <Label>Maximum Experience (years)</Label>
            <Input
              type="number"
              placeholder="20"
              value={searchParams.max_experience}
              onChange={(e) => setSearchParams(prev => ({ ...prev, max_experience: e.target.value }))}
            />
          </div>
        </div>

        {/* Location and Education */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Location</Label>
            <Input
              placeholder="San Francisco, CA"
              value={searchParams.location}
              onChange={(e) => setSearchParams(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>
          <div>
            <Label>Education Level</Label>
            <Select value={searchParams.education_level} onValueChange={(value) => setSearchParams(prev => ({ ...prev, education_level: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="bachelor">Bachelor's Degree</SelectItem>
                <SelectItem value="master">Master's Degree</SelectItem>
                <SelectItem value="phd">PhD</SelectItem>
                <SelectItem value="associate">Associate Degree</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Salary Range */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Minimum Salary ($)</Label>
            <Input
              type="number"
              placeholder="50000"
              value={searchParams.min_salary}
              onChange={(e) => setSearchParams(prev => ({ ...prev, min_salary: e.target.value }))}
            />
          </div>
          <div>
            <Label>Maximum Salary ($)</Label>
            <Input
              type="number"
              placeholder="200000"
              value={searchParams.max_salary}
              onChange={(e) => setSearchParams(prev => ({ ...prev, max_salary: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex space-x-3">
          <Button onClick={performAdvancedSearch} disabled={searching} className="bg-blue-600 hover:bg-blue-700">
            {searching ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Advanced Search
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => setSearchParams({
            boolean_query: '',
            required_skills: [],
            min_experience: '',
            max_experience: '',
            location: '',
            education_level: '',
            min_salary: '',
            max_salary: ''
          })}>
            Clear Filters
          </Button>
        </div>

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Search Results ({results.length})</h3>
            <div className="grid gap-4">
              {results.map((candidate, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{candidate.full_name}</h4>
                        <p className="text-gray-600">{candidate.current_title} at {candidate.current_company}</p>
                        <p className="text-sm text-gray-500 mb-2">{candidate.location}</p>
                        
                        <div className="flex flex-wrap gap-1 mb-2">
                          {candidate.skills?.slice(0, 5).map((skill, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                        
                        <p className="text-sm text-gray-600">
                          {candidate.experience_years} years experience • {candidate.education}
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          <Mail className="w-4 h-4 mr-1" />
                          Contact
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default { AIResumeParser, AdvancedCandidateSearch };