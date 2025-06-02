#!/usr/bin/env python3
"""
Test script for storage-related API endpoints
"""

import requests
import json
from io import BytesIO
from PIL import Image

BASE_URL = "http://localhost:5000"

def create_test_image():
    """Create a simple test image in memory"""
    # Create a simple colored image
    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes

def test_health_endpoint():
    """Test the enhanced health endpoint"""
    print("🔍 Testing enhanced health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health endpoint working. Status: {data.get('status')}")
            print(f"   Database: {data.get('services', {}).get('database', {}).get('status', 'unknown')}")
            print(f"   Storage: {data.get('services', {}).get('storage', {}).get('status', 'unknown')}")
            return True
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_upload_endpoint():
    """Test the upload endpoint with Supabase Storage"""
    print("🔍 Testing upload endpoint with Supabase Storage...")
    try:
        # Create test image
        test_image = create_test_image()
        
        # Prepare upload data
        files = {'file': ('test_image.jpg', test_image, 'image/jpeg')}
        data = {
            'country': 'us',
            'language': 'en'
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ Upload successful!")
                print(f"   File ID: {result.get('file_id')}")
                print(f"   Image URL: {result.get('image_url', 'N/A')}")
                print(f"   Session ID: {result.get('session_id', 'N/A')}")
                
                # Check if image URL is a Supabase URL
                image_url = result.get('image_url', '')
                if 'supabase' in image_url:
                    print(f"✅ Image stored in Supabase Storage")
                else:
                    print(f"⚠️  Image URL doesn't appear to be from Supabase: {image_url}")
                
                return True, result
            else:
                print(f"❌ Upload failed: {result.get('error')}")
                return False, None
        else:
            print(f"❌ Upload endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Upload endpoint error: {e}")
        return False, None

def test_storage_cleanup_endpoint():
    """Test the storage cleanup endpoint"""
    print("🔍 Testing storage cleanup endpoint...")
    try:
        response = requests.post(f"{BASE_URL}/api/storage/cleanup")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ Storage cleanup successful!")
                print(f"   Deleted count: {result.get('deleted_count', 0)}")
                return True
            else:
                print(f"❌ Storage cleanup failed: {result.get('error')}")
                return False
        else:
            print(f"❌ Storage cleanup endpoint failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Storage cleanup endpoint error: {e}")
        return False

def test_image_accessibility(image_url):
    """Test if uploaded image is accessible via its URL"""
    print("🔍 Testing image accessibility...")
    try:
        response = requests.get(image_url)
        if response.status_code == 200:
            print(f"✅ Image is accessible at: {image_url}")
            print(f"   Content-Type: {response.headers.get('content-type', 'unknown')}")
            print(f"   Content-Length: {len(response.content)} bytes")
            return True
        else:
            print(f"❌ Image not accessible: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Image accessibility error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Storage Integration API Endpoints")
    print("=" * 60)
    
    # Test 1: Enhanced health endpoint
    health_ok = test_health_endpoint()
    print()
    
    # Test 2: Upload endpoint with storage
    upload_ok, upload_result = test_upload_endpoint()
    print()
    
    # Test 3: Image accessibility (if upload succeeded)
    image_accessible = False
    if upload_ok and upload_result and upload_result.get('image_url'):
        image_accessible = test_image_accessibility(upload_result['image_url'])
        print()
    
    # Test 4: Storage cleanup endpoint
    cleanup_ok = test_storage_cleanup_endpoint()
    print()
    
    # Summary
    print("=" * 60)
    if health_ok and upload_ok and image_accessible and cleanup_ok:
        print("✅ All tests passed! Storage integration is working correctly.")
        print("\n📋 What was tested:")
        print("✅ Enhanced health endpoint with storage status")
        print("✅ Upload endpoint with Supabase Storage integration")
        print("✅ Image accessibility via Supabase CDN")
        print("✅ Storage cleanup endpoint")
        print("\n🎉 Your images should now display correctly in the search history!")
    else:
        print("❌ Some tests failed. Check the output above for details.")
        print("\n📋 Test Results:")
        print(f"{'✅' if health_ok else '❌'} Health endpoint")
        print(f"{'✅' if upload_ok else '❌'} Upload endpoint")
        print(f"{'✅' if image_accessible else '❌'} Image accessibility")
        print(f"{'✅' if cleanup_ok else '❌'} Storage cleanup") 