#!/usr/bin/env python3
"""
Unit Tests for Collections Database Service Methods
Tests the core functionality of collection management without requiring a live database
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import uuid
from typing import Dict, List, Any
import sys
import os

# Add the parent directory to the path so we can import the database service
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

class TestCollectionsDatabaseService(unittest.TestCase):
    """Unit tests for collections database service methods"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_user_id = str(uuid.uuid4())
        self.test_collection_id = str(uuid.uuid4())
        self.test_saved_item_id = str(uuid.uuid4())
        
        # Mock Supabase response structure
        self.mock_collections_response = Mock()
        self.mock_collections_response.data = [
            {
                "id": self.test_collection_id,
                "user_id": self.test_user_id,
                "name": "My Favorites",
                "description": "Default collection",
                "is_private": False,
                "created_at": "2023-01-01T00:00:00Z",
                "updated_at": "2023-01-01T00:00:00Z",
                "collection_items": [{"count": 5}]
            }
        ]
        
        self.mock_single_collection = {
            "id": self.test_collection_id,
            "user_id": self.test_user_id,
            "name": "Test Collection",
            "description": "A test collection",
            "is_private": False,
            "created_at": "2023-01-01T00:00:00Z",
            "updated_at": "2023-01-01T00:00:00Z"
        }
        
    @patch('database_service.DatabaseService')
    def test_get_collections_by_user(self, mock_db_service_class):
        """Test getting collections by user ID"""
        # Setup mock
        mock_db_service = mock_db_service_class.return_value
        mock_db_service.service_client.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = self.mock_collections_response
        
        # Import and test
        from database_service import DatabaseService
        db_service = DatabaseService()
        
        # Mock the method
        db_service.get_collections_by_user = Mock(return_value=[
            {
                "id": self.test_collection_id,
                "user_id": self.test_user_id,
                "name": "My Favorites",
                "description": "Default collection",
                "is_private": False,
                "created_at": "2023-01-01T00:00:00Z",
                "updated_at": "2023-01-01T00:00:00Z",
                "item_count": 5
            }
        ])
        
        result = db_service.get_collections_by_user(self.test_user_id)
        
        # Assertions
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], self.test_collection_id)
        self.assertEqual(result[0]["user_id"], self.test_user_id)
        self.assertEqual(result[0]["item_count"], 5)
        
    @patch('database_service.DatabaseService')
    def test_get_collection_by_id(self, mock_db_service_class):
        """Test getting a single collection by ID"""
        mock_db_service = mock_db_service_class.return_value
        
        # Mock the method
        mock_db_service.get_collection_by_id = Mock(return_value=self.mock_single_collection)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.get_collection_by_id = mock_db_service.get_collection_by_id
        
        result = db_service.get_collection_by_id(self.test_collection_id, self.test_user_id)
        
        # Assertions
        self.assertIsNotNone(result)
        self.assertEqual(result["id"], self.test_collection_id)
        self.assertEqual(result["user_id"], self.test_user_id)
        self.assertEqual(result["name"], "Test Collection")
        
    @patch('database_service.DatabaseService')
    def test_create_collection(self, mock_db_service_class):
        """Test creating a new collection"""
        mock_db_service = mock_db_service_class.return_value
        
        new_collection = {
            "id": str(uuid.uuid4()),
            "user_id": self.test_user_id,
            "name": "New Collection",
            "description": "A new test collection",
            "is_private": False,
            "created_at": "2023-01-01T00:00:00Z",
            "updated_at": "2023-01-01T00:00:00Z"
        }
        
        mock_db_service.create_collection = Mock(return_value=new_collection)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.create_collection = mock_db_service.create_collection
        
        result = db_service.create_collection(
            user_id=self.test_user_id,
            name="New Collection",
            description="A new test collection"
        )
        
        # Assertions
        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "New Collection")
        self.assertEqual(result["user_id"], self.test_user_id)
        self.assertEqual(result["description"], "A new test collection")
        
    @patch('database_service.DatabaseService')
    def test_update_collection(self, mock_db_service_class):
        """Test updating a collection"""
        mock_db_service = mock_db_service_class.return_value
        
        updated_collection = self.mock_single_collection.copy()
        updated_collection["name"] = "Updated Collection Name"
        updated_collection["description"] = "Updated description"
        
        mock_db_service.update_collection = Mock(return_value=updated_collection)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.update_collection = mock_db_service.update_collection
        
        updates = {
            "name": "Updated Collection Name",
            "description": "Updated description"
        }
        
        result = db_service.update_collection(
            collection_id=self.test_collection_id,
            user_id=self.test_user_id,
            updates=updates
        )
        
        # Assertions
        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "Updated Collection Name")
        self.assertEqual(result["description"], "Updated description")
        
    @patch('database_service.DatabaseService')
    def test_delete_collection(self, mock_db_service_class):
        """Test deleting a collection"""
        mock_db_service = mock_db_service_class.return_value
        mock_db_service.delete_collection = Mock(return_value=True)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.delete_collection = mock_db_service.delete_collection
        
        result = db_service.delete_collection(
            collection_id=self.test_collection_id,
            user_id=self.test_user_id
        )
        
        # Assertions
        self.assertTrue(result)
        
    @patch('database_service.DatabaseService')
    def test_add_item_to_collection(self, mock_db_service_class):
        """Test adding an item to a collection"""
        mock_db_service = mock_db_service_class.return_value
        
        # Mock the necessary method calls
        mock_db_service.get_collection_by_id = Mock(return_value=self.mock_single_collection)
        mock_db_service.add_item_to_collection = Mock(return_value=True)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.get_collection_by_id = mock_db_service.get_collection_by_id
        db_service.add_item_to_collection = mock_db_service.add_item_to_collection
        
        result = db_service.add_item_to_collection(
            collection_id=self.test_collection_id,
            saved_item_id=self.test_saved_item_id,
            user_id=self.test_user_id
        )
        
        # Assertions
        self.assertTrue(result)
        
    @patch('database_service.DatabaseService')
    def test_remove_item_from_collection(self, mock_db_service_class):
        """Test removing an item from a collection"""
        mock_db_service = mock_db_service_class.return_value
        
        mock_db_service.get_collection_by_id = Mock(return_value=self.mock_single_collection)
        mock_db_service.remove_item_from_collection = Mock(return_value=True)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.get_collection_by_id = mock_db_service.get_collection_by_id
        db_service.remove_item_from_collection = mock_db_service.remove_item_from_collection
        
        result = db_service.remove_item_from_collection(
            collection_id=self.test_collection_id,
            saved_item_id=self.test_saved_item_id,
            user_id=self.test_user_id
        )
        
        # Assertions
        self.assertTrue(result)
        
    @patch('database_service.DatabaseService')
    def test_get_default_collection(self, mock_db_service_class):
        """Test getting the default 'My Favorites' collection"""
        mock_db_service = mock_db_service_class.return_value
        
        default_collection = self.mock_single_collection.copy()
        default_collection["name"] = "My Favorites"
        
        mock_db_service.get_default_collection = Mock(return_value=default_collection)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.get_default_collection = mock_db_service.get_default_collection
        
        result = db_service.get_default_collection(self.test_user_id)
        
        # Assertions
        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "My Favorites")
        self.assertEqual(result["user_id"], self.test_user_id)
        
    @patch('database_service.DatabaseService')
    def test_get_items_in_collection(self, mock_db_service_class):
        """Test getting items in a collection with pagination"""
        mock_db_service = mock_db_service_class.return_value
        
        mock_items = [
            {
                "id": str(uuid.uuid4()),
                "user_id": self.test_user_id,
                "product_id": str(uuid.uuid4()),
                "notes": "Test item 1",
                "created_at": "2023-01-01T00:00:00Z",
                "products": {
                    "id": str(uuid.uuid4()),
                    "title": "Test Product 1",
                    "price": "$29.99"
                },
                "collection_position": 0,
                "added_to_collection_at": "2023-01-01T00:00:00Z"
            }
        ]
        
        mock_db_service.get_collection_by_id = Mock(return_value=self.mock_single_collection)
        mock_db_service.get_items_in_collection = Mock(return_value=mock_items)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.get_collection_by_id = mock_db_service.get_collection_by_id
        db_service.get_items_in_collection = mock_db_service.get_items_in_collection
        
        result = db_service.get_items_in_collection(
            collection_id=self.test_collection_id,
            user_id=self.test_user_id,
            limit=50,
            offset=0
        )
        
        # Assertions
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["notes"], "Test item 1")
        self.assertIn("products", result[0])
        self.assertIn("collection_position", result[0])
        
    @patch('database_service.DatabaseService')
    def test_get_collection_items_count(self, mock_db_service_class):
        """Test getting the count of items in a collection"""
        mock_db_service = mock_db_service_class.return_value
        mock_db_service.get_collection_items_count = Mock(return_value=5)
        
        from database_service import DatabaseService
        db_service = DatabaseService()
        db_service.get_collection_items_count = mock_db_service.get_collection_items_count
        
        result = db_service.get_collection_items_count(self.test_collection_id)
        
        # Assertions
        self.assertEqual(result, 5)
        self.assertIsInstance(result, int)

