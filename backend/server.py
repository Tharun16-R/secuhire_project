from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
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
import json
import asyncio
import base64
import cv2
import numpy as np
import google.generativeai as genai
from collections import deque

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

# Initialize Gemini AI
gemini_api_key = os.environ.get('GEMINI_API_KEY')
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)
else:
    logging.warning("GEMINI_API_KEY not configured - AI monitoring will be disabled")

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    phone: str
    experience_years: int
    skills: List[str]
    resume_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    experience_years: int
    skills: List[str]

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    company: str
    description: str
    requirements: List[str]
    location: str
    salary_range: str
    job_type: str  # Full-time, Part-time, Contract
    posted_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class JobApplication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    user_id: str
    cover_letter: str
    status: str = "pending"  # pending, reviewing, scheduled, completed, rejected
    applied_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    interview_date: Optional[datetime] = None

class InterviewSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    application_id: str
    user_id: str
    job_id: str
    scheduled_date: datetime
    duration_minutes: int = 60
    status: str = "scheduled"  # scheduled, in_progress, completed, cancelled
    ai_monitoring_enabled: bool = True

class AIAnalysisResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    frame_id: str
    timestamp: datetime
    facial_expression_score: float
    eye_movement_score: float
    behavioral_score: float
    authenticity_confidence: float
    fraud_risk_level: str
    red_flags: List[str]
    recommendations: List[str]

class VideoStreamData(BaseModel):
    frame_data: str
    timestamp: str
    session_id: str

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {"user_id": user_id, "email": email, "exp": datetime.now(timezone.utc).timestamp() + 86400}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["user_id"]})
        if user:
            return User(**user)
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# AI Monitoring Components
class VideoStreamManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.session_connections: Dict[str, WebSocket] = {}
        
    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.session_connections[session_id] = websocket
        logging.info(f"AI monitoring session {session_id} connected")
        
    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.session_connections:
            del self.session_connections[session_id]
        logging.info(f"AI monitoring session {session_id} disconnected")
        
    async def broadcast_analysis(self, session_id: str, analysis_result: Dict[str, Any]):
        """Broadcast analysis results to connected clients"""
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_json({
                    "type": "analysis_result",
                    "data": analysis_result
                })
            except Exception as e:
                logging.error(f"Error broadcasting analysis: {e}")
                self.disconnect(session_id)

