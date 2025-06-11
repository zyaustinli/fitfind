#!/usr/bin/env python3
"""
Collections Test Runner
Executes all collections tests and provides a comprehensive summary
"""

import sys
import os
import subprocess
import time
from typing import Dict, List, Tuple

def run_test_file(test_file: str, description: str) -> Tuple[bool, str]:
    """Run a test file and return success status and output"""
    print(f"\n{'='*60}")
    print(f"Running {description}")
    print(f"File: {test_file}")
    print(f"{'='*60}")
    
    if not os.path.exists(test_file):
        print(f"❌ Test file {test_file} not found")
        return False, f"Test file {test_file} not found"
    
    try:
        start_time = time.time()
        result = subprocess.run([sys.executable, test_file], 
                              capture_output=True, 
                              text=True, 
                              timeout=300)  # 5 minute timeout
        end_time = time.time()
        
        duration = end_time - start_time
        
        # Print the output in real-time style
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        print(f"\nTest completed in {duration:.2f} seconds")
        
        if result.returncode == 0:
            print(f"✅ {description} PASSED")
            return True, f"Passed in {duration:.2f}s"
        else:
            print(f"❌ {description} FAILED (exit code: {result.returncode})")
            return False, f"Failed with exit code {result.returncode}"
            
    except subprocess.TimeoutExpired:
        print(f"⏰ {description} TIMED OUT")
        return False, "Timed out after 5 minutes"
    except Exception as e:
        print(f"💥 {description} ERROR: {e}")
        return False, f"Error: {str(e)}"

def check_prerequisites():
    """Check if prerequisites for testing are met"""
    print("Checking Prerequisites...")
    print("-" * 40)
    
    # Check if database service can be imported
    try:
        from database_service import db_service
        print("✅ Database service import: OK")
    except Exception as e:
        print(f"❌ Database service import: FAILED ({e})")
        return False
    
    # Check if required modules are available
    required_modules = ['requests', 'dotenv', 'uuid', 'json']
    for module in required_modules:
        try:
            __import__(module)
            print(f"✅ Module '{module}': OK")
        except ImportError:
            print(f"❌ Module '{module}': MISSING")
            return False
    
    # Check if environment variables are set
    required_env_vars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
    missing_vars = []
    for var in required_env_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        return False
    else:
        print("✅ Environment variables: OK")
    
    print("\n✅ All prerequisites met!\n")
    return True

def main():
    """Main test runner function"""
    print("FitFind Collections Test Suite Runner")
    print("=" * 80)
    print("This script runs all collections-related tests")
    print("=" * 80)
    
    # Check prerequisites first
    if not check_prerequisites():
        print("\n❌ Prerequisites not met. Please fix the issues above and try again.")
        return False
    
    # Define tests to run
    tests = [
        ("test_collections_unit.py", "Unit Tests"),
        ("test_collections_functionality.py", "Functionality Tests"),
        ("test_collections_integration.py", "Integration Tests"),
    ]
    
    # Run tests
    results: Dict[str, Tuple[bool, str]] = {}
    overall_start_time = time.time()
    
    for test_file, description in tests:
        success, message = run_test_file(test_file, description)
        results[description] = (success, message)
    
    overall_end_time = time.time()
    overall_duration = overall_end_time - overall_start_time
    
    # Generate summary
    print("\n" + "=" * 80)
    print("TEST SUITE SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, (success, message) in results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name:30} {status:15} {message}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal Tests: {len(results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total Duration: {overall_duration:.2f} seconds")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! Collections functionality is ready to go!")
        print("\nNext steps:")
        print("1. The backend collections API is fully tested and working")
        print("2. You can now proceed with frontend implementation")
        print("3. Consider setting up automated testing in your CI/CD pipeline")
    else:
        print(f"\n⚠️  {failed} TEST SUITE(S) FAILED")
        print("\nRecommended actions:")
        print("1. Review the failed test output above")
        print("2. Fix any issues in the collections implementation")
        print("3. Re-run the tests until all pass")
        print("4. Do not proceed to frontend until backend tests pass")
    
    return failed == 0

def create_test_files_if_missing():
    """Create test files if they don't exist"""
    test_files = {
        "test_collections_unit.py": "Unit tests file",
        "test_collections_functionality.py": "Functionality tests file", 
        "test_collections_integration.py": "Integration tests file"
    }
    
    missing_files = []
    for test_file, description in test_files.items():
        if not os.path.exists(test_file):
            missing_files.append((test_file, description))
    
    if missing_files:
        print("\n⚠️  Missing Test Files:")
        for test_file, description in missing_files:
            print(f"   {test_file} - {description}")
        print("\nThese files should have been created earlier.")
        print("Please ensure all test files are present before running the test suite.")
        return False
    
    return True

if __name__ == "__main__":
    print("Collections Test Suite Runner")
    print("=" * 50)
    
    # Check if test files exist
    if not create_test_files_if_missing():
        print("\n❌ Cannot run tests - missing test files")
        sys.exit(1)
    
    # Run the test suite
    success = main()
    
    print("\n" + "=" * 80)
    if success:
        print("🚀 Collections backend is ready for frontend integration!")
    else:
        print("🔧 Please fix the failing tests before proceeding")
    
    sys.exit(0 if success else 1) 