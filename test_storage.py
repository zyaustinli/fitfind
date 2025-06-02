#!/usr/bin/env python3
"""
Test script for Supabase Storage integration
"""

import os
from dotenv import load_dotenv
from image_storage_service import storage_service

def test_storage_health():
    """Test storage service health"""
    print("🔍 Testing storage service health...")
    health = storage_service.health_check()
    print(f"Health check result: {health}")
    return health.get('status') == 'healthy'

def test_bucket_access():
    """Test bucket access"""
    print("🔍 Testing bucket access...")
    try:
        result = storage_service.client.storage.from_(storage_service.bucket_name).list()
        print(f"✅ Successfully accessed bucket: {storage_service.bucket_name}")
        return True
    except Exception as e:
        print(f"❌ Failed to access bucket: {e}")
        return False

def test_storage_policies():
    """Test storage policies"""
    print("🔍 Testing storage policies...")
    try:
        # Try to list files in anonymous folder
        result = storage_service.client.storage.from_(storage_service.bucket_name).list("anonymous")
        print(f"✅ Successfully listed anonymous folder contents")
        return True
    except Exception as e:
        print(f"❌ Failed to list anonymous folder: {e}")
        return False

if __name__ == "__main__":
    load_dotenv()
    
    print("🧪 Testing Supabase Storage Integration")
    print("=" * 50)
    
    # Test 1: Health check
    health_ok = test_storage_health()
    print()
    
    # Test 2: Bucket access
    bucket_ok = test_bucket_access()
    print()
    
    # Test 3: Storage policies
    policies_ok = test_storage_policies()
    print()
    
    if health_ok and bucket_ok and policies_ok:
        print("✅ All tests passed! Storage service is ready.")
        print("\n📋 Next steps:")
        print("1. Execute the supabase_storage_setup.sql in your Supabase SQL Editor")
        print("2. Test the upload endpoint with: python test_backend_endpoints.py")
        print("3. Upload an image through the frontend and check the history tab")
    else:
        print("❌ Some tests failed. Check your configuration.")
        print("\n🔧 Troubleshooting:")
        if not health_ok:
            print("- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file")
        if not bucket_ok:
            print("- Create the 'outfit-images' bucket in Supabase Storage")
        if not policies_ok:
            print("- Execute the storage policies from supabase_storage_setup.sql") 