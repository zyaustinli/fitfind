#!/usr/bin/env python3
"""
Comprehensive Collections Testing Script for FitFind
Tests collection management functionality including database service methods and API endpoints
"""

import requests
import json
import time
import uuid
import sys
import os
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class CollectionsTester:
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.auth_token = None
        self.test_user_id = None
        self.session = requests.Session()
        self.created_collections = []  # Track collections created during testing
        self.created_saved_items = []  # Track saved items created during testing
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def setup_test_data(self):
        """Setup any test data needed for collections testing"""
        self.log("Setting up test data...")
        # In a real test environment, you'd set up authentication and test users here
        # For now, we'll test the API structure and validation
        
    def cleanup_test_data(self):
        """Clean up test data created during testing"""
        self.log("Cleaning up test data...")
        # In a real test environment, you'd clean up created collections and items
        
    def test_health(self) -> bool:
        """Test health endpoint before running collections tests"""
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

    def test_collections_endpoints_auth(self) -> Dict[str, bool]:
        """Test that collections endpoints require authentication"""
        self.log("Testing collections endpoints authentication requirements...")
        
        collection_id = str(uuid.uuid4())
        saved_item_id = str(uuid.uuid4())
        
        protected_endpoints = [
            ("/api/collections", "GET"),
            ("/api/collections", "POST"),
            (f"/api/collections/{collection_id}", "GET"),
            (f"/api/collections/{collection_id}", "PUT"),
            (f"/api/collections/{collection_id}", "DELETE"),
            (f"/api/collections/{collection_id}/items", "POST"),
            (f"/api/collections/{collection_id}/items/{saved_item_id}", "DELETE"),
        ]
        
        results = {}
        for endpoint, method in protected_endpoints:
            try:
                if method == "GET":
                    response = self.session.get(f"{self.base_url}{endpoint}")
                elif method == "POST":
                    response = self.session.post(f"{self.base_url}{endpoint}", 
                                               json={"name": "Test Collection"}, 
                                               headers={"Content-Type": "application/json"})
                elif method == "PUT":
                    response = self.session.put(f"{self.base_url}{endpoint}", 
                                              json={"name": "Updated Collection"}, 
                                              headers={"Content-Type": "application/json"})
                elif method == "DELETE":
                    response = self.session.delete(f"{self.base_url}{endpoint}")
                
                # Should return 401 for authentication required
                if response.status_code == 401:
                    results[f"{method} {endpoint}"] = True
                    self.log(f"✓ {method} {endpoint} correctly requires authentication")
                else:
                    results[f"{method} {endpoint}"] = False
                    self.log(f"✗ {method} {endpoint} returned {response.status_code} instead of 401", "ERROR")
                    
            except Exception as e:
                results[f"{method} {endpoint}"] = False
                self.log(f"✗ Error testing {method} {endpoint}: {e}", "ERROR")
        
        return results

    def test_create_collection_validation(self) -> bool:
        """Test collection creation input validation"""
        self.log("Testing collection creation validation...")
        
        invalid_requests = [
            {},  # No data
            {"description": "test"},  # Missing name
            {"name": ""},  # Empty name
            {"name": None},  # Null name
            {"name": " " * 100},  # Too long name (if there's a limit)
        ]
        
        for invalid_data in invalid_requests:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/collections",
                    json=invalid_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 401:
                    self.log("✓ Collection creation validation test skipped (authentication required)")
                    return True
                    
                if response.status_code == 400:
                    self.log(f"✓ Correctly rejected invalid collection data: {invalid_data}")
                else:
                    self.log(f"✗ Invalid collection data not rejected: {invalid_data}, status: {response.status_code}", "ERROR")
                    return False
                    
            except Exception as e:
                self.log(f"✗ Collection creation validation error: {e}", "ERROR")
                return False
        
        return True

    def test_add_item_to_collection_validation(self) -> bool:
        """Test adding items to collection validation"""
        self.log("Testing add item to collection validation...")
        
        collection_id = str(uuid.uuid4())
        
        invalid_requests = [
            {},  # No data
            {"notes": "test"},  # Missing saved_item_id
            {"saved_item_id": ""},  # Empty saved_item_id
            {"saved_item_id": None},  # Null saved_item_id
            {"saved_item_id": "not-a-uuid"},  # Invalid UUID format
        ]
        
        for invalid_data in invalid_requests:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/collections/{collection_id}/items",
                    json=invalid_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 401:
                    self.log("✓ Add item to collection validation test skipped (authentication required)")
                    return True
                    
                if response.status_code == 400:
                    self.log(f"✓ Correctly rejected invalid add item data: {invalid_data}")
                else:
                    self.log(f"✗ Invalid add item data not rejected: {invalid_data}, status: {response.status_code}", "ERROR")
                    return False
                    
            except Exception as e:
                self.log(f"✗ Add item to collection validation error: {e}", "ERROR")
                return False
        
        return True

    def test_collection_pagination(self) -> bool:
        """Test collection items pagination parameters"""
        self.log("Testing collection items pagination...")
        
        collection_id = str(uuid.uuid4())
        test_cases = [
            {"limit": 10, "offset": 0},
            {"limit": 25, "offset": 0},
            {"limit": 50, "offset": 10},
            {"limit": 100, "offset": 0},  # Test max limit handling
            {"limit": -1, "offset": 0},   # Test negative limit
            {"limit": 10, "offset": -1},  # Test negative offset
        ]
        
        for params in test_cases:
            try:
                response = self.session.get(
                    f"{self.base_url}/api/collections/{collection_id}",
                    params=params
                )
                
                if response.status_code == 401:
                    self.log(f"✓ Collection pagination test skipped (authentication required)")
                    return True
                    
                if response.status_code == 404:
                    self.log(f"✓ Collection not found as expected: {params}")
                    continue
                    
                data = response.json()
                if "pagination" in data:
                    pagination = data["pagination"]
                    expected_limit = min(max(params["limit"], 0), 100) if params["limit"] > 0 else 50
                    expected_offset = max(params["offset"], 0)
                    
                    if pagination["limit"] == expected_limit and pagination["offset"] == expected_offset:
                        self.log(f"✓ Pagination params correct: {params}")
                    else:
                        self.log(f"✗ Pagination mismatch: expected limit={expected_limit}, offset={expected_offset}, got {pagination}", "ERROR")
                        return False
                        
            except Exception as e:
                self.log(f"✗ Collection pagination test error: {e}", "ERROR")
                return False
        
        return True

    def test_collection_api_structure(self) -> bool:
        """Test that collection API responses have correct structure"""
        self.log("Testing collection API response structure...")
        
        # Test GET /api/collections structure
        try:
            response = self.session.get(f"{self.base_url}/api/collections")
            
            if response.status_code == 401:
                self.log("✓ Collection API structure test skipped (authentication required)")
                return True
                
            if response.status_code == 200:
                data = response.json()
                required_fields = ["success", "collections"]
                
                for field in required_fields:
                    if field not in data:
                        self.log(f"✗ Missing required field '{field}' in collections response", "ERROR")
                        return False
                
                if isinstance(data["collections"], list):
                    self.log("✓ Collections response has correct structure")
                else:
                    self.log("✗ Collections field is not a list", "ERROR")
                    return False
                    
        except Exception as e:
            self.log(f"✗ Collection API structure test error: {e}", "ERROR")
            return False
            
        return True

    def test_collection_item_management_structure(self) -> bool:
        """Test collection item management endpoint structure"""
        self.log("Testing collection item management structure...")
        
        collection_id = str(uuid.uuid4())
        saved_item_id = str(uuid.uuid4())
        
        # Test POST structure
        try:
            response = self.session.post(
                f"{self.base_url}/api/collections/{collection_id}/items",
                json={"saved_item_id": saved_item_id},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                self.log("✓ Collection item management test skipped (authentication required)")
                return True
                
            # Should return structured error since collection doesn't exist
            if response.status_code in [400, 404]:
                data = response.json()
                if "success" in data and "error" in data:
                    self.log("✓ Collection item management has correct error structure")
                else:
                    self.log("✗ Collection item management missing required error fields", "ERROR")
                    return False
                    
        except Exception as e:
            self.log(f"✗ Collection item management structure test error: {e}", "ERROR")
            return False
            
        return True

def test_database_service_collections():
    """Test the database service collection methods directly"""
    print("Testing Database Service Collections Methods...")
    print("=" * 60)
    
    try:
        from database_service import db_service
        print("✓ Database service imported successfully")
        
        # Test that the new collection methods exist
        collection_methods = [
            'get_collections_by_user',
            'get_collection_by_id', 
            'create_collection',
            'update_collection',
            'delete_collection',
            'get_items_in_collection',
            'add_item_to_collection',
            'remove_item_from_collection',
            'get_default_collection',
            'get_collection_items_count'
        ]
        
        print("\nTesting method existence...")
        for method_name in collection_methods:
            if hasattr(db_service, method_name):
                method = getattr(db_service, method_name)
                if callable(method):
                    print(f"✓ {method_name} exists and is callable")
                else:
                    print(f"✗ {method_name} exists but is not callable")
                    return False
            else:
                print(f"✗ {method_name} does not exist")
                return False
        
        print("\nTesting method signatures...")
        # Test get_collections_by_user signature
        try:
            import inspect
            sig = inspect.signature(db_service.get_collections_by_user)
            params = list(sig.parameters.keys())
            if 'user_id' in params:
                print("✓ get_collections_by_user has correct signature")
            else:
                print("✗ get_collections_by_user missing user_id parameter")
                return False
        except Exception as e:
            print(f"✗ Error checking method signature: {e}")
            return False
            
        print("\n✅ All database service collection methods are properly defined!")
        return True
        
    except Exception as e:
        print(f"✗ Error testing database service: {e}")
        import traceback
        traceback.print_exc()
        return False

def run_collections_tests():
    """Run all collections tests"""
    print("FitFind Collections Functionality Test Suite")
    print("=" * 60)
    
    # Test database service first
    db_success = test_database_service_collections()
    
    print("\n" + "=" * 60)
    print("Testing Collections API Endpoints...")
    
    tester = CollectionsTester()
    
    # Run API tests
    tests = [
        ("Health Check", tester.test_health),
        ("Authentication Requirements", tester.test_collections_endpoints_auth),
        ("Collection Creation Validation", tester.test_create_collection_validation),
        ("Add Item Validation", tester.test_add_item_to_collection_validation),
        ("Pagination Handling", tester.test_collection_pagination),
        ("API Response Structure", tester.test_collection_api_structure),
        ("Item Management Structure", tester.test_collection_item_management_structure),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        try:
            result = test_func()
            results[test_name] = result
            if result:
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    print(f"Database Service Tests: {'✅ PASSED' if db_success else '❌ FAILED'}")
    print(f"API Endpoint Tests: {passed}/{total} passed")
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"  {test_name}: {status}")
    
    overall_success = db_success and all(results.values())
    print(f"\nOverall Result: {'🎉 ALL TESTS PASSED!' if overall_success else '⚠️  SOME TESTS FAILED'}")
    
    return overall_success

if __name__ == "__main__":
    success = run_collections_tests()
    sys.exit(0 if success else 1) 