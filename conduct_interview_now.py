#!/usr/bin/env python3
"""
Script to schedule an interview for immediate testing (right now)
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

async def schedule_immediate_interview():
    """Schedule an interview for immediate testing"""
    
    # Connect to MongoDB
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🚀 Scheduling interview for IMMEDIATE testing...")
    
    # Get existing data
    candidate = await db.candidates.find_one({"email": "candidate@example.com"})
    recruiter = await db.recruiters.find_one({"email": "recruiter@techcorp.com"})
    company = await db.companies.find_one({"name": "TechCorp Inc"})
    job = await db.jobs.find_one({"title": "Senior React Developer"})
    
    if not all([candidate, recruiter, company, job]):
        print("❌ Missing required data. Please run seed_interviews.py first.")
        return
    
    # Create a new application if needed
    application_id = str(uuid.uuid4())
    application = {
        "id": application_id,
        "candidate_id": candidate["id"],
        "job_id": job["id"],
        "company_id": company["id"],
        "status": "applied",
        "applied_at": datetime.now(timezone.utc),
        "resume_url": "https://example.com/resume.pdf",
        "cover_letter": "I am very interested in this position...",
        "stage": "new"
    }
    await db.candidate_applications.insert_one(application)
    print("✅ Created application")
    
    # Schedule interview for RIGHT NOW
    now = datetime.now(timezone.utc)
    interview_id = str(uuid.uuid4())
    interview = {
        "id": interview_id,
        "application_id": application_id,
        "candidate_id": candidate["id"],
        "interviewer_id": recruiter["id"],
        "job_id": job["id"],
        "company_id": company["id"],
        "interview_type": "video",
        "scheduled_date": now,  # RIGHT NOW!
        "duration_minutes": 30,  # 30 minutes for testing
        "meeting_link": "https://meet.google.com/test-interview-now",
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc)
    }
    await db.interviews.insert_one(interview)
    
    print("🎯 INTERVIEW SCHEDULED FOR RIGHT NOW!")
    print(f"⏰ Time: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"👤 Candidate: {candidate['name']} ({candidate['email']})")
    print(f"🏢 Company: {company['name']}")
    print(f"💼 Position: {job['title']}")
    print(f"🔗 Meeting Link: {interview['meeting_link']}")
    print(f"⏱️ Duration: {interview['duration_minutes']} minutes")
    
    print("\n🚀 READY TO TEST!")
    print("1. Open the frontend application")
    print("2. Login as candidate@example.com")
    print("3. Go to 'My Interviews' tab")
    print("4. Click 'Join Secure Interview' button")
    print("5. Follow the onboarding process")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(schedule_immediate_interview())
