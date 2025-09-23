#!/usr/bin/env python3
"""
Script to seed the database with sample data and schedule interviews within 5 minutes
"""

import asyncio
import motor.motor_asyncio
from datetime import datetime, timezone, timedelta
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'secuhire')

async def seed_database():
    """Seed the database with sample data and schedule interviews"""
    
    # Connect to MongoDB
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🌱 Seeding database with sample data...")
    
    # Create sample company
    company_id = str(uuid.uuid4())
    company = {
        "id": company_id,
        "name": "TechCorp Inc",
        "industry": "Technology",
        "size": "100-500",
        "description": "Leading technology company specializing in web development",
        "website": "https://techcorp.com",
        "created_at": datetime.now(timezone.utc)
    }
    await db.companies.insert_one(company)
    print("✅ Created company: TechCorp Inc")
    
    # Create sample recruiter
    recruiter_id = str(uuid.uuid4())
    recruiter = {
        "id": recruiter_id,
        "email": "recruiter@techcorp.com",
        "password_hash": "hashed_password_123",  # In real app, this would be properly hashed
        "name": "John Smith",
        "company_id": company_id,
        "role": "Senior Recruiter",
        "created_at": datetime.now(timezone.utc)
    }
    await db.recruiters.insert_one(recruiter)
    print("✅ Created recruiter: John Smith")
    
    # Create sample candidate
    candidate_id = str(uuid.uuid4())
    candidate = {
        "id": candidate_id,
        "email": "candidate@example.com",
        "password_hash": "hashed_password_456",
        "name": "Jane Doe",
        "phone": "+1-555-0123",
        "location": "San Francisco, CA",
        "skills": ["React", "JavaScript", "Node.js", "Python"],
        "experience_years": 3,
        "created_at": datetime.now(timezone.utc)
    }
    await db.candidates.insert_one(candidate)
    print("✅ Created candidate: Jane Doe")
    
    # Create sample jobs
    jobs = [
        {
            "id": str(uuid.uuid4()),
            "title": "Senior React Developer",
            "company_id": company_id,
            "description": "We are looking for a senior React developer to join our team...",
            "requirements": ["5+ years React experience", "JavaScript", "TypeScript"],
            "location": "San Francisco, CA",
            "salary_min": 120000,
            "salary_max": 150000,
            "employment_type": "full_time",
            "status": "active",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Full Stack Engineer",
            "company_id": company_id,
            "description": "Full stack engineer position with modern tech stack...",
            "requirements": ["React", "Node.js", "MongoDB", "AWS"],
            "location": "Remote",
            "salary_min": 100000,
            "salary_max": 130000,
            "employment_type": "full_time",
            "status": "active",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for job in jobs:
        await db.jobs.insert_one(job)
        print(f"✅ Created job: {job['title']}")
    
    # Create sample applications
    applications = []
    for job in jobs:
        application_id = str(uuid.uuid4())
        application = {
            "id": application_id,
            "candidate_id": candidate_id,
            "job_id": job["id"],
            "company_id": company_id,
            "status": "applied",
            "applied_at": datetime.now(timezone.utc),
            "resume_url": "https://example.com/resume.pdf",
            "cover_letter": "I am very interested in this position...",
            "stage": "new"
        }
        await db.candidate_applications.insert_one(application)
        applications.append(application)
        print(f"✅ Created application for: {job['title']}")
    
    # Schedule interviews within 5 minutes
    now = datetime.now(timezone.utc)
    interview_times = [
        now + timedelta(minutes=5),   # 5 minutes from now
        now + timedelta(minutes=10),  # 10 minutes from now
        now + timedelta(minutes=15)   # 15 minutes from now
    ]
    
    meeting_links = [
        "https://meet.google.com/abc-defg-hij",
        "https://zoom.us/j/123456789",
        "https://teams.microsoft.com/l/meetup-join/xyz"
    ]
    
    for i, (application, interview_time) in enumerate(zip(applications, interview_times)):
        interview_id = str(uuid.uuid4())
        interview = {
            "id": interview_id,
            "application_id": application["id"],
            "candidate_id": candidate_id,
            "interviewer_id": recruiter_id,
            "job_id": application["job_id"],
            "company_id": company_id,
            "interview_type": "video",
            "scheduled_date": interview_time,
            "duration_minutes": 60,
            "meeting_link": meeting_links[i],
            "status": "scheduled",
            "created_at": datetime.now(timezone.utc)
        }
        await db.interviews.insert_one(interview)
        print(f"✅ Scheduled interview: {interview_time.strftime('%H:%M:%S UTC')} - {jobs[i]['title']}")
    
    print("\n🎉 Database seeding completed!")
    print(f"📊 Created:")
    print(f"   - 1 company")
    print(f"   - 1 recruiter")
    print(f"   - 1 candidate")
    print(f"   - {len(jobs)} jobs")
    print(f"   - {len(applications)} applications")
    print(f"   - {len(interview_times)} interviews scheduled within 5-15 minutes")
    
    print(f"\n🔑 Login credentials:")
    print(f"   Recruiter: recruiter@techcorp.com")
    print(f"   Candidate: candidate@example.com")
    print(f"   Password: password123 (for both)")
    
    print(f"\n⏰ Interview times:")
    for i, time in enumerate(interview_times, 1):
        print(f"   Interview {i}: {time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
