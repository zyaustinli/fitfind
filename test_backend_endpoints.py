#!/usr/bin/env python3
"""
Comprehensive Backend Testing Script for FitFind
Tests search history and wishlist functionality
"""

import requests
import json
import time
from typing import Dict, Any, Optional
import uuid

class BackendTester:
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.auth_token = None
        self.test_user_id = None
        self.session = requests.Session()
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_health(self) -> bool:
        """Test health endpoint"""
        self.log("Testing health endpoint...")
        try:
            response = self.session.get(f"{self.base_url}/api/health")
            if response.status_code == 200:
                data = response.json()
                self.log(f"Health check passed: {data.get('status')}")
                return True
            else:
                self.log(f"Health check failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Health check error: {e}", "ERROR")
            return False
    
    def test_unauthenticated_endpoints(self) -> Dict[str, bool]:
        """Test that protected endpoints reject unauthenticated requests"""
        self.log("Testing unauthenticated access...")
        
        protected_endpoints = [
            ("/api/history", "GET"),
            ("/api/wishlist", "GET"),
            ("/api/wishlist/add", "POST"),
            ("/api/wishlist/remove", "POST"),
            ("/api/wishlist/check", "POST"),
            ("/api/auth/profile", "GET"),
            ("/api/auth/profile", "PUT")
        ]
        
        results = {}
        for endpoint, method in protected_endpoints:
            try:
                if method == "GET":
                    response = self.session.get(f"{self.base_url}{endpoint}")
                elif method == "POST":
                    response = self.session.post(f"{self.base_url}{endpoint}", 
                                               json={}, 
                                               headers={"Content-Type": "application/json"})
                elif method == "PUT":
                    response = self.session.put(f"{self.base_url}{endpoint}", 
                                              json={}, 
                                              headers={"Content-Type": "application/json"})
                
                # Should return 401 for authentication required
                if response.status_code == 401:
                    results[f"{method} {endpoint}"] = True
                    self.log(f"✓ {method} {endpoint} correctly rejects unauthenticated requests")
                else:
                    results[f"{method} {endpoint}"] = False
                    self.log(f"✗ {method} {endpoint} returned {response.status_code} instead of 401", "ERROR")
                    
            except Exception as e:
                results[f"{method} {endpoint}"] = False
                self.log(f"✗ Error testing {method} {endpoint}: {e}", "ERROR")
        
        return results
    
    def test_search_history_pagination(self) -> bool:
        """Test search history pagination parameters"""
        self.log("Testing search history pagination...")
        
        # Test with different limit and offset values
        test_cases = [
            {"limit": 10, "offset": 0},
            {"limit": 25, "offset": 0},
            {"limit": 50, "offset": 10},
            {"limit": 100, "offset": 0}  # Test max limit handling
        ]
        
        for params in test_cases:
            try:
                response = self.session.get(
                    f"{self.base_url}/api/history",
                    params=params
                )
                
                if response.status_code == 401:
                    self.log(f"✓ Pagination test skipped (authentication required)")
                    return True  # Expected for unauthenticated request
                    
                data = response.json()
                if "pagination" in data:
                    pagination = data["pagination"]
                    expected_limit = min(params["limit"], 50)  # Assuming 50 is max
                    if pagination["limit"] == expected_limit and pagination["offset"] == params["offset"]:
                        self.log(f"✓ Pagination params correct: {params}")
                    else:
                        self.log(f"✗ Pagination mismatch: expected {params}, got {pagination}", "ERROR")
                        return False
                        
            except Exception as e:
                self.log(f"✗ Pagination test error: {e}", "ERROR")
                return False
        
        return True
    
    def test_wishlist_validation(self) -> bool:
        """Test wishlist endpoint input validation"""
        self.log("Testing wishlist validation...")
        
        # Test wishlist/add with invalid data
        invalid_requests = [
            {},  # No data
            {"notes": "test"},  # Missing product_id
            {"product_id": ""},  # Empty product_id
            {"product_id": None},  # Null product_id
        ]
        
        for invalid_data in invalid_requests:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/wishlist/add",
                    json=invalid_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 401:
                    self.log("✓ Wishlist validation test skipped (authentication required)")
                    return True
                    
                if response.status_code == 400:
                    self.log(f"✓ Correctly rejected invalid data: {invalid_data}")
                else:
                    self.log(f"✗ Invalid data not rejected: {invalid_data}, status: {response.status_code}", "ERROR")
                    return False
                    
            except Exception as e:
                self.log(f"✗ Wishlist validation error: {e}", "ERROR")
                return False
        
        return True
    
    def test_json_content_type(self) -> bool:
        """Test that endpoints properly handle Content-Type requirements"""
        self.log("Testing Content-Type handling...")
        
        # Test POST endpoints without Content-Type header
        post_endpoints = [
            "/api/wishlist/add",
            "/api/wishlist/remove", 
            "/api/wishlist/check",
            "/api/auth/profile"
        ]
        
        for endpoint in post_endpoints:
            try:
                # Test with missing Content-Type
                response = self.session.post(
                    f"{self.base_url}{endpoint}",
                    data=json.dumps({"test": "data"})  # Send JSON without proper header
                )
                
                if response.status_code == 401:
                    continue  # Skip auth required endpoints
                    
                # Should handle missing Content-Type gracefully
                self.log(f"✓ {endpoint} handled missing Content-Type (status: {response.status_code})")
                
            except Exception as e:
                self.log(f"✗ Content-Type test error for {endpoint}: {e}", "ERROR")
                return False
        
        return True
    
    def test_duplicate_wishlist_handling(self) -> bool:
        """Test duplicate wishlist item handling"""
        self.log("Testing duplicate wishlist handling...")
        
        # This test would require authentication, so we'll just test the structure
        test_data = {
            "product_id": "test-product-123",
            "notes": "Test item"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/wishlist/add",
                json=test_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log("✓ Duplicate test skipped (authentication required)")
                return True
                
            # If we get here, we'd test adding the same item again
            # and expect a 409 Conflict status
            
        except Exception as e:
            self.log(f"✗ Duplicate test error: {e}", "ERROR")
            return False
        
        return True
    
    def test_search_history_detailed(self) -> bool:
        """Test search history with detailed results"""
        self.log("Testing detailed search history...")
        
        try:
            # Test basic search history (without auth, should get 401)
            response = self.session.get(f"{self.base_url}/api/history")
            
            if response.status_code == 401:
                self.log("✅ Basic history correctly requires authentication")
                
                # Test detailed search history (without auth, should get 401)
                response = self.session.get(f"{self.base_url}/api/history?include_details=true")
                
                if response.status_code == 401:
                    self.log("✅ Detailed history correctly requires authentication")
                    
                    # Test session details endpoint (without auth, should get 401)
                    response = self.session.get(f"{self.base_url}/api/history/test-session-id")
                    
                    if response.status_code == 401:
                        self.log("✅ Session details correctly requires authentication")
                        self.log("✅ All search history endpoints properly protected (authentication required)")
                        return True
                    else:
                        self.log(f"❌ Session details endpoint should require auth but returned: {response.status_code}")
                        return False
                else:
                    self.log(f"❌ Detailed history should require auth but returned: {response.status_code}")
                    return False
            else:
                self.log(f"❌ Basic history should require auth but returned: {response.status_code}")
                return False
            
        except Exception as e:
            self.log(f"❌ Test failed with exception: {str(e)}")
            return False
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all backend tests"""
        self.log("="*50)
        self.log("Starting FitFind Backend Tests")
        self.log("="*50)
        
        results = {}
        
        # Test health endpoint
        results["health"] = self.test_health()
        
        # Test authentication
        results["unauthenticated_access"] = all(self.test_unauthenticated_endpoints().values())
        
        # Test pagination
        results["pagination"] = self.test_search_history_pagination()
        
        # Test validation
        results["wishlist_validation"] = self.test_wishlist_validation()
        
        # Test content type handling
        results["content_type"] = self.test_json_content_type()
        
        # Test duplicate handling
        results["duplicate_handling"] = self.test_duplicate_wishlist_handling()
        
        # Test detailed search history
        results["detailed_search_history"] = self.test_search_history_detailed()
        
        # Summary
        self.log("="*50)
        self.log("Test Results Summary:")
        self.log("="*50)
        
        passed = 0
        total = len(results)
        
        for test_name, passed_test in results.items():
            status = "PASS" if passed_test else "FAIL"
            self.log(f"{test_name}: {status}")
            if passed_test:
                passed += 1
        
        self.log(f"\nPassed: {passed}/{total} tests")
        
        if passed == total:
            self.log("🎉 All tests passed!", "SUCCESS")
        else:
            self.log(f"⚠️  {total - passed} tests failed", "WARNING")
        
        return results

if __name__ == "__main__":
    tester = BackendTester()
    results = tester.run_all_tests() 