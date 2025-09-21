#!/usr/bin/env python3
"""
Targeted test for candidate application endpoint to fix "[object Object]" error
Focus: POST /api/candidates/applications with JSON payload
"""

import requests
import json
import sys
import time
import uuid

class CandidateApplicationTester:
    def __init__(self, base_url="https://interview-shield-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.candidate_token = None
        self.recruiter_token = None
        self.job_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def setup_test_data(self):
        """Setup candidate, recruiter, and job for testing"""
        print("🔧 Setting up test data...")
        
        # 1. Register recruiter and create job
        timestamp = int(time.time())
        recruiter_data = {
            "email": f"test_recruiter_{timestamp}@secuhire.com",
            "password": "TestPass123!",
            "full_name": "Test Recruiter",
            "company_name": "Test Company",
            "company_domain": "testcompany.com",
            "company_size": "11-50",
            "industry": "Technology"
        }
        
        try:
            response = requests.post(f"{self.api_url}/recruiters/auth/register", json=recruiter_data)
            if response.status_code == 200:
                data = response.json()
                self.recruiter_token = data['token']
                print(f"   ✅ Recruiter registered: {data['user']['email']}")
            else:
                print(f"   ❌ Recruiter registration failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Recruiter registration error: {str(e)}")
            return False

        # 2. Create and publish job
        job_data = {
            "title": "Test Software Engineer",
            "description": "Test job for application testing",
            "requirements": ["Python", "Testing"],
            "location": "Remote",
            "job_type": "Full-time",
            "salary_min": 80000,
            "salary_max": 120000,
            "skills": ["Python", "Testing"],
            "department": "Engineering",
            "experience_level": "Mid"
        }
        
        try:
            headers = {'Authorization': f'Bearer {self.recruiter_token}', 'Content-Type': 'application/json'}
            response = requests.post(f"{self.api_url}/jobs", json=job_data, headers=headers)
            if response.status_code == 200:
                job = response.json()
                self.job_id = job['id']
                print(f"   ✅ Job created: {job['title']}")
                
                # Publish the job
                publish_response = requests.post(f"{self.api_url}/jobs/{self.job_id}/publish", headers=headers)
                if publish_response.status_code == 200:
                    print(f"   ✅ Job published successfully")
                else:
                    print(f"   ❌ Job publishing failed: {publish_response.status_code}")
                    return False
            else:
                print(f"   ❌ Job creation failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Job creation error: {str(e)}")
            return False

        # 3. Register candidate
        candidate_data = {
            "email": f"test_candidate_{timestamp}@secuhire.com",
            "password": "TestPass123!",
            "full_name": "Test Candidate",
            "phone": "+1234567890",
            "location": "San Francisco, CA",
            "current_title": "Software Engineer",
            "current_company": "Tech Corp",
            "experience_years": 3,
            "education": "BS Computer Science",
            "skills": ["Python", "JavaScript", "React"]
        }
        
        try:
            response = requests.post(f"{self.api_url}/candidates/auth/register", json=candidate_data)
            if response.status_code == 200:
                data = response.json()
                self.candidate_token = data['token']
                print(f"   ✅ Candidate registered: {data['user']['email']}")
                return True
            else:
                print(f"   ❌ Candidate registration failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Candidate registration error: {str(e)}")
            return False

    def test_application_with_json_payload(self):
        """Test POST /api/candidates/applications with JSON payload (correct format)"""
        print("\n🔍 Testing candidate application with JSON payload...")
        self.tests_run += 1
        
        # Test data as specified in the review request
        application_data = {
            "job_id": self.job_id,
            "cover_letter": "I am very interested in this position. My experience with Python and testing makes me a great fit for this role. I am excited about the opportunity to contribute to your team."
        }
        
        headers = {
            'Authorization': f'Bearer {self.candidate_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.post(f"{self.api_url}/candidates/applications", 
                                   json=application_data, 
                                   headers=headers)
            
            print(f"   Status Code: {response.status_code}")
            print(f"   Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    print(f"   ✅ SUCCESS: Application submitted successfully")
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    
                    # Validate response structure
                    if 'application' in response_data and 'message' in response_data:
                        application = response_data['application']
                        if 'id' in application and 'job_id' in application and 'cover_letter' in application:
                            print(f"   ✅ Response structure is valid")
                            print(f"   Application ID: {application['id']}")
                            self.tests_passed += 1
                            return True
                        else:
                            print(f"   ❌ Invalid application structure in response")
                            self.failed_tests.append("Invalid application structure")
                            return False
                    else:
                        print(f"   ❌ Missing required fields in response")
                        self.failed_tests.append("Missing required response fields")
                        return False
                        
                except json.JSONDecodeError as e:
                    print(f"   ❌ FAILED: Response is not valid JSON - {str(e)}")
                    print(f"   Raw response: {response.text}")
                    self.failed_tests.append("Invalid JSON response")
                    return False
            else:
                print(f"   ❌ FAILED: Expected 200, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error details: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Raw error response: {response.text}")
                self.failed_tests.append(f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ FAILED: Exception occurred - {str(e)}")
            self.failed_tests.append(f"Exception: {str(e)}")
            return False

    def test_application_missing_job_id(self):
        """Test application with missing job_id (should return proper error)"""
        print("\n🔍 Testing application with missing job_id...")
        self.tests_run += 1
        
        application_data = {
            "cover_letter": "Sample cover letter without job_id"
        }
        
        headers = {
            'Authorization': f'Bearer {self.candidate_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.post(f"{self.api_url}/candidates/applications", 
                                   json=application_data, 
                                   headers=headers)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 422:  # Unprocessable Entity for validation error
                try:
                    error_data = response.json()
                    print(f"   ✅ SUCCESS: Proper validation error returned")
                    print(f"   Error response: {json.dumps(error_data, indent=2)}")
                    self.tests_passed += 1
                    return True
                except json.JSONDecodeError:
                    print(f"   ❌ FAILED: Error response is not valid JSON")
                    print(f"   Raw response: {response.text}")
                    self.failed_tests.append("Invalid JSON error response")
                    return False
            else:
                print(f"   ❌ FAILED: Expected 422, got {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                except:
                    print(f"   Raw response: {response.text}")
                self.failed_tests.append(f"Wrong status code: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ FAILED: Exception occurred - {str(e)}")
            self.failed_tests.append(f"Exception: {str(e)}")
            return False

    def test_application_missing_cover_letter(self):
        """Test application with missing cover_letter (should return proper error)"""
        print("\n🔍 Testing application with missing cover_letter...")
        self.tests_run += 1
        
        application_data = {
            "job_id": self.job_id
        }
        
        headers = {
            'Authorization': f'Bearer {self.candidate_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.post(f"{self.api_url}/candidates/applications", 
                                   json=application_data, 
                                   headers=headers)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 422:  # Unprocessable Entity for validation error
                try:
                    error_data = response.json()
                    print(f"   ✅ SUCCESS: Proper validation error returned")
                    print(f"   Error response: {json.dumps(error_data, indent=2)}")
                    self.tests_passed += 1
                    return True
                except json.JSONDecodeError:
                    print(f"   ❌ FAILED: Error response is not valid JSON")
                    print(f"   Raw response: {response.text}")
                    self.failed_tests.append("Invalid JSON error response")
                    return False
            else:
                print(f"   ❌ FAILED: Expected 422, got {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                except:
                    print(f"   Raw response: {response.text}")
                self.failed_tests.append(f"Wrong status code: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ FAILED: Exception occurred - {str(e)}")
            self.failed_tests.append(f"Exception: {str(e)}")
            return False

    def test_application_invalid_job_id(self):
        """Test application with invalid job_id (should return proper error)"""
        print("\n🔍 Testing application with invalid job_id...")
        self.tests_run += 1
        
        application_data = {
            "job_id": "invalid-job-id-12345",
            "cover_letter": "Sample cover letter with invalid job_id"
        }
        
        headers = {
            'Authorization': f'Bearer {self.candidate_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.post(f"{self.api_url}/candidates/applications", 
                                   json=application_data, 
                                   headers=headers)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 404:  # Not Found for invalid job
                try:
                    error_data = response.json()
                    print(f"   ✅ SUCCESS: Proper error returned for invalid job_id")
                    print(f"   Error response: {json.dumps(error_data, indent=2)}")
                    self.tests_passed += 1
                    return True
                except json.JSONDecodeError:
                    print(f"   ❌ FAILED: Error response is not valid JSON")
                    print(f"   Raw response: {response.text}")
                    self.failed_tests.append("Invalid JSON error response")
                    return False
            else:
                print(f"   ❌ FAILED: Expected 404, got {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                except:
                    print(f"   Raw response: {response.text}")
                self.failed_tests.append(f"Wrong status code: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ FAILED: Exception occurred - {str(e)}")
            self.failed_tests.append(f"Exception: {str(e)}")
            return False

    def test_duplicate_application(self):
        """Test duplicate application (should return proper error)"""
        print("\n🔍 Testing duplicate application...")
        self.tests_run += 1
        
        application_data = {
            "job_id": self.job_id,
            "cover_letter": "Duplicate application test"
        }
        
        headers = {
            'Authorization': f'Bearer {self.candidate_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.post(f"{self.api_url}/candidates/applications", 
                                   json=application_data, 
                                   headers=headers)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 400:  # Bad Request for duplicate application
                try:
                    error_data = response.json()
                    print(f"   ✅ SUCCESS: Proper error returned for duplicate application")
                    print(f"   Error response: {json.dumps(error_data, indent=2)}")
                    self.tests_passed += 1
                    return True
                except json.JSONDecodeError:
                    print(f"   ❌ FAILED: Error response is not valid JSON")
                    print(f"   Raw response: {response.text}")
                    self.failed_tests.append("Invalid JSON error response")
                    return False
            else:
                print(f"   ❌ FAILED: Expected 400, got {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                except:
                    print(f"   Raw response: {response.text}")
                self.failed_tests.append(f"Wrong status code: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ FAILED: Exception occurred - {str(e)}")
            self.failed_tests.append(f"Exception: {str(e)}")
            return False

    def run_targeted_tests(self):
        """Run targeted tests for candidate application endpoint"""
        print("🎯 TARGETED CANDIDATE APPLICATION ENDPOINT TESTING")
        print("=" * 60)
        print("Focus: Fix '[object Object]' error in candidate applications")
        print()
        
        # Setup test data
        if not self.setup_test_data():
            print("❌ Failed to setup test data")
            return False
        
        # Run targeted tests
        print("\n📋 CANDIDATE APPLICATION TESTS")
        print("-" * 40)
        
        # Test 1: Successful application with JSON payload
        success1 = self.test_application_with_json_payload()
        
        # Test 2: Missing job_id validation
        success2 = self.test_application_missing_job_id()
        
        # Test 3: Missing cover_letter validation
        success3 = self.test_application_missing_cover_letter()
        
        # Test 4: Invalid job_id handling
        success4 = self.test_application_invalid_job_id()
        
        # Test 5: Duplicate application handling
        success5 = self.test_duplicate_application()
        
        # Print results
        print("\n" + "=" * 60)
        print(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failed_test in self.failed_tests:
                print(f"   • {failed_test}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All candidate application tests passed!")
            print("✅ The '[object Object]' error should be resolved!")
            return True
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            print("⚠️  The '[object Object]' error may still exist")
            return False

def main():
    tester = CandidateApplicationTester()
    success = tester.run_targeted_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())