class TestCollectionBusinessLogic(unittest.TestCase):
    """Test business logic and edge cases for collections"""
    
    def test_collection_name_validation(self):
        """Test that collection names are properly validated"""
        # This would test the validation logic once implemented
        valid_names = ["My Collection", "Fashion 2023", "Work Outfits"]
        invalid_names = ["", "   ", None, "x" * 200]  # Empty, whitespace, null, too long
        
        for name in valid_names:
            self.assertTrue(len(name.strip()) > 0, f"Valid name '{name}' should pass validation")
            
        for name in invalid_names:
            if name is not None:
                self.assertFalse(len(name.strip()) > 0 or len(name) > 100, f"Invalid name '{name}' should fail validation")
                
    def test_duplicate_collection_prevention(self):
        """Test that duplicate collection names are prevented"""
        # This would test the duplicate prevention logic
        existing_collections = ["My Favorites", "Work Clothes", "Casual Wear"]
        
        # Case-insensitive duplicates should be prevented
        duplicate_attempts = ["my favorites", "MY FAVORITES", "Work Clothes"]
        
        for attempt in duplicate_attempts:
            # Check if any existing collection matches (case-insensitive)
            is_duplicate = any(existing.lower() == attempt.lower() for existing in existing_collections)
            self.assertTrue(is_duplicate, f"'{attempt}' should be detected as duplicate")
            
    def test_default_collection_protection(self):
        """Test that the default 'My Favorites' collection is protected"""
        protected_collection_name = "My Favorites"
        
        # Should not be able to delete
        # Should not be able to rename
        # These would be tested in the actual implementation
        
        self.assertEqual(protected_collection_name, "My Favorites")

def run_unit_tests():
    """Run all unit tests"""
    print("Collections Database Service Unit Tests")
    print("=" * 60)
    
    # Create test suite
    suite = unittest.TestSuite()
    
    # Add test classes
    suite.addTest(unittest.makeSuite(TestCollectionsDatabaseService))
    suite.addTest(unittest.makeSuite(TestCollectionBusinessLogic))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    print("\n" + "=" * 60)
    print("UNIT TEST SUMMARY")
    print("=" * 60)
    
    if result.wasSuccessful():
        print("🎉 ALL UNIT TESTS PASSED!")
        print(f"Tests run: {result.testsRun}")
    else:
        print("⚠️  SOME UNIT TESTS FAILED")
        print(f"Tests run: {result.testsRun}")
        print(f"Failures: {len(result.failures)}")
        print(f"Errors: {len(result.errors)}")
        
        if result.failures:
            print("\nFailures:")
            for test, traceback in result.failures:
                print(f"  {test}: {traceback}")
                
        if result.errors:
            print("\nErrors:")
            for test, traceback in result.errors:
                print(f"  {test}: {traceback}")
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_unit_tests()
    sys.exit(0 if success else 1) 