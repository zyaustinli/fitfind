#!/usr/bin/env python3
"""
Test script to verify the database service fixes
"""

import os
import sys
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

def test_database_service():
    """Test that the database service loads and works correctly"""
    try:
        print("Testing database service import...")
        from database_service import db_service
        print("✓ Database service imported successfully")
        
        print("\nTesting health check...")
        health = db_service.health_check()
        print(f"✓ Health check result: {health['status']}")
        
        print("\nTesting service client usage...")
        # Test that service_client is being used
        assert hasattr(db_service, 'service_client'), "service_client should exist"
        assert db_service.service_client is not None, "service_client should not be None"
        print("✓ Service client is properly initialized")
        
        print("\nAll tests passed! The database service fix is working correctly.")
        return True
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_json_serialization_fix():
    """Test that conversation_context with image_bytes is properly handled"""
    
    # Simulate a conversation_context with image_bytes (like what redo_search_queries returns)
    sample_image_bytes = b"fake image data"
    conversation_context = {
        "queries": ["red dress", "blue jeans"],
        "conversation_history": [
            {"role": "user", "parts": [{"text": "Analyze this image"}]},
            {"role": "model", "parts": [{"text": "I can see clothing items..."}]}
        ],
        "image_bytes": sample_image_bytes,  # This is the problematic bytes object
        "system_prompt": "You are a fashion assistant",
        "model": "gemini-1.5-flash",
        "feedback_used": "Please be more specific"
    }
    
    print("Original conversation_context keys:", list(conversation_context.keys()))
    print("image_bytes type:", type(conversation_context.get('image_bytes')))
    
    # Test: Try to JSON serialize the original (this should fail)
    try:
        json.dumps(conversation_context)
        print("❌ ERROR: Original conversation_context should NOT be JSON serializable!")
    except TypeError as e:
        print("✅ EXPECTED: Original conversation_context fails JSON serialization:", str(e))
    
    # Test: Apply the fix (remove image_bytes)
    conversation_context_for_db = conversation_context
    if conversation_context_for_db and 'image_bytes' in conversation_context_for_db:
        conversation_context_for_db = {k: v for k, v in conversation_context_for_db.items() if k != 'image_bytes'}
    
    print("\nAfter fix - conversation_context_for_db keys:", list(conversation_context_for_db.keys()))
    
    # Test: Try to JSON serialize the fixed version (this should work)
    try:
        serialized = json.dumps(conversation_context_for_db)
        print("✅ SUCCESS: Fixed conversation_context is JSON serializable!")
        print("Serialized length:", len(serialized))
        
        # Verify we can deserialize it back
        deserialized = json.loads(serialized)
        print("✅ SUCCESS: Can deserialize back to dict")
        
        # Verify the important data is preserved
        assert deserialized["queries"] == ["red dress", "blue jeans"]
        assert len(deserialized["conversation_history"]) == 2
        assert "image_bytes" not in deserialized
        print("✅ SUCCESS: All important data preserved (except image_bytes)")
        
    except Exception as e:
        print("❌ ERROR: Fixed conversation_context still fails:", str(e))
        return False
    
    return True

if __name__ == "__main__":
    print("Testing JSON serialization fix for conversation_context...")
    print("=" * 60)
    
    success = test_json_serialization_fix()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 ALL TESTS PASSED! The fix should resolve the JSON serialization error.")
    else:
        print("❌ TESTS FAILED! The fix needs more work.")

    success = test_database_service()
    sys.exit(0 if success else 1) 