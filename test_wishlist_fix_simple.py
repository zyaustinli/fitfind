#!/usr/bin/env python3
"""
Simple test script to verify the wishlist save fix works correctly.
Tests that products can be saved to wishlist using either their internal database ID
or their external retailer ID.
"""

import os
import sys
import json
from database_service import DatabaseService

def test_wishlist_external_id_fix():
    """Test that products can be saved using external_id"""
    
    # Initialize database service
    db_service = DatabaseService()
    
    print("🧪 Testing Wishlist External ID Fix (Simple)")
    print("=" * 50)
    
    # Test user ID (you can change this to a real user ID from your database)
    import uuid
    test_user_id = str(uuid.uuid4())
    
    try:
        # 1. First, let's create a test session and product
        print("1. Creating test search session...")
        unique_file_id = f"test-file-{uuid.uuid4()}"
        session = db_service.create_anonymous_search_session(
            file_id=unique_file_id,
            image_filename="test.jpg", 
            image_url="https://example.com/test.jpg"
        )
        
        if not session:
            print("❌ Failed to create test session")
            return False
            
        session_id = session['id']
        print(f"✅ Created session: {session_id}")
        
        # 2. Create test clothing items with products
        print("\n2. Creating test products...")
        test_clothing_items = [{
            "query": "blue jeans",
            "item_type": "jeans", 
            "total_products": 1,
            "price_range": {"min": 50, "max": 100, "average": 75},
            "products": [{
                "id": f"external-product-{uuid.uuid4()}",  # This is the external ID
                "title": "Blue Denim Jeans",
                "price_numeric": 75.99,
                "image_url": "https://example.com/jeans.jpg",
                "product_url": "https://retailer.com/jeans",
                "source": "TestRetailer",
                "rating": 4.5,
                "review_count": 150
            }]
        }]
        
        success = db_service.save_clothing_items(session_id, test_clothing_items)
        if not success:
            print("❌ Failed to save clothing items")
            return False
            
        print("✅ Saved test products")
        
        # 3. Get the product by querying the database directly
        print("\n3. Finding the saved product...")
        external_id = test_clothing_items[0]["products"][0]["id"]
        
        # Query for the product using external_id
        product_response = db_service.service_client.table("products").select("id, external_id, title").eq("external_id", external_id).execute()
        
        if not product_response.data:
            print("❌ Failed to find product by external_id")
            return False
            
        product = product_response.data[0]
        database_product_id = product['id']
        external_product_id = product['external_id']
        
        print(f"✅ Product found:")
        print(f"   Database ID: {database_product_id}")
        print(f"   External ID: {external_product_id}")
        
        # 4. Test adding to wishlist using database ID
        print(f"\n4. Testing wishlist save with database ID: {database_product_id}")
        wishlist_item = db_service.add_to_wishlist_with_collection(
            test_user_id, 
            database_product_id
        )
        
        if wishlist_item:
            print("✅ Successfully saved to wishlist using database ID")
            
            # Remove it for next test
            db_service.remove_from_wishlist(test_user_id, database_product_id)
        else:
            print("❌ Failed to save to wishlist using database ID")
            return False
        
        # 5. Test adding to wishlist using external ID
        print(f"\n5. Testing wishlist save with external ID: {external_product_id}")
        wishlist_item = db_service.add_to_wishlist_with_collection(
            test_user_id, 
            external_product_id
        )
        
        if wishlist_item:
            print("✅ Successfully saved to wishlist using external ID")
            print(f"   Wishlist item ID: {wishlist_item['id']}")
            print(f"   Product ID in wishlist: {wishlist_item['product_id']}")
            
            # Verify it's using the correct database ID internally
            if wishlist_item['product_id'] == database_product_id:
                print("✅ Correctly using database ID internally")
            else:
                print("❌ Not using database ID internally")
                return False
                
        else:
            print("❌ Failed to save to wishlist using external ID")
            return False
        
        # 6. Test checking wishlist status with external ID
        print(f"\n6. Testing wishlist status check with external ID...")
        is_saved = db_service.is_item_in_wishlist(test_user_id, external_product_id)
        if is_saved:
            print("✅ Correctly identifies item as saved using external ID")
        else:
            print("❌ Failed to identify item as saved using external ID")
            return False
        
        # 7. Test removing from wishlist using external ID
        print(f"\n7. Testing wishlist removal with external ID...")
        removed = db_service.remove_from_wishlist(test_user_id, external_product_id)
        if removed:
            print("✅ Successfully removed from wishlist using external ID")
        else:
            print("❌ Failed to remove from wishlist using external ID")
            return False
        
        # 8. Verify it's actually removed
        print(f"\n8. Verifying removal...")
        is_saved_after = db_service.is_item_in_wishlist(test_user_id, external_product_id)
        if not is_saved_after:
            print("✅ Confirmed item is no longer in wishlist")
        else:
            print("❌ Item still appears to be in wishlist")
            return False
        
        print("\n" + "=" * 50)
        print("🎉 All tests passed! The wishlist external ID fix is working correctly.")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_wishlist_external_id_fix()
    sys.exit(0 if success else 1) 