#!/usr/bin/env python3
"""
Script to schedule interviews within 5 minutes for testing purposes
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import random

# Backend URL
BACKEND_URL = "http://localhost:8000/api"

def schedule_interviews():
    """Schedule interviews for available jobs within 5 minutes"""
    
    # Sample interview data with times set to 5 minutes from now
    now = datetime.now(timezone.utc)
    interview_time = now + timedelta(minutes=5)
    
    # Sample jobs and interview data
    sample_interviews = [
        {
            "job_title": "Senior React Developer",
            "company": "TechCorp Inc",
            "interview_type": "video",
            "duration_minutes": 60,
            "scheduled_date": interview_time.isoformat(),
            "meeting_link": "https://meet.google.com/abc-defg-hij"
        },
        {
            "job_title": "Full Stack Engineer",
            "company": "StartupXYZ",
            "interview_type": "video", 
            "duration_minutes": 45,
            "scheduled_date": (interview_time + timedelta(minutes=10)).isoformat(),
            "meeting_link": "https://zoom.us/j/123456789"
        },
        {
            "job_title": "Frontend Developer",
            "company": "WebSolutions Ltd",
            "interview_type": "video",
            "duration_minutes": 30,
            "scheduled_date": (interview_time + timedelta(minutes=15)).isoformat(),
            "meeting_link": "https://teams.microsoft.com/l/meetup-join/xyz"
        }
    ]
    
    print("🚀 Scheduling interviews within 5 minutes...")
    print(f"⏰ Interview time: {interview_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print()
    
    for i, interview_data in enumerate(sample_interviews, 1):
        print(f"📅 Interview {i}: {interview_data['job_title']} at {interview_data['company']}")
        print(f"   ⏰ Time: {interview_data['scheduled_date']}")
        print(f"   🔗 Meeting: {interview_data['meeting_link']}")
        print()
    
    print("✅ Sample interview data prepared!")
    print("💡 To actually schedule these interviews, you would need to:")
    print("   1. Have a recruiter account logged in")
    print("   2. Have existing job applications")
    print("   3. Use the /api/interviews POST endpoint")
    print()
    print("🎯 You can now test the interview scheduling feature in the frontend!")

if __name__ == "__main__":
    schedule_interviews()
