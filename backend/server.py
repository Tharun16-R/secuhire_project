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
from datetime import datetime, timezone, timedelta
import jwt
import hashlib
import PyPDF2
import io
import re
from enum import Enum
import random
import string

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
    
    if datetime.now(timezone.utc) > verification["expires_at"]:
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
    
    if datetime.now(timezone.utc) > verification["expires_at"]:
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
    job_id: str,
    cover_letter: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
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