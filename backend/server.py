from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
import hashlib
import PyPDF2
import io
import re
from enum import Enum

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
JWT_SECRET = "ats_crm_secret_key_2025"

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

# Define ATS Models
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Candidate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    location: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    experience_years: Optional[int] = None
    skills: List[str] = []
    education: List[str] = []
    resume_url: Optional[str] = None
    resume_text: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    source: str = "manual"  # manual, linkedin, job_board, referral
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Application(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    candidate_id: str
    recruiter_id: str
    company_id: str
    stage: PipelineStage = PipelineStage.NEW
    score: Optional[int] = None  # 1-10 rating
    notes: List[str] = []
    applied_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Interview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    application_id: str
    interviewer_id: str
    type: str  # phone, video, onsite
    scheduled_date: datetime
    duration_minutes: int = 60
    status: str = "scheduled"  # scheduled, completed, cancelled, no_show
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

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_jwt_token(recruiter_id: str, email: str, company_id: str) -> str:
    payload = {
        "recruiter_id": recruiter_id, 
        "email": email, 
        "company_id": company_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_recruiter(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        recruiter = await db.recruiters.find_one({"id": payload["recruiter_id"]})
        if recruiter:
            return Recruiter(**recruiter)
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

# Authentication Routes
@api_router.post("/auth/register")
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
    await db.recruiter_passwords.insert_one({"recruiter_id": recruiter.id, "password": hashed_password})
    
    token = create_jwt_token(recruiter.id, recruiter.email, company.id)
    return {"recruiter": recruiter, "company": company, "token": token, "message": "Registration successful"}

@api_router.post("/auth/login")
async def login_recruiter(login_data: RecruiterLogin):
    # Find recruiter
    recruiter = await db.recruiters.find_one({"email": login_data.email})
    if not recruiter:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    recruiter_password = await db.recruiter_passwords.find_one({"recruiter_id": recruiter["id"]})
    if not recruiter_password or not verify_password(login_data.password, recruiter_password["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get company info
    company = await db.companies.find_one({"id": recruiter["company_id"]})
    
    token = create_jwt_token(recruiter["id"], recruiter["email"], recruiter["company_id"])
    return {
        "recruiter": Recruiter(**recruiter), 
        "company": Company(**company) if company else None,
        "token": token, 
        "message": "Login successful"
    }

# Job Management Routes
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

# Candidate Management Routes
@api_router.post("/candidates", response_model=Candidate)
async def create_candidate(candidate_data: Dict[str, Any], current_recruiter: Recruiter = Depends(get_current_recruiter)):
    candidate = Candidate(**candidate_data)
    await db.candidates.insert_one(candidate.dict())
    return candidate

@api_router.post("/candidates/upload-resume")
async def upload_resume(
    candidate_id: str,
    file: UploadFile = File(...),
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify it's a PDF
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Read file content
    file_content = await file.read()
    
    # Extract text from PDF
    resume_text = extract_text_from_pdf(file_content)
    
    # Parse skills from resume
    skills = parse_resume_skills(resume_text)
    
    # Update candidate with resume data
    await db.candidates.update_one(
        {"id": candidate_id},
        {"$set": {
            "resume_text": resume_text,
            "skills": skills,
            "resume_url": f"/resumes/{candidate_id}.pdf"  # Would save to storage in production
        }}
    )
    
    return {
        "message": "Resume uploaded successfully",
        "extracted_skills": skills,
        "text_length": len(resume_text)
    }

@api_router.get("/candidates", response_model=List[Candidate])
async def get_candidates(
    search: Optional[str] = None,
    skills: Optional[str] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    query = {}
    
    # Add search filters
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"current_title": {"$regex": search, "$options": "i"}},
            {"current_company": {"$regex": search, "$options": "i"}}
        ]
    
    if skills:
        skill_list = [s.strip() for s in skills.split(",")]
        query["skills"] = {"$in": skill_list}
    
    candidates = await db.candidates.find(query).to_list(1000)
    return [Candidate(**candidate) for candidate in candidates]

# Application & Pipeline Management
@api_router.post("/applications", response_model=Application)
async def create_application(
    job_id: str,
    candidate_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify job and candidate exist
    job = await db.jobs.find_one({"id": job_id, "company_id": current_recruiter.company_id})
    candidate = await db.candidates.find_one({"id": candidate_id})
    
    if not job or not candidate:
        raise HTTPException(status_code=404, detail="Job or candidate not found")
    
    # Check if application already exists
    existing = await db.applications.find_one({"job_id": job_id, "candidate_id": candidate_id})
    if existing:
        raise HTTPException(status_code=400, detail="Application already exists")
    
    application = Application(
        job_id=job_id,
        candidate_id=candidate_id,
        recruiter_id=current_recruiter.id,
        company_id=current_recruiter.company_id
    )
    
    await db.applications.insert_one(application.dict())
    return application

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
    
    applications = await db.applications.find(query).to_list(1000)
    
    # Enrich with candidate and job data
    enriched_applications = []
    for app in applications:
        candidate = await db.candidates.find_one({"id": app["candidate_id"]})
        job = await db.jobs.find_one({"id": app["job_id"]})
        
        enriched_applications.append({
            "application": Application(**app),
            "candidate": Candidate(**candidate) if candidate else None,
            "job": Job(**job) if job else None
        })
    
    return enriched_applications

@api_router.put("/applications/{application_id}/stage")
async def move_application_stage(
    application_id: str,
    stage: PipelineStage,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    result = await db.applications.update_one(
        {"id": application_id, "company_id": current_recruiter.company_id},
        {"$set": {"stage": stage, "last_updated": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {"message": "Application stage updated successfully"}

# Notes Management
@api_router.post("/applications/{application_id}/notes", response_model=Note)
async def add_note(
    application_id: str,
    content: str,
    note_type: str = "general",
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify application exists and belongs to company
    application = await db.applications.find_one({
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
    application = await db.applications.find_one({
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
    total_applications = await db.applications.count_documents({"company_id": company_id})
    
    # Pipeline stats
    pipeline_stages = {}
    for stage in PipelineStage:
        count = await db.applications.count_documents({
            "company_id": company_id, 
            "stage": stage.value
        })
        pipeline_stages[stage.value] = count
    
    # Recent activity (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = thirty_days_ago.replace(day=thirty_days_ago.day - 30)
    
    recent_applications = await db.applications.count_documents({
        "company_id": company_id,
        "applied_date": {"$gte": thirty_days_ago}
    })
    
    recent_hires = await db.applications.count_documents({
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
    
    # Sample candidates
    sample_candidates = [
        {
            "email": "john.developer@email.com",
            "full_name": "John Developer",
            "phone": "+1234567890",
            "location": "San Francisco, CA",
            "current_title": "Senior Frontend Developer",
            "current_company": "TechCorp",
            "experience_years": 6,
            "skills": ["React", "JavaScript", "TypeScript", "Node.js"],
            "source": "linkedin"
        },
        {
            "email": "sarah.manager@email.com",
            "full_name": "Sarah Marketing",
            "phone": "+1987654321", 
            "location": "New York, NY",
            "current_title": "Marketing Manager",
            "current_company": "GrowthCo",
            "experience_years": 4,
            "skills": ["Marketing", "Analytics", "Strategy", "B2B"],
            "source": "referral"
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
        candidate = Candidate(**candidate_data)
        await db.candidates.insert_one(candidate.dict())
    
    return {"message": "Demo data seeded successfully"}

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