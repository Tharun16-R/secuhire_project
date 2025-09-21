from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import hashlib
import PyPDF2
import io
import re
from enum import Enum
import random
import string
import json
import base64
import requests
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import calendar
import statistics

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
JWT_SECRET = "secuhire_secret_key_2025"

# Enums for ATS
class PipelineStage(str, Enum):
    NEW = "new"
    SCREENING = "screening"
    PHONE_SCREEN = "phone_screen"
    TECHNICAL_INTERVIEW = "technical_interview"
    FINAL_INTERVIEW = "final_interview"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"

class JobStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"

class UserRole(str, Enum):
    RECRUITER = "recruiter"
    CANDIDATE = "candidate"

# Define Models
class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    domain: str
    size: str  # "1-10", "11-50", "51-200", "200+"
    industry: str
    website: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Recruiter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    company_id: str
    role: str = "recruiter"  # recruiter, admin, manager
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CandidateUser(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    phone: str
    location: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    experience_years: int
    education: Optional[str] = None
    skills: List[str] = []
    resume_url: Optional[str] = None
    resume_text: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    bio: Optional[str] = None
    expected_salary: Optional[int] = None
    availability: str = "immediate"  # immediate, 2_weeks, 1_month, 3_months
    is_email_verified: bool = False
    is_phone_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecruiterLogin(BaseModel):
    email: EmailStr
    password: str

class RecruiterRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: str
    company_domain: str
    company_size: str
    industry: str

class CandidateLogin(BaseModel):
    email: EmailStr
    password: str

class CandidateRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    location: str
    current_title: str
    current_company: str
    experience_years: int
    education: str
    skills: List[str]
    expected_salary: Optional[int] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    bio: Optional[str] = None

class EmailVerification(BaseModel):
    user_id: str
    email: str
    verification_code: str
    expires_at: datetime
    is_verified: bool = False

class PhoneVerification(BaseModel):
    user_id: str
    phone: str
    otp_code: str
    expires_at: datetime
    is_verified: bool = False

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    company_id: str
    recruiter_id: str
    description: str
    requirements: List[str]
    location: str
    job_type: str  # Full-time, Part-time, Contract
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    skills: List[str]
    department: str
    experience_level: str  # Entry, Mid, Senior
    status: JobStatus = JobStatus.DRAFT
    posted_date: Optional[datetime] = None
    application_deadline: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CandidateApplication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    candidate_id: str
    company_id: str
    cover_letter: str
    stage: PipelineStage = PipelineStage.NEW
    score: Optional[int] = None  # 1-10 rating
    applied_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Interview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    application_id: str
    candidate_id: str
    interviewer_id: str
    job_id: str
    company_id: str
    interview_type: str = "video"  # video, phone, onsite
    scheduled_date: datetime
    duration_minutes: int = 60
    meeting_link: Optional[str] = None
    status: str = "scheduled"  # scheduled, in_progress, completed, cancelled, no_show
    feedback: Optional[str] = None
    rating: Optional[int] = None  # 1-10
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    application_id: str
    recruiter_id: str
    content: str
    type: str = "general"  # general, interview, feedback
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InterviewRecording(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    recruiter_id: str
    webcam_recording_url: Optional[str] = None
    screen_recording_url: Optional[str] = None
    audio_recording_url: Optional[str] = None
    security_log: List[Dict] = []
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    status: str = "recording"  # recording, completed, failed
    file_size_mb: Optional[float] = None

class SecurityViolation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    violation_type: str
    description: str
    severity: str  # info, warning, critical
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    screenshot_url: Optional[str] = None

# Advanced RecruitCRM Models

class Deal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    client_id: str
    recruiter_id: str
    company_id: str
    job_id: Optional[str] = None
    candidate_id: Optional[str] = None
    value: float
    currency: str = "USD"
    probability: int = 50  # 0-100%
    stage: str = "prospecting"  # prospecting, proposal, negotiation, closed_won, closed_lost
    expected_close_date: Optional[datetime] = None
    actual_close_date: Optional[datetime] = None
    commission_rate: float = 0.0
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmailSequence(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    recruiter_id: str
    company_id: str
    sequence_type: str  # candidate_outreach, client_follow_up, interview_reminder
    steps: List[Dict[str, Any]] = []  # [{delay_days: 1, subject: "", body: "", channel: "email"}]
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmailCampaign(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sequence_id: str
    recruiter_id: str
    company_id: str
    recipients: List[str] = []  # candidate_ids or contact_ids
    status: str = "draft"  # draft, active, paused, completed
    start_date: Optional[datetime] = None
    stats: Dict[str, int] = {"sent": 0, "opened": 0, "replied": 0, "clicked": 0}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkflowAutomation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    recruiter_id: str
    company_id: str
    trigger: Dict[str, Any]  # {type: "candidate_added", conditions: {...}}
    actions: List[Dict[str, Any]] = []  # [{type: "send_email", params: {...}}]
    is_active: bool = True
    execution_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CandidateHotlist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    recruiter_id: str
    company_id: str
    candidate_ids: List[str] = []
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClientPortalSubmission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    client_id: str
    recruiter_id: str
    company_id: str
    candidate_ids: List[str] = []
    message: Optional[str] = None
    feedback: List[Dict[str, Any]] = []  # [{candidate_id: "", status: "approved/rejected", notes: ""}]
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None

class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    client_id: str
    deal_id: Optional[str] = None
    recruiter_id: str
    company_id: str
    amount: float
    currency: str = "USD"
    tax_rate: float = 0.0
    status: str = "draft"  # draft, sent, paid, overdue, cancelled
    due_date: datetime
    paid_date: Optional[datetime] = None
    items: List[Dict[str, Any]] = []  # [{description: "", quantity: 1, rate: 100.0, amount: 100.0}]
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CalendarEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    recruiter_id: str
    company_id: str
    attendees: List[str] = []  # email addresses
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    event_type: str = "interview"  # interview, call, meeting
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    status: str = "scheduled"  # scheduled, completed, cancelled, no_show
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CandidateSource(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: str
    source_type: str  # linkedin, jobboard, referral, website, chrome_extension
    source_details: Dict[str, Any] = {}  # URL, referrer info, etc.
    recruiter_id: str
    company_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JobBoard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    website: str
    api_endpoint: Optional[str] = None
    requires_auth: bool = False
    posting_cost: float = 0.0
    currency: str = "USD"
    category: str = "general"  # general, tech, healthcare, finance, etc.
    is_active: bool = True

class JobPosting(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    job_board_id: str
    external_id: Optional[str] = None  # ID on the job board
    status: str = "posted"  # posted, expired, removed
    posted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    cost: float = 0.0
    applications_received: int = 0

class CandidateEnrichment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: str
    email_verified: bool = False
    phone_verified: bool = False
    social_profiles: Dict[str, str] = {}  # {linkedin: "url", github: "url"}
    employment_history: List[Dict[str, Any]] = []
    skills_verified: List[str] = []
    enrichment_source: str  # clearbit, hunter, apollo
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TeamMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # recruiter_id
    company_id: str
    role: str = "recruiter"  # admin, manager, recruiter, coordinator
    permissions: List[str] = []  # view_all_jobs, edit_candidates, manage_invoices, etc.
    team_lead_id: Optional[str] = None
    hire_date: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnalyticsMetric(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    recruiter_id: Optional[str] = None
    metric_type: str  # time_to_hire, placement_rate, revenue, candidate_source_effectiveness
    metric_value: float
    date_period: str  # daily, weekly, monthly, quarterly
    date: datetime
    metadata: Dict[str, Any] = {}

class CommunicationLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    recipient_id: str
    recipient_type: str  # candidate, client, team_member
    communication_type: str  # email, linkedin, sms, call
    subject: Optional[str] = None
    content: str
    status: str = "sent"  # sent, delivered, opened, replied
    thread_id: Optional[str] = None
    metadata: Dict[str, Any] = {}  # tracking_id, campaign_id, etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# WebSocket Connection Manager for Real-time Interview Monitoring
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.interview_sessions: Dict[str, Dict] = {}

    async def connect(self, websocket: WebSocket, interview_id: str, user_type: str):
        await websocket.accept()
        if interview_id not in self.active_connections:
            self.active_connections[interview_id] = []
        self.active_connections[interview_id].append(websocket)
        
        # Store session info
        if interview_id not in self.interview_sessions:
            self.interview_sessions[interview_id] = {
                'candidate': None,
                'recruiters': [],
                'started_at': datetime.now(timezone.utc)
            }
        
        if user_type == 'candidate':
            self.interview_sessions[interview_id]['candidate'] = websocket
        else:
            self.interview_sessions[interview_id]['recruiters'].append(websocket)

    def disconnect(self, websocket: WebSocket, interview_id: str):
        if interview_id in self.active_connections:
            self.active_connections[interview_id].remove(websocket)
            if not self.active_connections[interview_id]:
                del self.active_connections[interview_id]
                
        # Clean up session info
        if interview_id in self.interview_sessions:
            session = self.interview_sessions[interview_id]
            if session['candidate'] == websocket:
                session['candidate'] = None
            elif websocket in session['recruiters']:
                session['recruiters'].remove(websocket)

    async def send_to_recruiters(self, interview_id: str, message: dict):
        if interview_id in self.interview_sessions:
            recruiters = self.interview_sessions[interview_id]['recruiters']
            for recruiter_ws in recruiters:
                try:
                    await recruiter_ws.send_text(json.dumps(message))
                except:
                    pass  # Handle disconnected recruiters

    async def send_to_candidate(self, interview_id: str, message: dict):
        if interview_id in self.interview_sessions:
            candidate_ws = self.interview_sessions[interview_id]['candidate']
            if candidate_ws:
                try:
                    await candidate_ws.send_text(json.dumps(message))
                except:
                    pass  # Handle disconnected candidate

manager = ConnectionManager()

# AI Resume Parsing Service
class AIResumeParser:
    def __init__(self):
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
    
    async def parse_resume(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Parse resume using AI to extract structured data"""
        try:
            # Extract text from PDF or Word document
            text_content = self._extract_text(file_content, filename)
            
            # Use AI to parse the resume content
            parsed_data = await self._ai_parse_content(text_content)
            
            return {
                "success": True,
                "data": parsed_data,
                "raw_text": text_content
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "raw_text": ""
            }
    
    def _extract_text(self, file_content: bytes, filename: str) -> str:
        """Extract text from PDF or Word files"""
        try:
            if filename.lower().endswith('.pdf'):
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text
            elif filename.lower().endswith(('.doc', '.docx')):
                # For Word documents, we'd use python-docx library
                # For now, return placeholder
                return "Word document parsing not implemented yet"
            else:
                # Try to decode as text
                return file_content.decode('utf-8', errors='ignore')
        except Exception as e:
            return f"Error extracting text: {str(e)}"
    
    async def _ai_parse_content(self, text: str) -> Dict[str, Any]:
        """Use AI to parse resume content into structured data"""
        # This would integrate with Gemini API or Emergent LLM
        # For now, return a structured parsing of common resume elements
        
        parsed_data = {
            "personal_info": self._extract_personal_info(text),
            "experience": self._extract_experience(text),
            "education": self._extract_education(text),
            "skills": self._extract_skills(text),
            "languages": self._extract_languages(text),
            "certifications": self._extract_certifications(text)
        }
        
        return parsed_data
    
    def _extract_personal_info(self, text: str) -> Dict[str, str]:
        """Extract personal information using regex patterns"""
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        phone_pattern = r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        
        emails = re.findall(email_pattern, text)
        phones = re.findall(phone_pattern, text)
        
        # Extract name (first few lines typically contain name)
        lines = text.split('\n')[:5]
        name = ""
        for line in lines:
            line = line.strip()
            if len(line) > 2 and len(line) < 50 and not any(char.isdigit() for char in line):
                name = line
                break
        
        return {
            "name": name,
            "email": emails[0] if emails else "",
            "phone": phones[0] if phones else ""
        }
    
    def _extract_experience(self, text: str) -> List[Dict[str, Any]]:
        """Extract work experience"""
        # This is a simplified version - in production, use AI for better parsing
        experience = []
        
        # Look for common experience keywords
        exp_keywords = ['experience', 'employment', 'work history', 'professional experience']
        lines = text.lower().split('\n')
        
        in_experience_section = False
        for i, line in enumerate(lines):
            if any(keyword in line for keyword in exp_keywords):
                in_experience_section = True
                continue
            
            if in_experience_section and ('education' in line or 'skills' in line):
                break
            
            if in_experience_section and len(line.strip()) > 10:
                # Extract potential job titles and companies
                if any(word in line for word in ['developer', 'engineer', 'manager', 'analyst', 'coordinator']):
                    experience.append({
                        "title": line.strip(),
                        "company": "",
                        "duration": "",
                        "description": ""
                    })
        
        return experience[:5]  # Limit to 5 entries
    
    def _extract_education(self, text: str) -> List[Dict[str, Any]]:
        """Extract education information"""
        education = []
        
        # Look for degree keywords
        degree_keywords = ['bachelor', 'master', 'phd', 'degree', 'university', 'college', 'diploma']
        lines = text.lower().split('\n')
        
        for line in lines:
            if any(keyword in line for keyword in degree_keywords):
                education.append({
                    "degree": line.strip(),
                    "institution": "",
                    "year": "",
                    "gpa": ""
                })
        
        return education[:3]  # Limit to 3 entries
    
    def _extract_skills(self, text: str) -> List[str]:
        """Extract skills from resume"""
        # Common technical skills
        tech_skills = [
            'python', 'javascript', 'java', 'react', 'node.js', 'sql', 'mongodb',
            'aws', 'azure', 'docker', 'kubernetes', 'git', 'html', 'css',
            'machine learning', 'ai', 'data science', 'analytics'
        ]
        
        found_skills = []
        text_lower = text.lower()
        
        for skill in tech_skills:
            if skill in text_lower:
                found_skills.append(skill.title())
        
        return found_skills
    
    def _extract_languages(self, text: str) -> List[Dict[str, str]]:
        """Extract languages"""
        languages = ['english', 'spanish', 'french', 'german', 'chinese', 'japanese', 'portuguese']
        found_languages = []
        
        text_lower = text.lower()
        for lang in languages:
            if lang in text_lower:
                found_languages.append({
                    "language": lang.title(),
                    "proficiency": "Unknown"
                })
        
        return found_languages
    
    def _extract_certifications(self, text: str) -> List[str]:
        """Extract certifications"""
        cert_keywords = ['certified', 'certification', 'certificate', 'aws', 'google cloud', 'microsoft']
        certifications = []
        
        lines = text.split('\n')
        for line in lines:
            if any(keyword in line.lower() for keyword in cert_keywords):
                certifications.append(line.strip())
        
        return certifications[:5]

# AI Candidate Sourcing Service
class AICandidateSourcing:
    def __init__(self):
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
    
    async def find_candidates(self, job_requirements: str, search_params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Use AI to find candidates based on job requirements"""
        # This would integrate with LinkedIn API, job board APIs, etc.
        # For now, return mock data
        
        mock_candidates = [
            {
                "name": "AI Sourced Candidate 1",
                "email": "candidate1@example.com",
                "title": "Software Engineer",
                "company": "Tech Corp",
                "match_score": 95,
                "skills": ["Python", "React", "AWS"],
                "experience_years": 5,
                "location": "San Francisco, CA",
                "source": "AI Sourcing"
            },
            {
                "name": "AI Sourced Candidate 2", 
                "email": "candidate2@example.com",
                "title": "Senior Developer",
                "company": "Innovation Inc",
                "match_score": 88,
                "skills": ["JavaScript", "Node.js", "MongoDB"],
                "experience_years": 7,
                "location": "New York, NY",
                "source": "AI Sourcing"
            }
        ]
        
        return mock_candidates

# Email Automation Service
class EmailAutomationService:
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_username = os.getenv('SMTP_USERNAME', '')
        self.smtp_password = os.getenv('SMTP_PASSWORD', '')
    
    async def send_sequence_email(self, recipient_email: str, subject: str, body: str, sender_email: str):
        """Send automated sequence email"""
        try:
            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = recipient_email
            msg['Subject'] = subject
            
            msg.attach(MIMEText(body, 'html'))
            
            # In production, use proper SMTP configuration
            # For now, just log the email
            print(f"Sending email to {recipient_email}: {subject}")
            
            return {"success": True, "message": "Email sent successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def create_email_sequence(self, sequence_data: Dict[str, Any]) -> str:
        """Create a new email sequence"""
        sequence = EmailSequence(**sequence_data)
        await db.email_sequences.insert_one(sequence.dict())
        return sequence.id
    
    async def start_campaign(self, campaign_data: Dict[str, Any]) -> str:
        """Start an email campaign"""
        campaign = EmailCampaign(**campaign_data)
        await db.email_campaigns.insert_one(campaign.dict())
        
        # Schedule emails to be sent
        await self._schedule_campaign_emails(campaign)
        
        return campaign.id
    
    async def _schedule_campaign_emails(self, campaign: EmailCampaign):
        """Schedule campaign emails to be sent"""
        # This would integrate with a task queue like Celery
        # For now, just update the campaign status
        await db.email_campaigns.update_one(
            {"id": campaign.id},
            {"$set": {"status": "active", "start_date": datetime.now(timezone.utc)}}
        )

# Job Board Integration Service
class JobBoardService:
    def __init__(self):
        self.supported_boards = [
            {"name": "Indeed", "api_endpoint": "https://api.indeed.com", "requires_auth": True},
            {"name": "LinkedIn", "api_endpoint": "https://api.linkedin.com", "requires_auth": True},
            {"name": "Glassdoor", "api_endpoint": "https://api.glassdoor.com", "requires_auth": True},
            {"name": "Monster", "api_endpoint": "https://api.monster.com", "requires_auth": True},
            {"name": "CareerBuilder", "api_endpoint": "https://api.careerbuilder.com", "requires_auth": True}
        ]
    
    async def multipost_job(self, job_data: Dict[str, Any], selected_boards: List[str]) -> Dict[str, Any]:
        """Post job to multiple job boards"""
        results = []
        
        for board_name in selected_boards:
            try:
                # In production, integrate with actual job board APIs
                result = await self._post_to_board(job_data, board_name)
                results.append({
                    "board": board_name,
                    "status": "success",
                    "external_id": f"{board_name.lower()}_{uuid.uuid4()}",
                    "cost": 50.0  # Mock cost
                })
            except Exception as e:
                results.append({
                    "board": board_name,
                    "status": "error",
                    "error": str(e)
                })
        
        return {"results": results, "total_posted": len([r for r in results if r["status"] == "success"])}
    
    async def _post_to_board(self, job_data: Dict[str, Any], board_name: str):
        """Post to individual job board"""
        # Mock implementation - in production, use actual APIs
        await asyncio.sleep(0.1)  # Simulate API call
        return {"success": True, "external_id": f"{board_name}_{uuid.uuid4()}"}

# Initialize services
resume_parser = AIResumeParser()
candidate_sourcing = AICandidateSourcing()
email_service = EmailAutomationService()
job_board_service = JobBoardService()

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_verification_code() -> str:
    return ''.join(random.choices(string.digits, k=6))

def generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))

def create_jwt_token(user_id: str, email: str, role: str, company_id: str = None) -> str:
    payload = {
        "user_id": user_id, 
        "email": email, 
        "role": role,
        "company_id": company_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_recruiter(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "recruiter":
            raise HTTPException(status_code=403, detail="Access denied")
        recruiter = await db.recruiters.find_one({"id": payload["user_id"]})
        if recruiter:
            return Recruiter(**recruiter)
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_candidate(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "candidate":
            raise HTTPException(status_code=403, detail="Access denied")
        candidate = await db.candidates.find_one({"id": payload["user_id"]})
        if candidate:
            return CandidateUser(**candidate)
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text content from PDF resume"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        logging.error(f"PDF parsing error: {e}")
        return ""

def parse_resume_skills(resume_text: str) -> List[str]:
    """Extract skills from resume text using simple keyword matching"""
    common_skills = [
        "Python", "JavaScript", "Java", "React", "Node.js", "SQL", "MongoDB", 
        "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Machine Learning", 
        "Data Science", "HTML", "CSS", "TypeScript", "Angular", "Vue.js",
        "FastAPI", "Django", "Flask", "PostgreSQL", "Redis", "Git", "Linux",
        "Project Management", "Agile", "Scrum", "Leadership", "Communication"
    ]
    
    found_skills = []
    resume_lower = resume_text.lower()
    
    for skill in common_skills:
        if skill.lower() in resume_lower:
            found_skills.append(skill)
    
    return found_skills

# Recruiter Authentication Routes
@api_router.post("/recruiters/auth/register")
async def register_recruiter(recruiter_data: RecruiterRegister):
    # Check if recruiter exists
    existing_recruiter = await db.recruiters.find_one({"email": recruiter_data.email})
    if existing_recruiter:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create company
    company = Company(
        name=recruiter_data.company_name,
        domain=recruiter_data.company_domain,
        size=recruiter_data.company_size,
        industry=recruiter_data.industry
    )
    await db.companies.insert_one(company.dict())
    
    # Create recruiter
    recruiter_dict = recruiter_data.dict()
    hashed_password = hash_password(recruiter_dict.pop("password"))
    
    # Remove company fields from recruiter data
    for field in ["company_name", "company_domain", "company_size", "industry"]:
        recruiter_dict.pop(field, None)
    
    recruiter = Recruiter(company_id=company.id, **recruiter_dict)
    
    # Store recruiter and password
    await db.recruiters.insert_one(recruiter.dict())
    await db.user_passwords.insert_one({"user_id": recruiter.id, "password": hashed_password, "role": "recruiter"})
    
    token = create_jwt_token(recruiter.id, recruiter.email, "recruiter", company.id)
    return {"user": recruiter, "company": company, "token": token, "role": "recruiter", "message": "Registration successful"}

@api_router.post("/recruiters/auth/login")
async def login_recruiter(login_data: RecruiterLogin):
    # Find recruiter
    recruiter = await db.recruiters.find_one({"email": login_data.email})
    if not recruiter:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    user_password = await db.user_passwords.find_one({"user_id": recruiter["id"], "role": "recruiter"})
    if not user_password or not verify_password(login_data.password, user_password["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get company info
    company = await db.companies.find_one({"id": recruiter["company_id"]})
    
    token = create_jwt_token(recruiter["id"], recruiter["email"], "recruiter", recruiter["company_id"])
    return {
        "user": Recruiter(**recruiter), 
        "company": Company(**company) if company else None,
        "token": token, 
        "role": "recruiter",
        "message": "Login successful"
    }

# Candidate Authentication Routes
@api_router.post("/candidates/auth/register")
async def register_candidate(candidate_data: CandidateRegister):
    # Check if candidate exists
    existing_candidate = await db.candidates.find_one({"email": candidate_data.email})
    if existing_candidate:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create candidate
    candidate_dict = candidate_data.dict()
    hashed_password = hash_password(candidate_dict.pop("password"))
    
    candidate = CandidateUser(**candidate_dict)
    
    # Store candidate and password
    await db.candidates.insert_one(candidate.dict())
    await db.user_passwords.insert_one({"user_id": candidate.id, "password": hashed_password, "role": "candidate"})
    
    # Generate email verification
    email_code = generate_verification_code()
    email_verification = EmailVerification(
        user_id=candidate.id,
        email=candidate.email,
        verification_code=email_code,
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=24)
    )
    await db.email_verifications.insert_one(email_verification.dict())
    
    # Generate phone verification
    phone_otp = generate_otp()
    phone_verification = PhoneVerification(
        user_id=candidate.id,
        phone=candidate.phone,
        otp_code=phone_otp,
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=10)
    )
    await db.phone_verifications.insert_one(phone_verification.dict())
    
    # In production, send actual email and SMS
    # For demo, return verification codes
    token = create_jwt_token(candidate.id, candidate.email, "candidate")
    return {
        "user": candidate, 
        "token": token, 
        "role": "candidate",
        "message": "Registration successful",
        "email_verification_code": email_code,  # Remove in production
        "phone_otp": phone_otp,  # Remove in production
        "verification_required": True
    }

@api_router.post("/candidates/auth/login")
async def login_candidate(login_data: CandidateLogin):
    # Find candidate
    candidate = await db.candidates.find_one({"email": login_data.email})
    if not candidate:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    user_password = await db.user_passwords.find_one({"user_id": candidate["id"], "role": "candidate"})
    if not user_password or not verify_password(login_data.password, user_password["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(candidate["id"], candidate["email"], "candidate")
    return {
        "user": CandidateUser(**candidate), 
        "token": token, 
        "role": "candidate",
        "message": "Login successful"
    }

# Verification Routes
@api_router.post("/candidates/verify-email")
async def verify_email(user_id: str, verification_code: str):
    verification = await db.email_verifications.find_one({
        "user_id": user_id, 
        "verification_code": verification_code,
        "is_verified": False
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Handle timezone comparison properly
    expires_at = verification["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Verification code expired")
    
    # Mark as verified
    await db.email_verifications.update_one(
        {"user_id": user_id, "verification_code": verification_code},
        {"$set": {"is_verified": True}}
    )
    await db.candidates.update_one(
        {"id": user_id},
        {"$set": {"is_email_verified": True}}
    )
    
    return {"message": "Email verified successfully"}

@api_router.post("/candidates/verify-phone")
async def verify_phone(user_id: str, otp_code: str):
    verification = await db.phone_verifications.find_one({
        "user_id": user_id, 
        "otp_code": otp_code,
        "is_verified": False
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    # Handle timezone comparison properly
    expires_at = verification["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP code expired")
    
    # Mark as verified
    await db.phone_verifications.update_one(
        {"user_id": user_id, "otp_code": otp_code},
        {"$set": {"is_verified": True}}
    )
    await db.candidates.update_one(
        {"id": user_id},
        {"$set": {"is_phone_verified": True}}
    )
    
    return {"message": "Phone verified successfully"}

@api_router.post("/candidates/resend-email-verification")
async def resend_email_verification(user_id: str):
    candidate = await db.candidates.find_one({"id": user_id})
    if not candidate:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new verification code
    email_code = generate_verification_code()
    email_verification = EmailVerification(
        user_id=user_id,
        email=candidate["email"],
        verification_code=email_code,
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=24)
    )
    
    # Remove old verifications
    await db.email_verifications.delete_many({"user_id": user_id, "is_verified": False})
    await db.email_verifications.insert_one(email_verification.dict())
    
    return {"message": "Verification email sent", "verification_code": email_code}  # Remove code in production

@api_router.post("/candidates/resend-phone-otp")
async def resend_phone_otp(user_id: str):
    candidate = await db.candidates.find_one({"id": user_id})
    if not candidate:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new OTP
    phone_otp = generate_otp()
    phone_verification = PhoneVerification(
        user_id=user_id,
        phone=candidate["phone"],
        otp_code=phone_otp,
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=10)
    )
    
    # Remove old verifications
    await db.phone_verifications.delete_many({"user_id": user_id, "is_verified": False})
    await db.phone_verifications.insert_one(phone_verification.dict())
    
    return {"message": "OTP sent", "otp_code": phone_otp}  # Remove OTP in production

# Candidate Job Routes
@api_router.get("/candidates/jobs")
async def get_available_jobs(
    search: Optional[str] = None,
    location: Optional[str] = None,
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    query = {"status": "active"}
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"skills": {"$in": [re.compile(search, re.IGNORECASE)]}}
        ]
    
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    
    if job_type:
        query["job_type"] = job_type
        
    if experience_level:
        query["experience_level"] = experience_level
    
    jobs = await db.jobs.find(query).to_list(1000)
    
    # Enrich with company data
    enriched_jobs = []
    for job in jobs:
        company = await db.companies.find_one({"id": job["company_id"]})
        
        # Check if candidate already applied
        existing_application = await db.candidate_applications.find_one({
            "job_id": job["id"],
            "candidate_id": current_candidate.id
        })
        
        enriched_jobs.append({
            "job": Job(**job),
            "company": Company(**company) if company else None,
            "has_applied": bool(existing_application),
            "application_id": existing_application["id"] if existing_application else None
        })
    
    return enriched_jobs

@api_router.post("/candidates/applications")
async def apply_for_job(
    application_data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    job_id = application_data.get("job_id")
    cover_letter = application_data.get("cover_letter")
    
    if not job_id or not cover_letter:
        raise HTTPException(status_code=422, detail="job_id and cover_letter are required")
    
    # Check if job exists and is active
    job = await db.jobs.find_one({"id": job_id, "status": "active"})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not available")
    
    # Check if already applied
    existing_application = await db.candidate_applications.find_one({
        "job_id": job_id,
        "candidate_id": current_candidate.id
    })
    if existing_application:
        raise HTTPException(status_code=400, detail="Already applied for this job")
    
    # Create application
    application = CandidateApplication(
        job_id=job_id,
        candidate_id=current_candidate.id,
        company_id=job["company_id"],
        cover_letter=cover_letter
    )
    
    await db.candidate_applications.insert_one(application.dict())
    return {"message": "Application submitted successfully", "application": application}

@api_router.get("/candidates/my-applications")
async def get_my_applications(current_candidate: CandidateUser = Depends(get_current_candidate)):
    applications = await db.candidate_applications.find({"candidate_id": current_candidate.id}).to_list(1000)
    
    # Enrich with job and company data
    enriched_applications = []
    for app in applications:
        job = await db.jobs.find_one({"id": app["job_id"]})
        company = await db.companies.find_one({"id": app["company_id"]}) if job else None
        
        # Get interviews for this application
        interviews = await db.interviews.find({"application_id": app["id"]}).to_list(100)
        
        enriched_applications.append({
            "application": CandidateApplication(**app),
            "job": Job(**job) if job else None,
            "company": Company(**company) if company else None,
            "interviews": [Interview(**interview) for interview in interviews]
        })
    
    return enriched_applications

@api_router.get("/candidates/interviews")
async def get_my_interviews(current_candidate: CandidateUser = Depends(get_current_candidate)):
    interviews = await db.interviews.find({"candidate_id": current_candidate.id}).to_list(1000)
    
    enriched_interviews = []
    for interview in interviews:
        application = await db.candidate_applications.find_one({"id": interview["application_id"]})
        job = await db.jobs.find_one({"id": interview["job_id"]}) if application else None
        company = await db.companies.find_one({"id": interview["company_id"]}) if job else None
        
        enriched_interviews.append({
            "interview": Interview(**interview),
            "application": CandidateApplication(**application) if application else None,
            "job": Job(**job) if job else None,
            "company": Company(**company) if company else None
        })
    
    return enriched_interviews

@api_router.put("/candidates/profile")
async def update_candidate_profile(
    profile_data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    # Remove fields that shouldn't be updated directly
    protected_fields = ["id", "email", "is_email_verified", "is_phone_verified", "created_at"]
    for field in protected_fields:
        profile_data.pop(field, None)
    
    profile_data["last_updated"] = datetime.now(timezone.utc)
    
    await db.candidates.update_one(
        {"id": current_candidate.id},
        {"$set": profile_data}
    )
    
    # Get updated candidate
    updated_candidate = await db.candidates.find_one({"id": current_candidate.id})
    return {"message": "Profile updated successfully", "user": CandidateUser(**updated_candidate)}

# Job Management Routes (Recruiter)
@api_router.post("/jobs", response_model=Job)
async def create_job(job_data: Dict[str, Any], current_recruiter: Recruiter = Depends(get_current_recruiter)):
    job = Job(
        company_id=current_recruiter.company_id,
        recruiter_id=current_recruiter.id,
        **job_data
    )
    await db.jobs.insert_one(job.dict())
    return job

@api_router.get("/jobs", response_model=List[Job])
async def get_company_jobs(current_recruiter: Recruiter = Depends(get_current_recruiter)):
    jobs = await db.jobs.find({"company_id": current_recruiter.company_id}).to_list(1000)
    return [Job(**job) for job in jobs]

@api_router.put("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, job_data: Dict[str, Any], current_recruiter: Recruiter = Depends(get_current_recruiter)):
    # Verify job belongs to company
    job = await db.jobs.find_one({"id": job_id, "company_id": current_recruiter.company_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data["last_updated"] = datetime.now(timezone.utc)
    await db.jobs.update_one({"id": job_id}, {"$set": job_data})
    
    updated_job = await db.jobs.find_one({"id": job_id})
    return Job(**updated_job)

@api_router.post("/jobs/{job_id}/publish")
async def publish_job(job_id: str, current_recruiter: Recruiter = Depends(get_current_recruiter)):
    # Update job status to active and set posted date
    result = await db.jobs.update_one(
        {"id": job_id, "company_id": current_recruiter.company_id},
        {"$set": {"status": JobStatus.ACTIVE, "posted_date": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"message": "Job published successfully"}

# Application Management Routes (Recruiter)
@api_router.get("/applications")
async def get_applications(
    job_id: Optional[str] = None,
    stage: Optional[PipelineStage] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    query = {"company_id": current_recruiter.company_id}
    
    if job_id:
        query["job_id"] = job_id
    if stage:
        query["stage"] = stage
    
    applications = await db.candidate_applications.find(query).to_list(1000)
    
    # Enrich with candidate and job data
    enriched_applications = []
    for app in applications:
        candidate = await db.candidates.find_one({"id": app["candidate_id"]})
        job = await db.jobs.find_one({"id": app["job_id"]})
        
        enriched_applications.append({
            "application": CandidateApplication(**app),
            "candidate": CandidateUser(**candidate) if candidate else None,
            "job": Job(**job) if job else None
        })
    
    return enriched_applications

@api_router.put("/applications/{application_id}/stage")
async def move_application_stage(
    application_id: str,
    stage: PipelineStage,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    result = await db.candidate_applications.update_one(
        {"id": application_id, "company_id": current_recruiter.company_id},
        {"$set": {"stage": stage, "last_updated": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {"message": "Application stage updated successfully"}

# Interview Management Routes
@api_router.post("/interviews")
async def schedule_interview(
    application_id: str,
    scheduled_date: datetime,
    interview_type: str = "video",
    duration_minutes: int = 60,
    meeting_link: Optional[str] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Get application details
    application = await db.candidate_applications.find_one({
        "id": application_id,
        "company_id": current_recruiter.company_id
    })
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    interview = Interview(
        application_id=application_id,
        candidate_id=application["candidate_id"],
        interviewer_id=current_recruiter.id,
        job_id=application["job_id"],
        company_id=current_recruiter.company_id,
        interview_type=interview_type,
        scheduled_date=scheduled_date,
        duration_minutes=duration_minutes,
        meeting_link=meeting_link
    )
    
    await db.interviews.insert_one(interview.dict())
    return {"message": "Interview scheduled successfully", "interview": interview}

# Notes Management
@api_router.post("/applications/{application_id}/notes", response_model=Note)
async def add_note(
    application_id: str,
    content: str,
    note_type: str = "general",
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify application exists and belongs to company
    application = await db.candidate_applications.find_one({
        "id": application_id, 
        "company_id": current_recruiter.company_id
    })
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    note = Note(
        application_id=application_id,
        recruiter_id=current_recruiter.id,
        content=content,
        type=note_type
    )
    
    await db.notes.insert_one(note.dict())
    return note

@api_router.get("/applications/{application_id}/notes", response_model=List[Note])
async def get_application_notes(
    application_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify application exists and belongs to company
    application = await db.candidate_applications.find_one({
        "id": application_id,
        "company_id": current_recruiter.company_id
    })
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    notes = await db.notes.find({"application_id": application_id}).to_list(1000)
    return [Note(**note) for note in notes]

# Analytics Dashboard
@api_router.get("/analytics/dashboard")
async def get_analytics_dashboard(current_recruiter: Recruiter = Depends(get_current_recruiter)):
    company_id = current_recruiter.company_id
    
    # Get basic stats
    total_jobs = await db.jobs.count_documents({"company_id": company_id})
    active_jobs = await db.jobs.count_documents({"company_id": company_id, "status": "active"})
    total_candidates = await db.candidates.count_documents({})
    total_applications = await db.candidate_applications.count_documents({"company_id": company_id})
    
    # Pipeline stats
    pipeline_stages = {}
    for stage in PipelineStage:
        count = await db.candidate_applications.count_documents({
            "company_id": company_id, 
            "stage": stage.value
        })
        pipeline_stages[stage.value] = count
    
    # Recent activity (last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    recent_applications = await db.candidate_applications.count_documents({
        "company_id": company_id,
        "applied_date": {"$gte": thirty_days_ago}
    })
    
    recent_hires = await db.candidate_applications.count_documents({
        "company_id": company_id,
        "stage": "hired",
        "last_updated": {"$gte": thirty_days_ago}
    })
    
    return {
        "overview": {
            "total_jobs": total_jobs,
            "active_jobs": active_jobs,
            "total_candidates": total_candidates,
            "total_applications": total_applications
        },
        "pipeline": pipeline_stages,
        "recent_activity": {
            "applications_30_days": recent_applications,
            "hires_30_days": recent_hires
        }
    }

# Seed data for demo
@api_router.post("/seed/data")
async def seed_demo_data(current_recruiter: Recruiter = Depends(get_current_recruiter)):
    company_id = current_recruiter.company_id
    
    # Sample jobs
    sample_jobs = [
        {
            "title": "Senior Full Stack Developer",
            "description": "We're looking for a senior developer to lead our frontend initiatives.",
            "requirements": ["React", "Node.js", "5+ years experience"],
            "location": "San Francisco, CA",
            "job_type": "Full-time",
            "salary_min": 120000,
            "salary_max": 180000,
            "skills": ["React", "Node.js", "JavaScript", "MongoDB"],
            "department": "Engineering",
            "experience_level": "Senior",
            "status": "active"
        },
        {
            "title": "Product Marketing Manager", 
            "description": "Drive product marketing strategy and go-to-market execution.",
            "requirements": ["Marketing experience", "B2B SaaS", "Analytics"],
            "location": "Remote",
            "job_type": "Full-time",
            "salary_min": 90000,
            "salary_max": 130000,
            "skills": ["Marketing", "Analytics", "Strategy"],
            "department": "Marketing",
            "experience_level": "Mid",
            "status": "active"
        }
    ]
    
    # Sample candidates (for demo - in production these would be registered by candidates)
    sample_candidates = [
        {
            "email": "john.developer@email.com",
            "full_name": "John Developer",
            "phone": "+1234567890",
            "location": "San Francisco, CA",
            "current_title": "Senior Frontend Developer",
            "current_company": "TechCorp",
            "experience_years": 6,
            "education": "BS Computer Science",
            "skills": ["React", "JavaScript", "TypeScript", "Node.js"],
            "expected_salary": 150000,
            "bio": "Passionate full-stack developer with 6+ years of experience building scalable web applications.",
            "is_email_verified": True,
            "is_phone_verified": True
        },
        {
            "email": "sarah.manager@email.com",
            "full_name": "Sarah Marketing",
            "phone": "+1987654321", 
            "location": "New York, NY",
            "current_title": "Marketing Manager",
            "current_company": "GrowthCo",
            "experience_years": 4,
            "education": "MBA Marketing",
            "skills": ["Marketing", "Analytics", "Strategy", "B2B"],
            "expected_salary": 110000,
            "bio": "Results-driven marketing professional with expertise in B2B SaaS growth strategies.",
            "is_email_verified": True,
            "is_phone_verified": True
        }
    ]
    
    # Insert sample data
    for job_data in sample_jobs:
        job = Job(
            company_id=company_id,
            recruiter_id=current_recruiter.id,
            posted_date=datetime.now(timezone.utc),
            **job_data
        )
        await db.jobs.insert_one(job.dict())
    
    for candidate_data in sample_candidates:
        candidate = CandidateUser(**candidate_data)
        await db.candidates.insert_one(candidate.dict())
    
    return {"message": "Demo data seeded successfully"}

# Interview Recording and Monitoring Routes
@api_router.post("/interviews/{interview_id}/start-recording")
async def start_interview_recording(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    # Verify interview exists and belongs to candidate
    interview = await db.interviews.find_one({
        "id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Create recording record
    recording = InterviewRecording(
        interview_id=interview_id,
        candidate_id=current_candidate.id,
        recruiter_id=interview["interviewer_id"]
    )
    
    await db.interview_recordings.insert_one(recording.dict())
    
    # Update interview status
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "in_progress"}}
    )
    
    return {"message": "Recording started", "recording_id": recording.id}

@api_router.post("/interviews/{interview_id}/upload-recording")
async def upload_interview_recording(
    interview_id: str,
    recording_type: str,  # webcam, screen, audio
    file: UploadFile = File(...),
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    # Verify interview recording exists
    recording = await db.interview_recordings.find_one({
        "interview_id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not recording:
        raise HTTPException(status_code=404, detail="Interview recording not found")
    
    # Create recordings directory if it doesn't exist
    recordings_dir = ROOT_DIR / "recordings" / interview_id
    recordings_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_extension = file.filename.split('.')[-1] if file.filename else 'webm'
    filename = f"{recording_type}_{int(datetime.now().timestamp())}.{file_extension}"
    file_path = recordings_dir / filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Update recording record
    file_url = f"/recordings/{interview_id}/{filename}"
    update_data = {f"{recording_type}_recording_url": file_url}
    
    if not recording.get("file_size_mb"):
        update_data["file_size_mb"] = len(content) / (1024 * 1024)  # Convert to MB
    else:
        update_data["file_size_mb"] = recording["file_size_mb"] + len(content) / (1024 * 1024)
    
    await db.interview_recordings.update_one(
        {"interview_id": interview_id, "candidate_id": current_candidate.id},
        {"$set": update_data}
    )
    
    return {"message": f"{recording_type} recording uploaded successfully", "file_url": file_url}

@api_router.post("/interviews/{interview_id}/end-recording")
async def end_interview_recording(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    # Update recording status
    await db.interview_recordings.update_one(
        {"interview_id": interview_id, "candidate_id": current_candidate.id},
        {"$set": {
            "status": "completed",
            "ended_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update interview status
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "completed"}}
    )
    
    return {"message": "Recording ended and interview completed"}

@api_router.post("/interviews/{interview_id}/security-violation")
async def log_security_violation(
    interview_id: str,
    violation_data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    # Create security violation record
    violation = SecurityViolation(
        interview_id=interview_id,
        candidate_id=current_candidate.id,
        violation_type=violation_data.get("type", "unknown"),
        description=violation_data.get("description", ""),
        severity=violation_data.get("severity", "warning")
    )
    
    await db.security_violations.insert_one(violation.dict())
    
    # Add to interview recording security log
    await db.interview_recordings.update_one(
        {"interview_id": interview_id, "candidate_id": current_candidate.id},
        {"$push": {"security_log": violation.dict()}}
    )
    
    # Notify recruiters via WebSocket
    await manager.send_to_recruiters(interview_id, {
        "type": "security_violation",
        "violation": violation.dict()
    })
    
    return {"message": "Security violation logged"}

# Recruiter Interview Monitoring Routes
@api_router.get("/interviews/{interview_id}/monitoring")
async def get_interview_monitoring_data(
    interview_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify interview belongs to recruiter's company
    interview = await db.interviews.find_one({
        "id": interview_id,
        "company_id": current_recruiter.company_id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Get recording data
    recording = await db.interview_recordings.find_one({"interview_id": interview_id})
    
    # Get security violations
    violations = await db.security_violations.find({"interview_id": interview_id}).to_list(1000)
    
    # Get candidate info
    candidate = await db.candidates.find_one({"id": interview["candidate_id"]})
    
    return {
        "interview": Interview(**interview),
        "candidate": CandidateUser(**candidate) if candidate else None,
        "recording": InterviewRecording(**recording) if recording else None,
        "security_violations": [SecurityViolation(**v) for v in violations],
        "is_live": recording["status"] == "recording" if recording else False
    }

# WebSocket endpoint for real-time interview monitoring
@api_router.websocket("/interviews/{interview_id}/ws/{user_type}")
async def interview_websocket(websocket: WebSocket, interview_id: str, user_type: str):
    await manager.connect(websocket, interview_id, user_type)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if user_type == "candidate":
                # Forward candidate data to recruiters
                await manager.send_to_recruiters(interview_id, {
                    "type": message.get("type", "candidate_data"),
                    "data": message
                })
            elif user_type == "recruiter":
                # Forward recruiter commands to candidate
                await manager.send_to_candidate(interview_id, message)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, interview_id)

# File serving endpoint for recordings
@api_router.get("/recordings/{interview_id}/{filename}")
async def serve_recording(interview_id: str, filename: str):
    file_path = ROOT_DIR / "recordings" / interview_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Recording not found")
    
    return {"file_path": str(file_path), "message": "File exists"}  # In production, return actual file

# ==============================================
# RECRUITCRM FEATURE ENDPOINTS
# ==============================================

# AI Resume Parsing Endpoints
@api_router.post("/candidates/parse-resume")
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """AI-powered resume parsing with multi-language support"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_content = await file.read()
    parsing_result = await resume_parser.parse_resume(file_content, file.filename)
    
    if not parsing_result["success"]:
        raise HTTPException(status_code=400, detail=f"Resume parsing failed: {parsing_result['error']}")
    
    return {
        "message": "Resume parsed successfully",
        "data": parsing_result["data"],
        "raw_text": parsing_result["raw_text"][:500] + "..." if len(parsing_result["raw_text"]) > 500 else parsing_result["raw_text"]
    }

@api_router.post("/candidates/bulk-parse")
async def bulk_parse_resumes(
    files: List[UploadFile] = File(...),
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Bulk resume parsing for multiple files"""
    results = []
    
    for file in files:
        if not file.filename:
            continue
        
        file_content = await file.read()
        parsing_result = await resume_parser.parse_resume(file_content, file.filename)
        
        results.append({
            "filename": file.filename,
            "success": parsing_result["success"],
            "data": parsing_result.get("data"),
            "error": parsing_result.get("error")
        })
    
    return {
        "message": f"Processed {len(results)} resumes",
        "results": results,
        "success_count": len([r for r in results if r["success"]]),
        "error_count": len([r for r in results if not r["success"]])
    }

# Advanced Candidate Search
@api_router.post("/candidates/advanced-search")
async def advanced_candidate_search(
    search_params: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Advanced Boolean and radius-based candidate search"""
    
    # Build MongoDB query from search parameters
    query = {"company_id": current_recruiter.company_id}
    
    # Boolean search in skills, title, description
    if search_params.get("boolean_query"):
        boolean_query = search_params["boolean_query"]
        query["$or"] = [
            {"skills": {"$regex": boolean_query, "$options": "i"}},
            {"current_title": {"$regex": boolean_query, "$options": "i"}},
            {"bio": {"$regex": boolean_query, "$options": "i"}}
        ]
    
    # Skills filter
    if search_params.get("required_skills"):
        query["skills"] = {"$in": search_params["required_skills"]}
    
    # Experience range
    if search_params.get("min_experience"):
        query["experience_years"] = {"$gte": search_params["min_experience"]}
    if search_params.get("max_experience"):
        if "experience_years" in query:
            query["experience_years"]["$lte"] = search_params["max_experience"]
        else:
            query["experience_years"] = {"$lte": search_params["max_experience"]}
    
    # Location/radius search (simplified)
    if search_params.get("location"):
        query["location"] = {"$regex": search_params["location"], "$options": "i"}
    
    # Education level
    if search_params.get("education_level"):
        query["education"] = {"$regex": search_params["education_level"], "$options": "i"}
    
    # Salary range
    if search_params.get("min_salary"):
        query["expected_salary"] = {"$gte": search_params["min_salary"]}
    if search_params.get("max_salary"):
        if "expected_salary" in query:
            query["expected_salary"]["$lte"] = search_params["max_salary"]
        else:
            query["expected_salary"] = {"$lte": search_params["max_salary"]}
    
    candidates = await db.candidates.find(query).limit(100).to_list(100)
    
    return {
        "candidates": [CandidateUser(**candidate) for candidate in candidates],
        "total_found": len(candidates),
        "search_params": search_params
    }

# AI Candidate Sourcing
@api_router.post("/candidates/ai-source")
async def ai_candidate_sourcing(
    sourcing_request: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """AI-powered candidate sourcing with natural language prompts"""
    
    job_requirements = sourcing_request.get("job_requirements", "")
    search_params = sourcing_request.get("search_params", {})
    
    # Use AI to find candidates
    sourced_candidates = await candidate_sourcing.find_candidates(job_requirements, search_params)
    
    # Save sourced candidates to database
    for candidate_data in sourced_candidates:
        candidate_data.update({
            "id": str(uuid.uuid4()),
            "company_id": current_recruiter.company_id,
            "password_hash": hashlib.sha256("temp_password".encode()).hexdigest(),
            "is_verified": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Check if candidate already exists
        existing = await db.candidates.find_one({"email": candidate_data["email"]})
        if not existing:
            await db.candidates.insert_one(candidate_data)
            
            # Log the sourcing activity  
            source_log = CandidateSource(
                candidate_id=candidate_data["id"],
                source_type="ai_sourcing",
                source_details={"prompt": job_requirements, "match_score": candidate_data.get("match_score", 0)},
                recruiter_id=current_recruiter.id,
                company_id=current_recruiter.company_id
            )
            await db.candidate_sources.insert_one(source_log.dict())
    
    return {
        "message": f"Found {len(sourced_candidates)} candidates using AI",
        "candidates": sourced_candidates,
        "job_requirements": job_requirements
    }

# Email Automation Endpoints
@api_router.post("/automation/email-sequences")
async def create_email_sequence(
    sequence_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Create automated email sequence"""
    sequence_data.update({
        "recruiter_id": current_recruiter.id,
        "company_id": current_recruiter.company_id
    })
    
    sequence_id = await email_service.create_email_sequence(sequence_data)
    
    return {
        "message": "Email sequence created successfully",
        "sequence_id": sequence_id
    }

@api_router.get("/automation/email-sequences")
async def get_email_sequences(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get all email sequences for the company"""
    sequences = await db.email_sequences.find({
        "company_id": current_recruiter.company_id
    }).to_list(100)
    
    return [EmailSequence(**seq) for seq in sequences]

@api_router.post("/automation/email-campaigns")
async def start_email_campaign(
    campaign_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Start an email campaign"""
    campaign_data.update({
        "recruiter_id": current_recruiter.id,
        "company_id": current_recruiter.company_id
    })
    
    campaign_id = await email_service.start_campaign(campaign_data)
    
    return {
        "message": "Email campaign started successfully",
        "campaign_id": campaign_id
    }

@api_router.get("/automation/email-campaigns")
async def get_email_campaigns(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get all email campaigns"""
    campaigns = await db.email_campaigns.find({
        "company_id": current_recruiter.company_id
    }).to_list(100)
    
    return [EmailCampaign(**campaign) for campaign in campaigns]

# Job Multiposting Endpoints
@api_router.get("/job-boards")
async def get_job_boards():
    """Get list of available job boards"""
    job_boards = await db.job_boards.find({"is_active": True}).to_list(1000)
    
    if not job_boards:
        # Initialize with default job boards
        default_boards = [
            {"name": "Indeed", "website": "indeed.com", "category": "general", "posting_cost": 50.0},
            {"name": "LinkedIn", "website": "linkedin.com", "category": "professional", "posting_cost": 100.0},
            {"name": "Glassdoor", "website": "glassdoor.com", "category": "general", "posting_cost": 75.0},
            {"name": "Monster", "website": "monster.com", "category": "general", "posting_cost": 60.0},
            {"name": "CareerBuilder", "website": "careerbuilder.com", "category": "general", "posting_cost": 55.0},
            {"name": "Dice", "website": "dice.com", "category": "tech", "posting_cost": 80.0},
            {"name": "AngelList", "website": "angel.co", "category": "startup", "posting_cost": 40.0},
            {"name": "Stack Overflow Jobs", "website": "stackoverflow.com", "category": "tech", "posting_cost": 90.0}
        ]
        
        for board_data in default_boards:
            board = JobBoard(**board_data)
            await db.job_boards.insert_one(board.dict())
        
        job_boards = await db.job_boards.find({"is_active": True}).to_list(1000)
    
    return [JobBoard(**board) for board in job_boards]

@api_router.post("/jobs/{job_id}/multipost")
async def multipost_job(
    job_id: str,
    posting_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Post job to multiple job boards"""
    
    # Get job details
    job = await db.jobs.find_one({"id": job_id, "company_id": current_recruiter.company_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    selected_boards = posting_data.get("job_boards", [])
    
    # Post to selected job boards
    posting_results = await job_board_service.multipost_job(job, selected_boards)
    
    # Save posting records
    for result in posting_results["results"]:
        if result["status"] == "success":
            posting = JobPosting(
                job_id=job_id,
                job_board_id=result.get("board_id", result["board"]),
                external_id=result.get("external_id"),
                cost=result.get("cost", 0.0)
            )
            await db.job_postings.insert_one(posting.dict())
    
    return {
        "message": f"Job posted to {posting_results['total_posted']} job boards",
        "results": posting_results["results"],
        "total_posted": posting_results["total_posted"]
    }

# Candidate Hotlists Management
@api_router.post("/candidates/hotlists")
async def create_hotlist(
    hotlist_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Create candidate hotlist/talent pool"""
    hotlist_data.update({
        "recruiter_id": current_recruiter.id,
        "company_id": current_recruiter.company_id
    })
    
    hotlist = CandidateHotlist(**hotlist_data)
    await db.candidate_hotlists.insert_one(hotlist.dict())
    
    return {
        "message": "Hotlist created successfully",
        "hotlist": hotlist
    }

@api_router.get("/candidates/hotlists")
async def get_hotlists(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get all hotlists for the company"""
    hotlists = await db.candidate_hotlists.find({
        "company_id": current_recruiter.company_id
    }).to_list(100)
    
    return [CandidateHotlist(**hotlist) for hotlist in hotlists]

@api_router.post("/candidates/hotlists/{hotlist_id}/add-candidates")
async def add_candidates_to_hotlist(
    hotlist_id: str,
    candidate_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Add candidates to hotlist"""
    candidate_ids = candidate_data.get("candidate_ids", [])
    
    await db.candidate_hotlists.update_one(
        {"id": hotlist_id, "company_id": current_recruiter.company_id},
        {"$addToSet": {"candidate_ids": {"$each": candidate_ids}}}
    )
    
    return {
        "message": f"Added {len(candidate_ids)} candidates to hotlist"
    }

# Deal Management Endpoints
@api_router.post("/deals")
async def create_deal(
    deal_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Create new deal"""
    deal_data.update({
        "recruiter_id": current_recruiter.id,
        "company_id": current_recruiter.company_id
    })
    
    deal = Deal(**deal_data)
    await db.deals.insert_one(deal.dict())
    
    return {
        "message": "Deal created successfully",
        "deal": deal
    }

@api_router.get("/deals")
async def get_deals(
    stage: Optional[str] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get all deals with optional stage filter"""
    query = {"company_id": current_recruiter.company_id}
    if stage:
        query["stage"] = stage
    
    deals = await db.deals.find(query).to_list(100)
    
    return [Deal(**deal) for deal in deals]

@api_router.put("/deals/{deal_id}")
async def update_deal(
    deal_id: str,
    deal_updates: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Update deal"""
    deal_updates["updated_at"] = datetime.now(timezone.utc)
    
    await db.deals.update_one(
        {"id": deal_id, "company_id": current_recruiter.company_id},
        {"$set": deal_updates}
    )
    
    return {"message": "Deal updated successfully"}

# Client Portal Endpoints
@api_router.post("/client-portal/submissions")
async def create_client_submission(
    submission_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Submit candidates to client portal"""
    submission_data.update({
        "recruiter_id": current_recruiter.id,
        "company_id": current_recruiter.company_id
    })
    
    submission = ClientPortalSubmission(**submission_data)
    await db.client_submissions.insert_one(submission.dict())
    
    return {
        "message": "Candidates submitted to client portal",
        "submission": submission
    }

@api_router.get("/client-portal/submissions")
async def get_client_submissions(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get all client submissions"""
    submissions = await db.client_submissions.find({
        "company_id": current_recruiter.company_id
    }).to_list(100)
    
    return [ClientPortalSubmission(**submission) for submission in submissions]

# Invoice Management
@api_router.post("/invoices")
async def create_invoice(
    invoice_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Create invoice"""
    invoice_data.update({
        "recruiter_id": current_recruiter.id,
        "company_id": current_recruiter.company_id,
        "invoice_number": f"INV-{int(datetime.now().timestamp())}"
    })
    
    invoice = Invoice(**invoice_data)
    await db.invoices.insert_one(invoice.dict())
    
    return {
        "message": "Invoice created successfully",
        "invoice": invoice
    }

@api_router.get("/invoices")
async def get_invoices(
    status: Optional[str] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get invoices with optional status filter"""
    query = {"company_id": current_recruiter.company_id}
    if status:
        query["status"] = status
    
    invoices = await db.invoices.find(query).to_list(100)
    
    return [Invoice(**invoice) for invoice in invoices]

# Calendar Integration
@api_router.post("/calendar/events")
async def create_calendar_event(
    event_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Create calendar event"""
    event_data.update({
        "recruiter_id": current_recruiter.id,
        "company_id": current_recruiter.company_id
    })
    
    event = CalendarEvent(**event_data)
    await db.calendar_events.insert_one(event.dict())
    
    return {
        "message": "Calendar event created successfully",
        "event": event
    }

@api_router.get("/calendar/events")
async def get_calendar_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get calendar events with optional date range"""
    query = {"company_id": current_recruiter.company_id}
    
    if start_date and end_date:
        query["start_time"] = {
            "$gte": datetime.fromisoformat(start_date),
            "$lte": datetime.fromisoformat(end_date)
        }
    
    events = await db.calendar_events.find(query).to_list(100)
    
    return [CalendarEvent(**event) for event in events]

# Analytics and Reporting
@api_router.get("/analytics/dashboard")
async def get_analytics_dashboard(
    period: str = "monthly",
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get comprehensive analytics dashboard"""
    
    # Calculate date range based on period
    now = datetime.now(timezone.utc)
    if period == "weekly":
        start_date = now - timedelta(days=7)
    elif period == "monthly":
        start_date = now - timedelta(days=30)
    elif period == "quarterly":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=365)
    
    # Get various metrics
    analytics = {
        "period": period,
        "date_range": {"start": start_date, "end": now},
        "metrics": {}
    }
    
    # Total candidates
    total_candidates = await db.candidates.count_documents({
        "company_id": current_recruiter.company_id,
        "created_at": {"$gte": start_date}
    })
    analytics["metrics"]["total_candidates"] = total_candidates
    
    # Total jobs
    total_jobs = await db.jobs.count_documents({
        "company_id": current_recruiter.company_id,
        "created_at": {"$gte": start_date}
    })
    analytics["metrics"]["total_jobs"] = total_jobs
    
    # Total applications
    total_applications = await db.candidate_applications.count_documents({
        "company_id": current_recruiter.company_id,
        "created_at": {"$gte": start_date}
    })
    analytics["metrics"]["total_applications"] = total_applications
    
    # Active deals value
    deals = await db.deals.find({
        "company_id": current_recruiter.company_id,
        "stage": {"$nin": ["closed_won", "closed_lost"]}
    }).to_list(1000)
    
    total_deal_value = sum(deal.get("value", 0) for deal in deals)
    analytics["metrics"]["pipeline_value"] = total_deal_value
    analytics["metrics"]["active_deals"] = len(deals)
    
    # Interview stats
    interviews = await db.interviews.find({
        "company_id": current_recruiter.company_id,
        "scheduled_date": {"$gte": start_date}
    }).to_list(1000)
    
    analytics["metrics"]["total_interviews"] = len(interviews)
    analytics["metrics"]["completed_interviews"] = len([i for i in interviews if i.get("status") == "completed"])
    
    # Placement rate calculation
    placements = await db.candidate_applications.count_documents({
        "company_id": current_recruiter.company_id,
        "stage": "hired",
        "created_at": {"$gte": start_date}
    })
    
    placement_rate = (placements / total_applications * 100) if total_applications > 0 else 0
    analytics["metrics"]["placement_rate"] = round(placement_rate, 2)
    analytics["metrics"]["total_placements"] = placements
    
    return analytics

# Team Management
@api_router.post("/team/members")
async def add_team_member(
    member_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Add team member"""
    member_data.update({
        "company_id": current_recruiter.company_id
    })
    
    team_member = TeamMember(**member_data)
    await db.team_members.insert_one(team_member.dict())
    
    return {
        "message": "Team member added successfully",
        "member": team_member
    }

@api_router.get("/team/members")
async def get_team_members(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get all team members"""
    members = await db.team_members.find({
        "company_id": current_recruiter.company_id,
        "is_active": True
    }).to_list(100)
    
    return [TeamMember(**member) for member in members]

# Workflow Automation
@api_router.post("/automation/workflows")
async def create_workflow(
    workflow_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Create no-code workflow automation"""
    workflow_data.update({
        "recruiter_id": current_recruiter.id,
        "company_id": current_recruiter.company_id
    })
    
    workflow = WorkflowAutomation(**workflow_data)
    await db.workflow_automations.insert_one(workflow.dict())
    
    return {
        "message": "Workflow automation created successfully",
        "workflow": workflow
    }

@api_router.get("/automation/workflows")
async def get_workflows(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get all workflow automations"""
    workflows = await db.workflow_automations.find({
        "company_id": current_recruiter.company_id
    }).to_list(100)
    
    return [WorkflowAutomation(**workflow) for workflow in workflows]

# Bulk Operations
@api_router.post("/candidates/bulk-email")
async def send_bulk_email(
    email_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Send bulk personalized emails"""
    candidate_ids = email_data.get("candidate_ids", [])
    subject = email_data.get("subject", "")
    body = email_data.get("body", "")
    
    sent_count = 0
    errors = []
    
    for candidate_id in candidate_ids:
        try:
            candidate = await db.candidates.find_one({"id": candidate_id})
            if candidate:
                # Personalize email
                personalized_body = body.replace("{candidate_name}", candidate.get("full_name", ""))
                personalized_subject = subject.replace("{candidate_name}", candidate.get("full_name", ""))
                
                # Send email (mock implementation)
                result = await email_service.send_sequence_email(
                    candidate["email"],
                    personalized_subject,
                    personalized_body,
                    current_recruiter.email
                )
                
                if result["success"]:
                    sent_count += 1
                    
                    # Log communication
                    comm_log = CommunicationLog(
                        sender_id=current_recruiter.id,
                        recipient_id=candidate_id,
                        recipient_type="candidate",
                        communication_type="email",
                        subject=personalized_subject,
                        content=personalized_body,
                        status="sent"
                    )
                    await db.communication_logs.insert_one(comm_log.dict())
                else:
                    errors.append(f"Failed to send to {candidate['email']}: {result['error']}")
        except Exception as e:
            errors.append(f"Error processing candidate {candidate_id}: {str(e)}")
    
    return {
        "message": f"Bulk email completed. Sent: {sent_count}, Errors: {len(errors)}",
        "sent_count": sent_count,
        "error_count": len(errors),
        "errors": errors[:10]  # Limit error messages
    }

# Data Enrichment
@api_router.post("/candidates/{candidate_id}/enrich")
async def enrich_candidate_data(
    candidate_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Enrich candidate data with verified emails, phone numbers, social profiles"""
    
    candidate = await db.candidates.find_one({
        "id": candidate_id,
        "company_id": current_recruiter.company_id
    })
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Mock data enrichment - in production, integrate with services like Clearbit, Hunter, Apollo
    enriched_data = {
        "email_verified": True,
        "phone_verified": False,
        "social_profiles": {
            "linkedin": f"https://linkedin.com/in/{candidate['full_name'].lower().replace(' ', '-')}",
            "github": f"https://github.com/{candidate['full_name'].lower().replace(' ', '')}"
        },
        "employment_history": [
            {
                "company": candidate.get("current_company", "Unknown"),
                "title": candidate.get("current_title", "Unknown"),
                "duration": "2+ years",
                "verified": False
            }
        ],
        "skills_verified": candidate.get("skills", [])[:5],
        "enrichment_source": "mock_service"
    }
    
    enrichment = CandidateEnrichment(
        candidate_id=candidate_id,
        **enriched_data
    )
    
    # Update or insert enrichment data
    await db.candidate_enrichments.update_one(
        {"candidate_id": candidate_id},
        {"$set": enrichment.dict()},
        upsert=True
    )
    
    return {
        "message": "Candidate data enriched successfully",
        "enrichment": enrichment
    }

# Chrome Extension Support (Mock endpoint for sourcing)
@api_router.post("/candidates/chrome-import")
async def chrome_extension_import(
    profile_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Import candidate from Chrome extension (LinkedIn, Xing, etc.)"""
    
    # Create candidate from Chrome extension data
    candidate_data = {
        "id": str(uuid.uuid4()),
        "full_name": profile_data.get("name", "Unknown"),
        "email": profile_data.get("email", ""),
        "phone": profile_data.get("phone", ""),
        "current_title": profile_data.get("title", ""),
        "current_company": profile_data.get("company", ""),
        "location": profile_data.get("location", ""),
        "skills": profile_data.get("skills", []),
        "bio": profile_data.get("summary", ""),
        "linkedin_url": profile_data.get("linkedin_url", ""),
        "experience_years": profile_data.get("experience_years", 0),
        "company_id": current_recruiter.company_id,
        "password_hash": hashlib.sha256("temp_password".encode()).hexdigest(),
        "is_verified": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Check if candidate already exists
    existing = await db.candidates.find_one({"email": candidate_data["email"]})
    if existing:
        return {
            "message": "Candidate already exists in database",
            "candidate_id": existing["id"],
            "duplicate": True
        }
    
    # Insert new candidate
    await db.candidates.insert_one(candidate_data)
    
    # Log the sourcing
    source_log = CandidateSource(
        candidate_id=candidate_data["id"],
        source_type="chrome_extension",
        source_details={
            "platform": profile_data.get("platform", "unknown"),
            "url": profile_data.get("source_url", "")
        },
        recruiter_id=current_recruiter.id,
        company_id=current_recruiter.company_id
    )
    await db.candidate_sources.insert_one(source_log.dict())
    
    return {
        "message": "Candidate imported successfully from Chrome extension",
        "candidate": CandidateUser(**candidate_data),
        "duplicate": False
    }

# Advanced Analytics Endpoints
@api_router.get("/analytics/performance")
async def get_performance_analytics(
    period: str = "monthly",
    recruiter_id: Optional[str] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get detailed performance analytics"""
    
    # Date range calculation
    now = datetime.now(timezone.utc)
    if period == "weekly":
        start_date = now - timedelta(days=7)
    elif period == "monthly":
        start_date = now - timedelta(days=30)
    elif period == "quarterly":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=365)
    
    query_filter = {
        "company_id": current_recruiter.company_id,
        "created_at": {"$gte": start_date}
    }
    
    if recruiter_id:
        query_filter["recruiter_id"] = recruiter_id
    
    # Calculate various metrics
    metrics = {}
    
    # Time to hire
    hired_applications = await db.candidate_applications.find({
        **query_filter,
        "stage": "hired"
    }).to_list(1000)
    
    if hired_applications:
        time_to_hire_days = []
        for app in hired_applications:
            if app.get("hired_date") and app.get("created_at"):
                days = (app["hired_date"] - app["created_at"]).days
                time_to_hire_days.append(days)
        
        if time_to_hire_days:
            metrics["average_time_to_hire"] = round(statistics.mean(time_to_hire_days), 1)
            metrics["median_time_to_hire"] = round(statistics.median(time_to_hire_days), 1)
        else:
            metrics["average_time_to_hire"] = 0
            metrics["median_time_to_hire"] = 0
    
    # Source effectiveness
    sources = await db.candidate_sources.find(query_filter).to_list(1000)
    source_stats = {}
    for source in sources:
        source_type = source.get("source_type", "unknown")
        if source_type not in source_stats:
            source_stats[source_type] = {"count": 0, "hired": 0}
        source_stats[source_type]["count"] += 1
        
        # Check if this candidate was hired
        hired = await db.candidate_applications.find_one({
            "candidate_id": source["candidate_id"],
            "stage": "hired"
        })
        if hired:
            source_stats[source_type]["hired"] += 1
    
    # Calculate conversion rates
    for source_type, stats in source_stats.items():
        if stats["count"] > 0:
            stats["conversion_rate"] = round(stats["hired"] / stats["count"] * 100, 2)
        else:
            stats["conversion_rate"] = 0
    
    metrics["source_effectiveness"] = source_stats
    
    # Interview statistics
    interviews = await db.interviews.find(query_filter).to_list(1000)
    interview_stats = {
        "total": len(interviews),
        "completed": len([i for i in interviews if i.get("status") == "completed"]),
        "no_show": len([i for i in interviews if i.get("status") == "no_show"]),
        "cancelled": len([i for i in interviews if i.get("status") == "cancelled"])
    }
    
    if interview_stats["total"] > 0:
        interview_stats["completion_rate"] = round(interview_stats["completed"] / interview_stats["total"] * 100, 2)
        interview_stats["no_show_rate"] = round(interview_stats["no_show"] / interview_stats["total"] * 100, 2)
    else:
        interview_stats["completion_rate"] = 0
        interview_stats["no_show_rate"] = 0
    
    metrics["interview_stats"] = interview_stats
    
    # Revenue metrics
    deals = await db.deals.find({
        "company_id": current_recruiter.company_id,
        "created_at": {"$gte": start_date}
    }).to_list(1000)
    
    revenue_stats = {
        "total_deals": len(deals),
        "won_deals": len([d for d in deals if d.get("stage") == "closed_won"]),
        "lost_deals": len([d for d in deals if d.get("stage") == "closed_lost"]),
        "pipeline_value": sum(d.get("value", 0) for d in deals if d.get("stage") not in ["closed_won", "closed_lost"]),
        "won_value": sum(d.get("value", 0) for d in deals if d.get("stage") == "closed_won")
    }
    
    if revenue_stats["total_deals"] > 0:
        revenue_stats["win_rate"] = round(revenue_stats["won_deals"] / revenue_stats["total_deals"] * 100, 2)
    else:
        revenue_stats["win_rate"] = 0
    
    metrics["revenue_stats"] = revenue_stats
    
    return {
        "period": period,
        "date_range": {"start": start_date, "end": now},
        "metrics": metrics
    }

# Communication Tracking
@api_router.get("/communications/log")
async def get_communication_log(
    recipient_id: Optional[str] = None,
    communication_type: Optional[str] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get communication log with filters"""
    
    query = {"sender_id": current_recruiter.id}
    
    if recipient_id:
        query["recipient_id"] = recipient_id
    
    if communication_type:
        query["communication_type"] = communication_type
    
    communications = await db.communication_logs.find(query).limit(100).to_list(100)
    
    return [CommunicationLog(**comm) for comm in communications]

# Integration Hub (Mock endpoints for popular integrations)
@api_router.get("/integrations/available")
async def get_available_integrations():
    """Get list of available integrations"""
    integrations = [
        {"name": "LinkedIn Recruiter", "type": "sourcing", "status": "available"},
        {"name": "Indeed API", "type": "job_boards", "status": "available"},
        {"name": "Zoom", "type": "video_calls", "status": "available"},
        {"name": "Google Calendar", "type": "calendar", "status": "available"},
        {"name": "Outlook Calendar", "type": "calendar", "status": "available"},
        {"name": "Slack", "type": "communication", "status": "available"},
        {"name": "Microsoft Teams", "type": "communication", "status": "available"},
        {"name": "Zapier", "type": "automation", "status": "available"},
        {"name": "Clearbit", "type": "data_enrichment", "status": "available"},
        {"name": "HubSpot", "type": "crm", "status": "available"}
    ]
    
    return integrations

@api_router.post("/integrations/{integration_name}/connect")
async def connect_integration(
    integration_name: str,
    connection_data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Connect to external integration"""
    
    # Mock integration connection - in production, handle OAuth flows
    connection_result = {
        "integration": integration_name,
        "status": "connected",
        "connected_at": datetime.now(timezone.utc),
        "account_info": connection_data.get("account_info", {}),
        "features_enabled": connection_data.get("features", [])
    }
    
    return {
        "message": f"Successfully connected to {integration_name}",
        "connection": connection_result
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()