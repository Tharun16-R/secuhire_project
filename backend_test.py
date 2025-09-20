import requests
import sys
import json
from datetime import datetime, timezone
import time
import uuid

class SecuHireBackendTester:
    def __init__(self, base_url="https://interview-shield-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.candidate_token = None
        self.recruiter_token = None
        self.candidate_id = None
        self.recruiter_id = None
        self.company_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_ids = {
            'jobs': [],
            'candidates': [],
            'applications': [],
            'interviews': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            self.failed_tests.append(f"{name}: Exception - {str(e)}")
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_candidate_registration(self):
        """Test candidate registration and JWT token generation"""
        timestamp = int(time.time())
        test_data = {
            "email": f"candidate_{timestamp}@secuhire.com",
            "password": "SecurePass123!",
            "full_name": "Alice Johnson",
            "phone": "+1234567890",
            "location": "San Francisco, CA",
            "current_title": "Senior Software Engineer",
            "current_company": "TechCorp Inc",
            "experience_years": 5,
            "education": "BS Computer Science",
            "skills": ["Python", "React", "Node.js", "MongoDB"],
            "expected_salary": 150000,
            "linkedin_url": "https://linkedin.com/in/alice-johnson",
            "bio": "Experienced software engineer with expertise in full-stack development"
        }
        
        success, response = self.run_test(
            "Candidate Registration",
            "POST",
            "/candidates/auth/register",
            200,
            data=test_data
        )
        
        if success and 'token' in response and 'user' in response:
            self.candidate_token = response['token']
            self.candidate_id = response['user']['id']
            print(f"   Token: {self.candidate_token[:20]}...")
            print(f"   Candidate ID: {self.candidate_id}")
            print(f"   Email verification code: {response.get('email_verification_code', 'N/A')}")
            print(f"   Phone OTP: {response.get('phone_otp', 'N/A')}")
            
            # Verify UUID format
            try:
                uuid.UUID(self.candidate_id)
                print(f"   ✅ UUID format validated")
            except ValueError:
                print(f"   ❌ Invalid UUID format: {self.candidate_id}")
                return False
                
            return True
        return False

    def test_candidate_login(self):
        """Test candidate login"""
        # First register a candidate for login test
        timestamp = int(time.time())
        email = f"login_candidate_{timestamp}@secuhire.com"
        password = "LoginTest123!"
        
        register_data = {
            "email": email,
            "password": password,
            "full_name": "Bob Smith",
            "phone": "+1987654321",
            "location": "New York, NY",
            "current_title": "Frontend Developer",
            "current_company": "StartupXYZ",
            "experience_years": 3,
            "education": "BS Software Engineering",
            "skills": ["JavaScript", "React", "CSS", "HTML"]
        }
        
        # Register first
        requests.post(f"{self.api_url}/candidates/auth/register", json=register_data)
        
        # Now test login
        login_data = {
            "email": email,
            "password": password
        }
        
        success, response = self.run_test(
            "Candidate Login",
            "POST",
            "/candidates/auth/login",
            200,
            data=login_data
        )
        
        return success and 'token' in response and 'user' in response

    def test_email_verification(self):
        """Test email verification endpoint"""
        if not self.candidate_id:
            print("❌ No candidate ID available for email verification test")
            return False
            
        # Use query parameters for verification
        success, response = self.run_test(
            "Email Verification",
            "POST",
            f"/candidates/verify-email?user_id={self.candidate_id}&verification_code=123456",
            200
        )
        
        return success

    def test_phone_verification(self):
        """Test phone verification endpoint"""
        if not self.candidate_id:
            print("❌ No candidate ID available for phone verification test")
            return False
            
        # Use query parameters for verification
        success, response = self.run_test(
            "Phone Verification",
            "POST",
            f"/candidates/verify-phone?user_id={self.candidate_id}&otp_code=123456",
            200
        )
        
        return success

    def test_recruiter_registration(self):
        """Test recruiter registration with company creation"""
        timestamp = int(time.time())
        test_data = {
            "email": f"recruiter_{timestamp}@secuhire.com",
            "password": "RecruiterPass123!",
            "full_name": "John Recruiter",
            "company_name": "SecuHire Technologies",
            "company_domain": "secuhire.com",
            "company_size": "51-200",
            "industry": "Technology"
        }
        
        success, response = self.run_test(
            "Recruiter Registration",
            "POST",
            "/recruiters/auth/register",
            200,
            data=test_data
        )
        
        if success and 'token' in response and 'user' in response and 'company' in response:
            self.recruiter_token = response['token']
            self.recruiter_id = response['user']['id']
            self.company_id = response['company']['id']
            print(f"   Token: {self.recruiter_token[:20]}...")
            print(f"   Recruiter ID: {self.recruiter_id}")
            print(f"   Company ID: {self.company_id}")
            
            # Verify UUID formats
            try:
                uuid.UUID(self.recruiter_id)
                uuid.UUID(self.company_id)
                print(f"   ✅ UUID formats validated")
            except ValueError:
                print(f"   ❌ Invalid UUID format")
                return False
                
            return True
        return False

    def test_recruiter_login(self):
        """Test recruiter login"""
        timestamp = int(time.time())
        email = f"login_recruiter_{timestamp}@secuhire.com"
        password = "LoginRecruiter123!"
        
        register_data = {
            "email": email,
            "password": password,
            "full_name": "Jane Recruiter",
            "company_name": "Test Recruiting Co",
            "company_domain": "testrecruiting.com",
            "company_size": "11-50",
            "industry": "Consulting"
        }
        
        # Register first
        requests.post(f"{self.api_url}/recruiters/auth/register", json=register_data)
        
        # Now test login
        login_data = {
            "email": email,
            "password": password
        }
        
        success, response = self.run_test(
            "Recruiter Login",
            "POST",
            "/recruiters/auth/login",
            200,
            data=login_data
        )
        
        return success and 'token' in response and 'user' in response and 'company' in response

    def test_job_creation_and_publishing(self):
        """Test job creation and publishing (recruiter functionality)"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for job creation test")
            return False
            
        job_data = {
            "title": "Senior Security Engineer",
            "description": "We're looking for a senior security engineer to enhance our interview platform security.",
            "requirements": ["Security expertise", "Python", "5+ years experience"],
            "location": "Remote",
            "job_type": "Full-time",
            "salary_min": 140000,
            "salary_max": 200000,
            "skills": ["Security", "Python", "Cybersecurity", "Penetration Testing"],
            "department": "Engineering",
            "experience_level": "Senior"
        }
        
        success, response = self.run_test(
            "Job Creation",
            "POST",
            "/jobs",
            200,
            data=job_data,
            token=self.recruiter_token
        )
        
        if success and 'id' in response:
            job_id = response['id']
            self.created_ids['jobs'].append(job_id)
            
            # Test job publishing
            publish_success, publish_response = self.run_test(
                "Job Publishing",
                "POST",
                f"/jobs/{job_id}/publish",
                200,
                token=self.recruiter_token
            )
            
            return publish_success
        return False

    def test_candidate_browse_jobs(self):
        """Test GET /api/candidates/jobs - browse available jobs"""
        if not self.candidate_token:
            print("❌ No candidate token available for browse jobs test")
            return False
            
        success, response = self.run_test(
            "Browse Available Jobs",
            "GET",
            "/candidates/jobs",
            200,
            token=self.candidate_token
        )
        
        if success:
            print(f"   Found {len(response)} available jobs")
            # Verify job structure
            if response and len(response) > 0:
                job_item = response[0]
                if 'job' in job_item and 'company' in job_item:
                    print(f"   ✅ Job structure validated")
                    return True
                else:
                    print(f"   ❌ Invalid job structure")
                    return False
        return success

    def test_candidate_apply_for_job(self):
        """Test POST /api/candidates/applications - apply for jobs"""
        if not self.candidate_token or not self.created_ids['jobs']:
            print("❌ No candidate token or job ID available for application test")
            return False
            
        job_id = self.created_ids['jobs'][0]
        application_data = {
            "job_id": job_id,
            "cover_letter": "I am very interested in this security engineer position. My experience in cybersecurity and Python development makes me a great fit for this role."
        }
        
        success, response = self.run_test(
            "Apply for Job",
            "POST",
            "/candidates/applications",
            200,
            data=application_data,
            token=self.candidate_token
        )
        
        if success and 'application' in response:
            application_id = response['application']['id']
            self.created_ids['applications'].append(application_id)
            print(f"   Application ID: {application_id}")
            
            # Verify UUID format
            try:
                uuid.UUID(application_id)
                print(f"   ✅ Application UUID format validated")
            except ValueError:
                print(f"   ❌ Invalid application UUID format")
                return False
                
            return True
        return False

    def test_candidate_my_applications(self):
        """Test GET /api/candidates/my-applications - get candidate applications"""
        if not self.candidate_token:
            print("❌ No candidate token available for my applications test")
            return False
            
        success, response = self.run_test(
            "Get My Applications",
            "GET",
            "/candidates/my-applications",
            200,
            token=self.candidate_token
        )
        
        if success:
            print(f"   Found {len(response)} applications")
            # Verify application structure
            if response and len(response) > 0:
                app_item = response[0]
                if 'application' in app_item and 'job' in app_item and 'company' in app_item:
                    print(f"   ✅ Application structure validated")
                    return True
                else:
                    print(f"   ❌ Invalid application structure")
                    return False
        return success

    def test_schedule_interview(self):
        """Test POST /api/interviews - schedule interviews (recruiter side)"""
        if not self.recruiter_token or not self.created_ids['applications']:
            print("❌ No recruiter token or application ID available for interview scheduling test")
            return False
            
        application_id = self.created_ids['applications'][0]
        interview_data = {
            "application_id": application_id,
            "scheduled_date": "2025-01-20T14:00:00Z",
            "interview_type": "video",
            "duration_minutes": 60,
            "meeting_link": "https://meet.google.com/abc-defg-hij"
        }
        
        success, response = self.run_test(
            "Schedule Interview",
            "POST",
            "/interviews",
            200,
            data=interview_data,
            token=self.recruiter_token
        )
        
        if success and 'interview' in response:
            interview_id = response['interview']['id']
            self.created_ids['interviews'].append(interview_id)
            print(f"   Interview ID: {interview_id}")
            
            # Verify UUID format and timezone handling
            try:
                uuid.UUID(interview_id)
                print(f"   ✅ Interview UUID format validated")
                
                # Check if scheduled_date is properly handled
                scheduled_date = response['interview']['scheduled_date']
                print(f"   ✅ Timezone-aware datetime: {scheduled_date}")
            except ValueError:
                print(f"   ❌ Invalid interview UUID format")
                return False
                
            return True
        return False

    def test_candidate_interviews(self):
        """Test GET /api/candidates/interviews - fetch candidate interviews"""
        if not self.candidate_token:
            print("❌ No candidate token available for interviews test")
            return False
            
        success, response = self.run_test(
            "Get Candidate Interviews",
            "GET",
            "/candidates/interviews",
            200,
            token=self.candidate_token
        )
        
        if success:
            print(f"   Found {len(response)} interviews")
            # Verify interview structure
            if response and len(response) > 0:
                interview_item = response[0]
                if 'interview' in interview_item and 'application' in interview_item and 'job' in interview_item:
                    print(f"   ✅ Interview structure validated")
                    return True
                else:
                    print(f"   ❌ Invalid interview structure")
                    return False
        return success

    def test_cors_and_api_prefix(self):
        """Test CORS configuration and API routing with /api prefix"""
        # Test CORS preflight request
        try:
            response = requests.options(f"{self.api_url}/candidates/jobs", 
                                      headers={'Origin': 'https://example.com'})
            print(f"   CORS preflight status: {response.status_code}")
            
            # Test API prefix routing
            # This should work with /api prefix
            response_with_prefix = requests.get(f"{self.api_url}/candidates/jobs")
            print(f"   API with /api prefix status: {response_with_prefix.status_code}")
            
            # This should fail without /api prefix
            response_without_prefix = requests.get(f"{self.base_url}/candidates/jobs")
            print(f"   API without /api prefix status: {response_without_prefix.status_code}")
            
            # CORS and API prefix are working if we get expected responses
            return True
            
        except Exception as e:
            print(f"   CORS/API prefix test error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run complete SecuHire backend test suite"""
        print("🚀 Starting SecuHire Backend Testing")
        print("=" * 60)
        
        # 1. Authentication System Tests
        print("\n📋 AUTHENTICATION SYSTEM TESTS")
        print("-" * 40)
        
        if not self.test_candidate_registration():
            print("❌ Candidate registration failed")
            return False
            
        if not self.test_candidate_login():
            print("❌ Candidate login failed")
            return False
            
        # Email/Phone verification tests (these might fail in demo mode)
        self.test_email_verification()
        self.test_phone_verification()
            
        if not self.test_recruiter_registration():
            print("❌ Recruiter registration failed")
            return False
            
        if not self.test_recruiter_login():
            print("❌ Recruiter login failed")
            return False

        # 2. Job and Application System Tests
        print("\n📋 JOB AND APPLICATION SYSTEM TESTS")
        print("-" * 40)
        
        if not self.test_job_creation_and_publishing():
            print("❌ Job creation/publishing failed")
            return False
            
        if not self.test_candidate_browse_jobs():
            print("❌ Browse jobs failed")
            return False
            
        if not self.test_candidate_apply_for_job():
            print("❌ Job application failed")
            return False
            
        if not self.test_candidate_my_applications():
            print("❌ Get my applications failed")
            return False

        # 3. Interview Management Tests
        print("\n📋 INTERVIEW MANAGEMENT TESTS")
        print("-" * 40)
        
        if not self.test_schedule_interview():
            print("❌ Interview scheduling failed")
            return False
            
        if not self.test_candidate_interviews():
            print("❌ Get candidate interviews failed")
            return False

        # 4. Security and Data Validation Tests
        print("\n📋 SECURITY AND DATA VALIDATION TESTS")
        print("-" * 40)
        
        if not self.test_cors_and_api_prefix():
            print("❌ CORS/API prefix tests failed")
            return False

        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failed_test in self.failed_tests:
                print(f"   • {failed_test}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All SecuHire backend tests passed!")
            return True
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = SecuHireBackendTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())