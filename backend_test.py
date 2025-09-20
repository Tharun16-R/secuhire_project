import requests
import sys
import json
from datetime import datetime
import time

class ATSBackendTester:
    def __init__(self, base_url="https://interview-shield-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.recruiter_id = None
        self.company_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_ids = {
            'jobs': [],
            'candidates': [],
            'applications': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    headers.pop('Content-Type', None)
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'id' in response_data:
                        print(f"   Created ID: {response_data['id']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_recruiter_registration(self):
        """Test recruiter registration with company creation"""
        test_data = {
            "email": f"test_recruiter_{int(time.time())}@testcompany.com",
            "password": "TestPass123!",
            "full_name": "Test Recruiter",
            "company_name": "Test ATS Company",
            "company_domain": "testats.com",
            "company_size": "11-50",
            "industry": "Technology"
        }
        
        success, response = self.run_test(
            "Recruiter Registration",
            "POST",
            "/auth/register",
            200,
            data=test_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.recruiter_id = response['recruiter']['id']
            self.company_id = response['company']['id']
            print(f"   Token: {self.token[:20]}...")
            print(f"   Recruiter ID: {self.recruiter_id}")
            print(f"   Company ID: {self.company_id}")
            return True
        return False

    def test_recruiter_login(self):
        """Test recruiter login"""
        # First register a new recruiter for login test
        email = f"login_test_{int(time.time())}@testcompany.com"
        register_data = {
            "email": email,
            "password": "LoginTest123!",
            "full_name": "Login Test Recruiter",
            "company_name": "Login Test Company",
            "company_domain": "logintest.com",
            "company_size": "1-10",
            "industry": "Healthcare"
        }
        
        # Register first
        requests.post(f"{self.api_url}/auth/register", json=register_data)
        
        # Now test login
        login_data = {
            "email": email,
            "password": "LoginTest123!"
        }
        
        success, response = self.run_test(
            "Recruiter Login",
            "POST",
            "/auth/login",
            200,
            data=login_data
        )
        
        return success and 'token' in response

    def test_job_creation(self):
        """Test job creation"""
        job_data = {
            "title": "Senior Full Stack Developer",
            "description": "We're looking for a senior developer to lead our frontend initiatives.",
            "requirements": ["React", "Node.js", "5+ years experience"],
            "location": "San Francisco, CA",
            "job_type": "Full-time",
            "salary_min": 120000,
            "salary_max": 180000,
            "skills": ["React", "Node.js", "JavaScript", "MongoDB"],
            "department": "Engineering",
            "experience_level": "Senior"
        }
        
        success, response = self.run_test(
            "Job Creation",
            "POST",
            "/jobs",
            200,
            data=job_data
        )
        
        if success and 'id' in response:
            self.created_ids['jobs'].append(response['id'])
            return response['id']
        return None

    def test_get_company_jobs(self):
        """Test getting company jobs"""
        success, response = self.run_test(
            "Get Company Jobs",
            "GET",
            "/jobs",
            200
        )
        
        if success:
            print(f"   Found {len(response)} jobs")
        return success

    def test_job_publishing(self, job_id):
        """Test job publishing"""
        if not job_id:
            print("❌ No job ID provided for publishing test")
            return False
            
        success, response = self.run_test(
            "Job Publishing",
            "POST",
            f"/jobs/{job_id}/publish",
            200
        )
        return success

    def test_candidate_creation(self):
        """Test candidate creation"""
        candidate_data = {
            "email": f"candidate_{int(time.time())}@email.com",
            "full_name": "John Developer",
            "phone": "+1234567890",
            "location": "San Francisco, CA",
            "current_title": "Senior Frontend Developer",
            "current_company": "TechCorp",
            "experience_years": 6,
            "skills": ["React", "JavaScript", "TypeScript", "Node.js"],
            "source": "linkedin"
        }
        
        success, response = self.run_test(
            "Candidate Creation",
            "POST",
            "/candidates",
            200,
            data=candidate_data
        )
        
        if success and 'id' in response:
            self.created_ids['candidates'].append(response['id'])
            return response['id']
        return None

    def test_get_candidates(self):
        """Test getting candidates with search and filters"""
        # Test basic get
        success, response = self.run_test(
            "Get All Candidates",
            "GET",
            "/candidates",
            200
        )
        
        if success:
            print(f"   Found {len(response)} candidates")
        
        # Test with search
        success2, response2 = self.run_test(
            "Search Candidates",
            "GET",
            "/candidates?search=John",
            200
        )
        
        # Test with skills filter
        success3, response3 = self.run_test(
            "Filter Candidates by Skills",
            "GET",
            "/candidates?skills=React,JavaScript",
            200
        )
        
        return success and success2 and success3

    def test_application_creation(self, job_id, candidate_id):
        """Test application creation"""
        if not job_id or not candidate_id:
            print("❌ Missing job_id or candidate_id for application test")
            return False
            
        success, response = self.run_test(
            "Application Creation",
            "POST",
            f"/applications?job_id={job_id}&candidate_id={candidate_id}",
            200
        )
        
        if success and 'id' in response:
            self.created_ids['applications'].append(response['id'])
            return response['id']
        return None

    def test_get_applications(self):
        """Test getting applications"""
        success, response = self.run_test(
            "Get All Applications",
            "GET",
            "/applications",
            200
        )
        
        if success:
            print(f"   Found {len(response)} applications")
        return success

    def test_application_stage_update(self, application_id):
        """Test updating application stage"""
        if not application_id:
            print("❌ No application ID provided for stage update test")
            return False
            
        success, response = self.run_test(
            "Update Application Stage",
            "PUT",
            f"/applications/{application_id}/stage?stage=screening",
            200
        )
        return success

    def test_notes_management(self, application_id):
        """Test adding and getting notes"""
        if not application_id:
            print("❌ No application ID provided for notes test")
            return False
            
        # Add note
        success1, response1 = self.run_test(
            "Add Application Note",
            "POST",
            f"/applications/{application_id}/notes?content=Great candidate, moving to next stage&note_type=general",
            200
        )
        
        # Get notes
        success2, response2 = self.run_test(
            "Get Application Notes",
            "GET",
            f"/applications/{application_id}/notes",
            200
        )
        
        if success2:
            print(f"   Found {len(response2)} notes")
        
        return success1 and success2

    def test_analytics_dashboard(self):
        """Test analytics dashboard"""
        success, response = self.run_test(
            "Analytics Dashboard",
            "GET",
            "/analytics/dashboard",
            200
        )
        
        if success:
            print(f"   Overview: {response.get('overview', {})}")
            print(f"   Pipeline: {response.get('pipeline', {})}")
            print(f"   Recent Activity: {response.get('recent_activity', {})}")
        
        return success

    def test_seed_data(self):
        """Test demo data seeding"""
        success, response = self.run_test(
            "Seed Demo Data",
            "POST",
            "/seed/data",
            200
        )
        return success

    def run_all_tests(self):
        """Run complete ATS backend test suite"""
        print("🚀 Starting RecruitPro ATS Backend Testing")
        print("=" * 50)
        
        # Authentication Tests
        print("\n📋 AUTHENTICATION TESTS")
        if not self.test_recruiter_registration():
            print("❌ Registration failed, stopping tests")
            return False
            
        if not self.test_recruiter_login():
            print("❌ Login test failed")
            return False

        # Job Management Tests
        print("\n📋 JOB MANAGEMENT TESTS")
        job_id = self.test_job_creation()
        if not job_id:
            print("❌ Job creation failed")
            return False
            
        if not self.test_get_company_jobs():
            print("❌ Get jobs failed")
            return False
            
        if not self.test_job_publishing(job_id):
            print("❌ Job publishing failed")
            return False

        # Candidate Management Tests
        print("\n📋 CANDIDATE MANAGEMENT TESTS")
        candidate_id = self.test_candidate_creation()
        if not candidate_id:
            print("❌ Candidate creation failed")
            return False
            
        if not self.test_get_candidates():
            print("❌ Get candidates failed")
            return False

        # Application & Pipeline Tests
        print("\n📋 APPLICATION & PIPELINE TESTS")
        application_id = self.test_application_creation(job_id, candidate_id)
        if not application_id:
            print("❌ Application creation failed")
            return False
            
        if not self.test_get_applications():
            print("❌ Get applications failed")
            return False
            
        if not self.test_application_stage_update(application_id):
            print("❌ Application stage update failed")
            return False

        # Notes Management Tests
        print("\n📋 NOTES MANAGEMENT TESTS")
        if not self.test_notes_management(application_id):
            print("❌ Notes management failed")
            return False

        # Analytics Tests
        print("\n📋 ANALYTICS TESTS")
        if not self.test_analytics_dashboard():
            print("❌ Analytics dashboard failed")
            return False

        # Seed Data Tests
        print("\n📋 SEED DATA TESTS")
        if not self.test_seed_data():
            print("❌ Seed data failed")
            return False

        # Print final results
        print("\n" + "=" * 50)
        print(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = ATSBackendTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())