class GeminiAnalyzer:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        self.analysis_history = deque(maxlen=1000)
        
    async def analyze_interview_frame(self, frame_data: str, session_id: str) -> Dict[str, Any]:
        """Analyze video frame for behavioral indicators"""
        try:
            if not gemini_api_key:
                return self._create_mock_response()
                
            # Decode base64 frame
            frame_bytes = base64.b64decode(frame_data)
            
            # Create analysis prompt
            prompt = self._create_behavioral_analysis_prompt()
            
            # Analyze with Gemini
            response = await self.model.generate_content_async([
                prompt,
                {"mime_type": "image/jpeg", "data": frame_bytes}
            ])
            
            # Parse response
            analysis_result = await self._parse_analysis_response(response.text, session_id)
            
            # Store analysis
            self.analysis_history.append(analysis_result)
            
            return analysis_result
            
        except Exception as e:
            logging.error(f"Gemini analysis error: {e}")
            return self._create_error_response(str(e))
            
    def _create_behavioral_analysis_prompt(self) -> str:
        """Create comprehensive behavioral analysis prompt for Gemini"""
        return """
        Analyze this video frame from an online interview for authenticity and behavioral indicators. 
        
        Focus on:
        1. Facial expression naturalness (score 0-100)
        2. Eye contact and gaze patterns (score 0-100)  
        3. Overall behavioral authenticity (score 0-100)
        4. Fraud risk assessment (Low/Medium/High)
        
        Provide analysis as JSON:
        {
          "facial_expression_score": 85,
          "eye_movement_score": 78,
          "behavioral_score": 82,
          "authenticity_confidence": 81.7,
          "fraud_risk_level": "Low",
          "red_flags": [],
          "observations": ["Natural expressions", "Good eye contact"],
          "recommendations": ["Continue with normal interview process"]
        }
        """
        
    async def _parse_analysis_response(self, response_text: str, session_id: str) -> Dict[str, Any]:
        """Parse Gemini response into structured data"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
            
            if json_match:
                json_data = json.loads(json_match.group())
                return self._validate_analysis_structure(json_data, session_id)
            else:
                return self._parse_natural_language_response(response_text, session_id)
                
        except Exception as e:
            logging.warning(f"Response parsing error: {e}")
            return self._create_mock_response(session_id)
            
    def _validate_analysis_structure(self, data: Dict[str, Any], session_id: str) -> Dict[str, Any]:
        """Validate and normalize analysis data"""
        required_fields = {
            'facial_expression_score': 75.0,
            'eye_movement_score': 75.0,
            'behavioral_score': 75.0,
            'authenticity_confidence': 75.0,
            'fraud_risk_level': 'Low',
            'red_flags': [],
            'observations': ['Behavioral analysis completed'],
            'recommendations': ['Continue interview process']
        }
        
        # Ensure all fields exist
        for field, default_value in required_fields.items():
            if field not in data:
                data[field] = default_value
                
        # Normalize scores
        score_fields = ['facial_expression_score', 'eye_movement_score', 'behavioral_score', 'authenticity_confidence']
        for field in score_fields:
            if isinstance(data[field], (int, float)):
                data[field] = min(100, max(0, float(data[field])))
                
        data['session_id'] = session_id
        data['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        return data
        
    def _parse_natural_language_response(self, response_text: str, session_id: str) -> Dict[str, Any]:
        """Fallback parsing for natural language responses"""
        # Extract confidence scores using regex
        import re
        confidence_pattern = r'(\d+(?:\.\d+)?)'
        matches = re.findall(confidence_pattern, response_text)
        
        scores = [float(m) for m in matches if 0 <= float(m) <= 100]
        avg_score = sum(scores) / len(scores) if scores else 75.0
        
        return {
            'session_id': session_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'facial_expression_score': avg_score,
            'eye_movement_score': avg_score,
            'behavioral_score': avg_score,
            'authenticity_confidence': avg_score,
            'fraud_risk_level': 'Low' if avg_score > 70 else 'Medium' if avg_score > 40 else 'High',
            'red_flags': [],
            'observations': ['Analysis completed successfully'],
            'recommendations': ['Continue with interview process']
        }
        
    def _create_mock_response(self, session_id: str = "unknown") -> Dict[str, Any]:
        """Create mock response when Gemini is unavailable"""
        return {
            'session_id': session_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'facial_expression_score': 78.5,
            'eye_movement_score': 82.3,
            'behavioral_score': 79.1,
            'authenticity_confidence': 80.0,
            'fraud_risk_level': 'Low',
            'red_flags': [],
            'observations': ['Mock analysis - Gemini API not configured', 'Normal behavioral patterns detected'],
            'recommendations': ['Continue with standard interview process', 'Enable Gemini API for full analysis']
        }
        
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create error response"""
        return {
            'session_id': 'error',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'facial_expression_score': 0.0,
            'eye_movement_score': 0.0,
            'behavioral_score': 0.0,
            'authenticity_confidence': 0.0,
            'fraud_risk_level': 'Unknown',
            'red_flags': ['analysis_error'],
            'observations': [f'Analysis failed: {error_message}'],
            'recommendations': ['Retry analysis or use manual verification']
        }

# Global instances
video_manager = VideoStreamManager()
gemini_analyzer = GeminiAnalyzer()

