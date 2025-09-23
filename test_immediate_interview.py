#!/usr/bin/env python3
"""
Test script to demonstrate immediate interview conduction upon job application
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

async def setup_immediate_interview_test():
    """Set up test data for immediate interview testing"""
    
    # Connect to MongoDB
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🚀 Setting up IMMEDIATE INTERVIEW test...")
    
    # Check if we have existing data
    candidate = await db.candidates.find_one({"email": "candidate@example.com"})
    recruiter = await db.recruiters.find_one({"email": "recruiter@techcorp.com"})
    company = await db.companies.find_one({"name": "TechCorp Inc"})
    
    if not all([candidate, recruiter, company]):
        print("❌ Missing required data. Please run seed_interviews.py first.")
        return
    
    # Create a fresh job for testing
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "title": "Immediate Interview Test - React Developer",
        "company_id": company["id"],
        "description": "This is a test job for immediate interview conduction. When you apply for this job, the interview will start immediately!",
        "requirements": ["React", "JavaScript", "Node.js", "Immediate availability"],
        "location": "Remote",
        "salary_min": 80000,
        "salary_max": 120000,
        "employment_type": "full_time",
        "status": "active",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.jobs.insert_one(job)
    print(f"✅ Created test job: {job['title']}")
    
    print("\n🎯 TEST SETUP COMPLETE!")
    print("=" * 60)
    print("📋 INSTRUCTIONS FOR TESTING IMMEDIATE INTERVIEW:")
    print("=" * 60)
    print("1. 🌐 Open the frontend application (http://localhost:3000)")
    print("2. 👤 Login as candidate:")
    print("   • Email: candidate@example.com")
    print("   • Password: password123")
    print("3. 🔍 Search for jobs or go to 'Jobs' tab")
    print("4. 📝 Find 'Immediate Interview Test - React Developer' job")
    print("5. ✍️ Click 'Apply' and submit your application")
    print("6. 🚀 When prompted, click 'YES' to start interview immediately")
    print("7. 🎬 The secure interview will begin right away!")
    print("=" * 60)
    print("🎉 The interview will be conducted IMMEDIATELY after application!")
    print("⏱️ Duration: 30 minutes")
    print("🛡️ Features: Full security monitoring, AI analysis, recording")
    print("=" * 60)
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(setup_immediate_interview_test())
