import requests
import sys
import json
from datetime import datetime

class SecuHireAPITester:
    def __init__(self, base_url="https://interview-shield.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_email = f"test.candidate.{datetime.now().strftime('%H%M%S')}@example.com"

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Expected {expected_status}, got {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        registration_data = {
            "email": self.test_user_email,
            "password": "securepass123",
            "full_name": "Test Candidate",
            "phone": "+1-555-0123",
            "experience_years": 5,
            "skills": ["JavaScript", "React", "Python", "FastAPI", "MongoDB"]
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "/auth/register",
            200,
            data=registration_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   ✅ Token received: {self.token[:20]}...")
            print(f"   ✅ User ID: {self.user_id}")
            return True
        return False

    def test_duplicate_registration(self):
        """Test duplicate email registration prevention"""
        registration_data = {
            "email": self.test_user_email,  # Same email as before
            "password": "securepass123",
            "full_name": "Another Test User",
            "phone": "+1-555-0124",
            "experience_years": 3,
            "skills": ["Python", "Django"]
        }
        
        success, response = self.run_test(
            "Duplicate Registration Prevention",
            "POST",
            "/auth/register",
            400,  # Should fail with 400
            data=registration_data
        )
        return success

    def test_user_login(self):
        """Test user login"""
        login_data = {
            "email": self.test_user_email,
            "password": "securepass123"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "/auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            print(f"   ✅ Login token received: {self.token[:20]}...")
            return True
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        login_data = {
            "email": self.test_user_email,
            "password": "wrongpassword"
        }
        
        success, response = self.run_test(
            "Invalid Login",
            "POST",
            "/auth/login",
            401,  # Should fail with 401
            data=login_data
        )
        return success

    def test_seed_jobs(self):
        """Test seeding sample jobs"""
        success, response = self.run_test(
            "Seed Sample Jobs",
            "POST",
            "/seed/jobs",
            200
        )
        return success

    def test_get_jobs(self):
        """Test fetching all jobs"""
        success, response = self.run_test(
            "Get All Jobs",
            "GET",
            "/jobs",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} jobs")
            if len(response) > 0:
                self.sample_job_id = response[0]['id']
                print(f"   ✅ Sample job ID: {self.sample_job_id}")
            return True
        return False

    def test_get_specific_job(self):
        """Test fetching a specific job"""
        if not hasattr(self, 'sample_job_id'):
            print("   ⚠️ No sample job ID available, skipping test")
            return True
            
        success, response = self.run_test(
            "Get Specific Job",
            "GET",
            f"/jobs/{self.sample_job_id}",
            200
        )
        
        if success and 'id' in response:
            print(f"   ✅ Job details: {response['title']} at {response['company']}")
            return True
        return False

    def test_job_application(self):
        """Test applying for a job"""
        if not hasattr(self, 'sample_job_id'):
            print("   ⚠️ No sample job ID available, skipping test")
            return True
            
        cover_letter = """Dear Hiring Manager,

I am excited to apply for this position. With my experience in JavaScript, React, Python, FastAPI, and MongoDB, I believe I would be a great fit for your team.

I have 5 years of experience in software development and am passionate about building secure, scalable applications. I would love the opportunity to contribute to your organization.

Thank you for your consideration.

Best regards,
Test Candidate"""

        success, response = self.run_test(
            "Job Application",
            "POST",
            "/applications",
            200,
            params={
                "job_id": self.sample_job_id,
                "cover_letter": cover_letter
            }
        )
        
        if success and 'id' in response:
            self.application_id = response['id']
            print(f"   ✅ Application ID: {self.application_id}")
            return True
        return False

    def test_duplicate_application(self):
        """Test duplicate application prevention"""
        if not hasattr(self, 'sample_job_id'):
            print("   ⚠️ No sample job ID available, skipping test")
            return True
            
        success, response = self.run_test(
            "Duplicate Application Prevention",
            "POST",
            "/applications",
            400,  # Should fail with 400
            params={
                "job_id": self.sample_job_id,
                "cover_letter": "Another application"
            }
        )
        return success

    def test_get_my_applications(self):
        """Test fetching user's applications"""
        success, response = self.run_test(
            "Get My Applications",
            "GET",
            "/applications/my",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} applications")
            for app in response:
                if 'application' in app and 'job' in app:
                    print(f"   ✅ Application for: {app['job']['title']} - Status: {app['application']['status']}")
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Statistics",
            "GET",
            "/dashboard/stats",
            200
        )
        
        if success and isinstance(response, dict):
            stats = response
            print(f"   ✅ Total Applications: {stats.get('total_applications', 0)}")
            print(f"   ✅ Pending Applications: {stats.get('pending_applications', 0)}")
            print(f"   ✅ Scheduled Interviews: {stats.get('scheduled_interviews', 0)}")
            print(f"   ✅ Total Jobs: {stats.get('total_jobs', 0)}")
            return True
        return False

    def test_create_ai_session(self):
        """Test creating AI monitoring session"""
        if not hasattr(self, 'application_id'):
            print("   ⚠️ No application ID available, skipping test")
            return True
            
        success, response = self.run_test(
            "Create AI Monitoring Session",
            "POST",
            "/ai/sessions",
            200,
            params={"application_id": self.application_id}
        )
        
        if success and 'id' in response:
            self.session_id = response['id']
            print(f"   ✅ AI Session ID: {self.session_id}")
            print(f"   ✅ Session Status: {response.get('status', 'unknown')}")
            print(f"   ✅ AI Monitoring Enabled: {response.get('ai_monitoring_enabled', False)}")
            return True
        return False

    def test_get_session_analysis(self):
        """Test getting AI session analysis"""
        if not hasattr(self, 'session_id'):
            print("   ⚠️ No session ID available, skipping test")
            return True
            
        success, response = self.run_test(
            "Get AI Session Analysis",
            "GET",
            f"/ai/sessions/{self.session_id}/analysis",
            200
        )
        
        if success:
            print(f"   ✅ Total Analyses: {response.get('total_analyses', 0)}")
            if 'average_scores' in response:
                scores = response['average_scores']
                print(f"   ✅ Avg Facial Score: {scores.get('facial_expression_score', 0):.1f}")
                print(f"   ✅ Avg Eye Movement: {scores.get('eye_movement_score', 0):.1f}")
                print(f"   ✅ Avg Behavioral: {scores.get('behavioral_score', 0):.1f}")
                print(f"   ✅ Avg Authenticity: {scores.get('authenticity_confidence', 0):.1f}")
            print(f"   ✅ Overall Risk: {response.get('overall_risk', 'Unknown')}")
            return True
        return False

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access Test",
            "GET",
            "/dashboard/stats",
            401  # Should fail with 401
        )
        
        # Restore token
        self.token = original_token
        return success

    def test_invalid_job_application(self):
        """Test applying for non-existent job"""
        fake_job_id = "non-existent-job-id-12345"
        
        success, response = self.run_test(
            "Invalid Job Application",
            "POST",
            "/applications",
            404,  # Should fail with 404
            params={
                "job_id": fake_job_id,
                "cover_letter": "Test application for non-existent job"
            }
        )
        return success

    def test_invalid_ai_session(self):
        """Test creating AI session for non-existent application"""
        fake_app_id = "non-existent-app-id-12345"
        
        success, response = self.run_test(
            "Invalid AI Session Creation",
            "POST",
            "/ai/sessions",
            404,  # Should fail with 404
            params={"application_id": fake_app_id}
        )
        return success

def main():
    print("🚀 Starting SecuHire API Testing...")
    print("=" * 60)
    
    tester = SecuHireAPITester()
    
    # Test sequence
    tests = [
        ("User Registration", tester.test_user_registration),
        ("Duplicate Registration Prevention", tester.test_duplicate_registration),
        ("User Login", tester.test_user_login),
        ("Invalid Login", tester.test_invalid_login),
        ("Seed Sample Jobs", tester.test_seed_jobs),
        ("Get All Jobs", tester.test_get_jobs),
        ("Get Specific Job", tester.test_get_specific_job),
        ("Job Application", tester.test_job_application),
        ("Duplicate Application Prevention", tester.test_duplicate_application),
        ("Get My Applications", tester.test_get_my_applications),
        ("Dashboard Statistics", tester.test_dashboard_stats),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS")
    print("=" * 60)
    print(f"✅ Tests Passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"❌ Tests Failed: {len(failed_tests)}")
    
    if failed_tests:
        print("\n🔴 Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n🎉 All tests passed!")
    
    print(f"\n📧 Test User Email: {tester.test_user_email}")
    if tester.token:
        print(f"🔑 Auth Token: {tester.token[:30]}...")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())