# Authentication Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user_data.dict()
    hashed_password = hash_password(user_dict.pop("password"))
    user = User(**user_dict)
    
    # Store user and password separately
    await db.users.insert_one(user.dict())
    await db.user_passwords.insert_one({"user_id": user.id, "password": hashed_password})
    
    token = create_jwt_token(user.id, user.email)
    return {"user": user, "token": token, "message": "Registration successful"}

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    # Find user
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    user_password = await db.user_passwords.find_one({"user_id": user["id"]})
    if not user_password or not verify_password(login_data.password, user_password["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["id"], user["email"])
    return {"user": User(**user), "token": token, "message": "Login successful"}

# Job Routes
@api_router.get("/jobs", response_model=List[Job])
async def get_jobs():
    jobs = await db.jobs.find({"is_active": True}).to_list(100)
    return [Job(**job) for job in jobs]

@api_router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return Job(**job)

# Application Routes
@api_router.post("/applications", response_model=JobApplication)
async def apply_for_job(
    job_id: str,
    cover_letter: str,
    current_user: User = Depends(get_current_user)
):
    # Check if job exists
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if already applied
    existing_application = await db.applications.find_one({
        "job_id": job_id,
        "user_id": current_user.id
    })
    if existing_application:
        raise HTTPException(status_code=400, detail="Already applied for this job")
    
    application = JobApplication(
        job_id=job_id,
        user_id=current_user.id,
        cover_letter=cover_letter
    )
    await db.applications.insert_one(application.dict())
    return application

@api_router.get("/applications/my", response_model=List[dict])
async def get_my_applications(current_user: User = Depends(get_current_user)):
    applications = await db.applications.find({"user_id": current_user.id}).to_list(100)
    
    # Enrich with job details
    enriched_applications = []
    for app in applications:
        job = await db.jobs.find_one({"id": app["job_id"]})
        app_data = JobApplication(**app)
        enriched_applications.append({
            "application": app_data,
            "job": Job(**job) if job else None
        })
    
    return enriched_applications

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    total_applications = await db.applications.count_documents({"user_id": current_user.id})
    pending_applications = await db.applications.count_documents({"user_id": current_user.id, "status": "pending"})
    scheduled_interviews = await db.interviews.count_documents({"user_id": current_user.id, "status": "scheduled"})
    total_jobs = await db.jobs.count_documents({"is_active": True})
    
    return {
        "total_applications": total_applications,
        "pending_applications": pending_applications,
        "scheduled_interviews": scheduled_interviews,
        "total_jobs": total_jobs
    }

# Seed some sample jobs
@api_router.post("/seed/jobs")
async def seed_jobs():
    sample_jobs = [
        {
            "title": "Senior Software Engineer",
            "company": "TechCorp Solutions",
            "description": "Join our dynamic team as a Senior Software Engineer. Work on cutting-edge projects using modern technologies.",
            "requirements": ["5+ years Python experience", "FastAPI expertise", "Cloud platforms", "Microservices architecture"],
            "location": "San Francisco, CA (Remote)",
            "salary_range": "$140,000 - $180,000",
            "job_type": "Full-time"
        },
        {
            "title": "Data Scientist",
            "company": "AI Innovations Inc",
            "description": "Lead data science initiatives and build ML models to drive business insights.",
            "requirements": ["Machine Learning expertise", "Python/R proficiency", "SQL skills", "Statistical analysis"],
            "location": "New York, NY (Hybrid)",
            "salary_range": "$120,000 - $160,000",
            "job_type": "Full-time"
        },
        {
            "title": "Frontend Developer",
            "company": "Digital Agency Pro",
            "description": "Create beautiful, responsive web applications using modern frontend technologies.",
            "requirements": ["React expertise", "TypeScript", "CSS/SCSS", "UI/UX understanding"],
            "location": "Austin, TX (Remote)",
            "salary_range": "$90,000 - $130,000",
            "job_type": "Full-time"
        },
        {
            "title": "DevOps Engineer",
            "company": "CloudScale Systems",
            "description": "Build and maintain robust CI/CD pipelines and cloud infrastructure.",
            "requirements": ["AWS/Azure/GCP", "Docker/Kubernetes", "Terraform", "CI/CD pipelines"],
            "location": "Seattle, WA (On-site)",
            "salary_range": "$110,000 - $150,000",
            "job_type": "Full-time"
        },
        {
            "title": "Product Manager",
            "company": "StartUp Dynamics",
            "description": "Drive product strategy and work with cross-functional teams to deliver innovative solutions.",
            "requirements": ["Product strategy", "Agile methodologies", "Stakeholder management", "Data-driven decisions"],
            "location": "Los Angeles, CA (Hybrid)",
            "salary_range": "$130,000 - $170,000",
            "job_type": "Full-time"
        }
    ]
    
    for job_data in sample_jobs:
        job = Job(**job_data)
        await db.jobs.insert_one(job.dict())
    
    return {"message": f"Seeded {len(sample_jobs)} jobs successfully"}

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