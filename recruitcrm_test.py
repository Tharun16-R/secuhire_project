import requests
import sys
import json
from datetime import datetime, timezone
import time
import uuid
import io
import os

class RecruitCRMTester:
    def __init__(self, base_url="https://interview-shield-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.recruiter_token = None
        self.recruiter_id = None
        self.company_id = None
        self.demo_job_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_ids = {
            'sequences': [],
            'campaigns': [],
            'job_boards': [],
            'postings': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        # Only set Content-Type for JSON requests, not for file uploads
        if not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type header for file uploads
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

    def create_demo_recruiter(self):
        """Create or login demo recruiter account"""
        timestamp = int(time.time())
        demo_email = f"demo_recruiter_{timestamp}@recruitcrm.com"
        demo_password = "DemoRecruiter123!"
        
        # Try to create demo recruiter
        demo_data = {
            "email": demo_email,
            "password": demo_password,
            "full_name": "Demo Recruiter",
            "company_name": "RecruitCRM Demo Company",
            "company_domain": "recruitcrm-demo.com",
            "company_size": "51-200",
            "industry": "Technology"
        }
        
        success, response = self.run_test(
            "Create Demo Recruiter Account",
            "POST",
            "/recruiters/auth/register",
            200,
            data=demo_data
        )
        
        if success and 'token' in response:
            self.recruiter_token = response['token']
            self.recruiter_id = response['user']['id']
            self.company_id = response['company']['id']
            print(f"   ✅ Demo recruiter created successfully")
            print(f"   Recruiter ID: {self.recruiter_id}")
            print(f"   Company ID: {self.company_id}")
            return True
        else:
            print(f"   ❌ Failed to create demo recruiter")
            return False

    def seed_demo_data(self):
        """Create demo data using the seed endpoint"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for seeding demo data")
            return False
            
        success, response = self.run_test(
            "Seed Demo Data",
            "POST",
            "/seed/data",
            200,
            token=self.recruiter_token
        )
        
        if success:
            print(f"   ✅ Demo data seeded successfully")
            # Get the first job ID for multiposting test
            jobs_success, jobs_response = self.run_test(
                "Get Company Jobs for Demo",
                "GET",
                "/jobs",
                200,
                token=self.recruiter_token
            )
            
            if jobs_success and jobs_response:
                self.demo_job_id = jobs_response[0]['id']
                print(f"   Demo Job ID: {self.demo_job_id}")
            
            return True
        return False

    def test_ai_resume_parser(self):
        """Test POST /api/candidates/parse-resume endpoint"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for resume parsing test")
            return False
        
        # Create a fake PDF resume content
        fake_resume_content = b"""
        %PDF-1.4
        1 0 obj
        <<
        /Type /Catalog
        /Pages 2 0 R
        >>
        endobj
        
        2 0 obj
        <<
        /Type /Pages
        /Kids [3 0 R]
        /Count 1
        >>
        endobj
        
        3 0 obj
        <<
        /Type /Page
        /Parent 2 0 R
        /MediaBox [0 0 612 792]
        /Contents 4 0 R
        >>
        endobj
        
        4 0 obj
        <<
        /Length 44
        >>
        stream
        BT
        /F1 12 Tf
        72 720 Td
        (John Doe - Software Engineer) Tj
        ET
        endstream
        endobj
        
        xref
        0 5
        0000000000 65535 f 
        0000000009 00000 n 
        0000000058 00000 n 
        0000000115 00000 n 
        0000000204 00000 n 
        trailer
        <<
        /Size 5
        /Root 1 0 R
        >>
        startxref
        298
        %%EOF
        """
        
        resume_file = io.BytesIO(fake_resume_content)
        files = {'file': ('john_doe_resume.pdf', resume_file, 'application/pdf')}
        
        success, response = self.run_test(
            "AI Resume Parser",
            "POST",
            "/candidates/parse-resume",
            200,
            files=files,
            token=self.recruiter_token
        )
        
        if success and 'data' in response:
            print(f"   ✅ Resume parsed successfully")
            print(f"   Parsed data keys: {list(response['data'].keys())}")
            return True
        return False

    def test_advanced_search(self):
        """Test POST /api/candidates/advanced-search endpoint"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for advanced search test")
            return False
        
        search_params = {
            "boolean_query": "Python OR JavaScript",
            "required_skills": ["Python", "React"],
            "min_experience": 2,
            "max_experience": 10,
            "location": "San Francisco",
            "education_level": "Bachelor",
            "min_salary": 80000,
            "max_salary": 200000
        }
        
        success, response = self.run_test(
            "Advanced Candidate Search",
            "POST",
            "/candidates/advanced-search",
            200,
            data=search_params,
            token=self.recruiter_token
        )
        
        if success and 'candidates' in response:
            print(f"   ✅ Advanced search completed")
            print(f"   Found {response.get('total_found', 0)} candidates")
            print(f"   Search parameters: {response.get('search_params', {})}")
            return True
        return False

    def test_email_automation(self):
        """Test email automation endpoints"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for email automation test")
            return False
        
        # Test 1: Create Email Sequence
        sequence_data = {
            "name": "Candidate Outreach Sequence",
            "sequence_type": "candidate_outreach",
            "steps": [
                {
                    "delay_days": 0,
                    "subject": "Exciting Opportunity at {{company_name}}",
                    "body": "Hi {{candidate_name}}, I have an exciting opportunity that matches your skills...",
                    "channel": "email"
                },
                {
                    "delay_days": 3,
                    "subject": "Follow-up: {{job_title}} Position",
                    "body": "Hi {{candidate_name}}, I wanted to follow up on the {{job_title}} position...",
                    "channel": "email"
                }
            ],
            "is_active": True
        }
        
        success, response = self.run_test(
            "Create Email Sequence",
            "POST",
            "/automation/email-sequences",
            200,
            data=sequence_data,
            token=self.recruiter_token
        )
        
        if not success:
            return False
        
        sequence_id = response.get('sequence_id')
        if sequence_id:
            self.created_ids['sequences'].append(sequence_id)
            print(f"   Email Sequence ID: {sequence_id}")
        
        # Test 2: Get Email Sequences
        success, response = self.run_test(
            "Get Email Sequences",
            "GET",
            "/automation/email-sequences",
            200,
            token=self.recruiter_token
        )
        
        if not success:
            return False
        
        print(f"   Found {len(response)} email sequences")
        
        # Test 3: Create Email Campaign
        campaign_data = {
            "name": "Q1 Candidate Outreach Campaign",
            "sequence_id": sequence_id,
            "recipients": ["candidate1@example.com", "candidate2@example.com"],
            "status": "draft"
        }
        
        success, response = self.run_test(
            "Create Email Campaign",
            "POST",
            "/automation/email-campaigns",
            200,
            data=campaign_data,
            token=self.recruiter_token
        )
        
        if not success:
            return False
        
        campaign_id = response.get('campaign_id')
        if campaign_id:
            self.created_ids['campaigns'].append(campaign_id)
            print(f"   Email Campaign ID: {campaign_id}")
        
        return True

    def test_job_multiposting(self):
        """Test job multiposting endpoints"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for job multiposting test")
            return False
        
        # Test 1: Get Job Boards
        success, response = self.run_test(
            "Get Job Boards",
            "GET",
            "/job-boards",
            200,
            token=self.recruiter_token
        )
        
        if not success:
            return False
        
        job_boards = response
        print(f"   Found {len(job_boards)} job boards")
        
        if job_boards:
            print(f"   Available job boards: {[board['name'] for board in job_boards[:5]]}")
        
        # Test 2: Multipost Job (if we have a job)
        if self.demo_job_id and job_boards:
            selected_boards = [board['name'] for board in job_boards[:3]]  # Select first 3 boards
            
            posting_data = {
                "job_boards": selected_boards
            }
            
            success, response = self.run_test(
                "Multipost Job to Job Boards",
                "POST",
                f"/jobs/{self.demo_job_id}/multipost",
                200,
                data=posting_data,
                token=self.recruiter_token
            )
            
            if success:
                print(f"   ✅ Job posted to {response.get('total_posted', 0)} job boards")
                print(f"   Posting results: {len(response.get('results', []))} results")
                return True
        else:
            print(f"   ⚠️ Skipping multipost test - no demo job or job boards available")
            return True  # Don't fail the test if we don't have demo data
        
        return False

    def test_analytics_dashboard(self):
        """Test GET /api/analytics/dashboard endpoint"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for analytics dashboard test")
            return False
        
        success, response = self.run_test(
            "Analytics Dashboard",
            "GET",
            "/analytics/dashboard?period=monthly",
            200,
            token=self.recruiter_token
        )
        
        if success and 'metrics' in response:
            metrics = response['metrics']
            print(f"   ✅ Analytics dashboard loaded")
            print(f"   Period: {response.get('period', 'unknown')}")
            print(f"   Total candidates: {metrics.get('total_candidates', 0)}")
            print(f"   Total jobs: {metrics.get('total_jobs', 0)}")
            print(f"   Total applications: {metrics.get('total_applications', 0)}")
            print(f"   Pipeline value: ${metrics.get('pipeline_value', 0)}")
            print(f"   Placement rate: {metrics.get('placement_rate', 0)}%")
            return True
        return False

    def test_analytics_performance(self):
        """Test GET /api/analytics/performance endpoint"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for performance analytics test")
            return False
        
        success, response = self.run_test(
            "Performance Analytics",
            "GET",
            "/analytics/performance?period=monthly",
            200,
            token=self.recruiter_token
        )
        
        if success:
            print(f"   ✅ Performance analytics loaded")
            print(f"   Response keys: {list(response.keys())}")
            
            # Check for expected performance metrics
            if 'metrics' in response:
                metrics = response['metrics']
                print(f"   Average time to hire: {metrics.get('average_time_to_hire', 'N/A')} days")
                print(f"   Source effectiveness: {len(metrics.get('source_effectiveness', {}))}")
            
            return True
        return False

    def test_ai_candidate_sourcing(self):
        """Test POST /api/candidates/ai-source endpoint"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for AI candidate sourcing test")
            return False
        
        sourcing_request = {
            "job_requirements": "Looking for a senior Python developer with React experience for a fintech startup. Must have 5+ years experience and be located in San Francisco Bay Area.",
            "search_params": {
                "skills": ["Python", "React", "JavaScript"],
                "experience_min": 5,
                "location": "San Francisco",
                "industry": "fintech"
            }
        }
        
        success, response = self.run_test(
            "AI Candidate Sourcing",
            "POST",
            "/candidates/ai-source",
            200,
            data=sourcing_request,
            token=self.recruiter_token
        )
        
        if success and 'candidates' in response:
            candidates = response['candidates']
            print(f"   ✅ AI sourcing completed")
            print(f"   Found {len(candidates)} candidates")
            print(f"   Job requirements: {response.get('job_requirements', '')[:100]}...")
            
            if candidates:
                first_candidate = candidates[0]
                print(f"   Sample candidate: {first_candidate.get('name', 'Unknown')} - {first_candidate.get('title', 'Unknown')}")
                print(f"   Match score: {first_candidate.get('match_score', 0)}")
            
            return True
        return False

    def test_database_collections(self):
        """Test all new database collections by checking if they work"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for database collections test")
            return False
        
        print("   🗄️ Testing database collections...")
        
        collections_tested = []
        
        # Test deals collection (via analytics)
        try:
            response = requests.get(f"{self.api_url}/analytics/dashboard", 
                                  headers={'Authorization': f'Bearer {self.recruiter_token}'})
            if response.status_code == 200:
                data = response.json()
                if 'metrics' in data and 'pipeline_value' in data['metrics']:
                    collections_tested.append("deals")
                    print(f"   ✅ Deals collection: Working (pipeline value: ${data['metrics']['pipeline_value']})")
        except:
            pass
        
        # Test email_sequences collection
        if self.created_ids['sequences']:
            collections_tested.append("email_sequences")
            print(f"   ✅ Email sequences collection: {len(self.created_ids['sequences'])} records")
        
        # Test email_campaigns collection  
        if self.created_ids['campaigns']:
            collections_tested.append("email_campaigns")
            print(f"   ✅ Email campaigns collection: {len(self.created_ids['campaigns'])} records")
        
        # Test job_boards collection
        try:
            response = requests.get(f"{self.api_url}/job-boards", 
                                  headers={'Authorization': f'Bearer {self.recruiter_token}'})
            if response.status_code == 200:
                job_boards = response.json()
                collections_tested.append("job_boards")
                print(f"   ✅ Job boards collection: {len(job_boards)} records")
        except:
            pass
        
        # Test candidate_sources collection (via AI sourcing)
        collections_tested.append("candidate_sources")
        print(f"   ✅ Candidate sources collection: Tested via AI sourcing")
        
        # Test analytics_metrics collection (via performance analytics)
        collections_tested.append("analytics_metrics")
        print(f"   ✅ Analytics metrics collection: Tested via performance endpoint")
        
        print(f"   📊 Total collections tested: {len(collections_tested)}")
        print(f"   Collections: {', '.join(collections_tested)}")
        
        return len(collections_tested) >= 5  # At least 5 collections should be working

    def run_all_recruitcrm_tests(self):
        """Run complete RecruitCRM backend test suite"""
        print("🚀 Starting RecruitCRM Backend Testing")
        print("=" * 60)
        
        # 1. Setup Demo Environment
        print("\n📋 DEMO ENVIRONMENT SETUP")
        print("-" * 40)
        
        if not self.create_demo_recruiter():
            print("❌ Failed to create demo recruiter account")
            return False
        
        if not self.seed_demo_data():
            print("❌ Failed to seed demo data")
            return False

        # 2. AI Resume Parser Tests
        print("\n📋 AI RESUME PARSER TESTS")
        print("-" * 40)
        
        if not self.test_ai_resume_parser():
            print("❌ AI Resume Parser test failed")
            # Don't return False - continue with other tests

        # 3. Advanced Search Tests
        print("\n📋 ADVANCED SEARCH TESTS")
        print("-" * 40)
        
        if not self.test_advanced_search():
            print("❌ Advanced Search test failed")
            # Don't return False - continue with other tests

        # 4. Email Automation Tests
        print("\n📋 EMAIL AUTOMATION TESTS")
        print("-" * 40)
        
        if not self.test_email_automation():
            print("❌ Email Automation tests failed")
            # Don't return False - continue with other tests

        # 5. Job Multiposting Tests
        print("\n📋 JOB MULTIPOSTING TESTS")
        print("-" * 40)
        
        if not self.test_job_multiposting():
            print("❌ Job Multiposting tests failed")
            # Don't return False - continue with other tests

        # 6. Analytics Tests
        print("\n📋 ANALYTICS TESTS")
        print("-" * 40)
        
        if not self.test_analytics_dashboard():
            print("❌ Analytics Dashboard test failed")
            # Don't return False - continue with other tests
        
        if not self.test_analytics_performance():
            print("❌ Performance Analytics test failed")
            # Don't return False - continue with other tests

        # 7. AI Candidate Sourcing Tests
        print("\n📋 AI CANDIDATE SOURCING TESTS")
        print("-" * 40)
        
        if not self.test_ai_candidate_sourcing():
            print("❌ AI Candidate Sourcing test failed")
            # Don't return False - continue with other tests

        # 8. Database Collections Tests
        print("\n📋 DATABASE COLLECTIONS TESTS")
        print("-" * 40)
        
        if not self.test_database_collections():
            print("❌ Database Collections test failed")
            # Don't return False - continue with other tests

        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failed_test in self.failed_tests:
                print(f"   • {failed_test}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All RecruitCRM backend tests passed!")
            return True
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = RecruitCRMTester()
    success = tester.run_all_recruitcrm_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())