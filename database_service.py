"""
Database service layer for FitFind application using Supabase
Handles all database operations including user management, search sessions, and saved items
"""

import os
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self):
        """Initialize Supabase client"""
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not all([self.supabase_url, self.supabase_anon_key, self.supabase_service_key]):
            raise ValueError("Missing Supabase configuration. Please check your environment variables.")
        
        # Create clients
        self.client: Client = create_client(self.supabase_url, self.supabase_anon_key)
        self.service_client: Client = create_client(self.supabase_url, self.supabase_service_key)
    
    def set_user_context(self, jwt_token: str):
        """Set user context for authenticated requests"""
        try:
            # Set the Authorization header for RLS to work properly
            # This ensures all subsequent queries use the user's JWT token
            self.client.options.headers["Authorization"] = f"Bearer {jwt_token}"
            logger.info("Successfully set user context with JWT token")
            return True
        except Exception as e:
            logger.error(f"Failed to set user context: {e}")
            return False
    
    # User Profile Management
    def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """Get user profile by ID"""
        try:
            response = self.client.table("user_profiles").select("*").eq("id", user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            return None
    
    def create_user_profile(self, user_id: str, email: str, full_name: str = None) -> Optional[Dict]:
        """Create a new user profile"""
        try:
            profile_data = {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "preferences": {}
            }
            response = self.client.table("user_profiles").insert(profile_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating user profile: {e}")
            return None
    
    def update_user_profile(self, user_id: str, updates: Dict) -> Optional[Dict]:
        """Update user profile"""
        try:
            response = self.client.table("user_profiles").update(updates).eq("id", user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating user profile: {e}")
            return None
    
    # Search Session Management
    def create_search_session(self, user_id: str, file_id: str, image_filename: str, 
                            image_url: str, country: str = "us", language: str = "en") -> Optional[Dict]:
        """Create a new search session"""
        try:
            session_data = {
                "user_id": user_id,
                "file_id": file_id,
                "image_filename": image_filename,
                "image_url": image_url,
                "status": "uploading",
                "country": country,
                "language": language,
                "search_queries": [],
                "num_items_identified": 0,
                "num_products_found": 0
            }
            response = self.client.table("search_sessions").insert(session_data).execute()
            session = response.data[0] if response.data else None
            
            # Add to search history
            if session:
                self.add_to_search_history(user_id, session["id"])
            
            return session
        except Exception as e:
            logger.error(f"Error creating search session: {e}")
            return None
    
    def update_search_session(self, session_id: str, updates: Dict) -> Optional[Dict]:
        """Update search session"""
        try:
            # Check if this is an anonymous session to use the right client
            session_check = self.client.table("search_sessions").select("user_id").eq("id", session_id).execute()
            
            if session_check.data and session_check.data[0]["user_id"] is None:
                # This is an anonymous session, use service client
                client = self.service_client
            else:
                client = self.client
            
            response = client.table("search_sessions").update(updates).eq("id", session_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating search session: {e}")
            return None
    
    def get_search_session(self, session_id: str) -> Optional[Dict]:
        """Get search session by ID"""
        try:
            response = self.client.table("search_sessions").select("*").eq("id", session_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting search session: {e}")
            return None
    
    def get_search_session_by_file_id(self, file_id: str) -> Optional[Dict]:
        """Get search session by file ID"""
        try:
            response = self.client.table("search_sessions").select("*").eq("file_id", file_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting search session by file_id: {e}")
            return None
    
    def get_user_search_sessions(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get user's search sessions with pagination"""
        try:
            response = (self.client.table("search_sessions")
                       .select("*")
                       .eq("user_id", user_id)
                       .order("created_at", desc=True)
                       .range(offset, offset + limit - 1)
                       .execute())
            return response.data or []
        except Exception as e:
            logger.error(f"Error getting user search sessions: {e}")
            return []
    
    # Clothing Items Management
    def save_clothing_items(self, session_id: str, clothing_items: List[Dict]) -> bool:
        """Save clothing items for a search session"""
        try:
            # Check if this is an anonymous session to use the right client
            session_check = self.client.table("search_sessions").select("user_id").eq("id", session_id).execute()
            use_service_client = False
            
            if session_check.data and session_check.data[0]["user_id"] is None:
                # This is an anonymous session, use service client
                use_service_client = True
                client = self.service_client
            else:
                client = self.client
            
            items_to_insert = []
            for item in clothing_items:
                item_data = {
                    "search_session_id": session_id,
                    "query": item.get("query", ""),
                    "item_type": item.get("item_type", ""),
                    "total_products": item.get("total_products", 0),
                    "price_range_min": item.get("price_range", {}).get("min"),
                    "price_range_max": item.get("price_range", {}).get("max"),
                    "price_range_average": item.get("price_range", {}).get("average")
                }
                items_to_insert.append(item_data)
            
            if items_to_insert:
                response = client.table("clothing_items").insert(items_to_insert).execute()
                
                # Save products for each clothing item
                if response.data:
                    for i, clothing_item_record in enumerate(response.data):
                        if i < len(clothing_items) and "products" in clothing_items[i]:
                            self.save_products(clothing_item_record["id"], clothing_items[i]["products"], use_service_client)
                
                return True
            return False
        except Exception as e:
            logger.error(f"Error saving clothing items: {e}")
            return False
    
    def save_products(self, clothing_item_id: str, products: List[Dict], use_service_client: bool = False) -> bool:
        """Save products for a clothing item"""
        try:
            client = self.service_client if use_service_client else self.client
            
            products_to_insert = []
            for product in products:
                product_data = {
                    "clothing_item_id": clothing_item_id,
                    "external_id": product.get("id"),
                    "title": product.get("title", ""),
                    "price": self._parse_price(product.get("price_numeric")),
                    "old_price": self._parse_price(product.get("old_price_numeric")),
                    "discount_percentage": self._parse_int(product.get("discount_percentage")),
                    "image_url": product.get("image_url"),
                    "product_url": product.get("product_url"),
                    "source": product.get("source", ""),
                    "source_icon": product.get("source_icon"),
                    "rating": self._parse_float(product.get("rating")),
                    "review_count": self._parse_int(product.get("review_count")),
                    "delivery_info": product.get("delivery_info"),
                    "tags": product.get("tags", [])
                }
                products_to_insert.append(product_data)
            
            if products_to_insert:
                response = client.table("products").insert(products_to_insert).execute()
                return bool(response.data)
            return False
        except Exception as e:
            logger.error(f"Error saving products: {e}")
            return False
    
    def get_session_with_items_and_products(self, session_id: str) -> Optional[Dict]:
        """Get complete search session with clothing items and products"""
        try:
            # Get session
            session_response = self.client.table("search_sessions").select("*").eq("id", session_id).execute()
            if not session_response.data:
                return None
            
            session = session_response.data[0]
            
            # Get clothing items
            items_response = (self.client.table("clothing_items")
                            .select("*, products(*)")
                            .eq("search_session_id", session_id)
                            .execute())
            
            session["clothing_items"] = items_response.data or []
            return session
        except Exception as e:
            logger.error(f"Error getting session with items and products: {e}")
            return None
    
    # Saved Items (Wishlist) Management
    def add_to_wishlist(self, user_id: str, product_id: str, notes: str = None, tags: List[str] = None) -> Optional[Dict]:
        """Add item to user's wishlist"""
        try:
            # First, validate that the product exists
            product_response = self.client.table("products").select("id, title, source").eq("id", product_id).execute()
            if not product_response.data:
                logger.error(f"Product not found: {product_id}")
                return None
            
            # Check if item is already in wishlist
            existing_response = (self.client.table("user_saved_items")
                               .select("id")
                               .eq("user_id", user_id)
                               .eq("product_id", product_id)
                               .execute())
            
            if existing_response.data:
                logger.warning(f"Product {product_id} already in wishlist for user {user_id}")
                return None  # Could also raise a specific exception here
            
            wishlist_data = {
                "user_id": user_id,
                "product_id": product_id,
                "notes": notes,
                "tags": tags or []
            }
            
            # Insert the wishlist item and return with product details
            response = self.client.table("user_saved_items").insert(wishlist_data).execute()
            
            if response.data:
                wishlist_item = response.data[0]
                # Include product details in the response
                wishlist_item["products"] = product_response.data[0]
                return wishlist_item
            
            return None
        except Exception as e:
            logger.error(f"Error adding to wishlist: {e}")
            return None
    
    def remove_from_wishlist(self, user_id: str, product_id: str) -> bool:
        """Remove item from user's wishlist"""
        try:
            response = (self.client.table("user_saved_items")
                       .delete()
                       .eq("user_id", user_id)
                       .eq("product_id", product_id)
                       .execute())
            return True
        except Exception as e:
            logger.error(f"Error removing from wishlist: {e}")
            return False
    
    def get_user_wishlist(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get user's wishlist with product details"""
        try:
            # Enforce reasonable limits
            limit = min(limit, 100)  # Maximum 100 items per request
            
            response = (self.client.table("user_saved_items")
                       .select("*, products(*)")
                       .eq("user_id", user_id)
                       .order("created_at", desc=True)
                       .range(offset, offset + limit - 1)
                       .execute())
            return response.data or []
        except Exception as e:
            logger.error(f"Error getting user wishlist: {e}")
            return []
    
    def get_wishlist_count(self, user_id: str) -> int:
        """Get total count of items in user's wishlist"""
        try:
            response = (self.client.table("user_saved_items")
                       .select("id", count="exact")
                       .eq("user_id", user_id)
                       .execute())
            return response.count or 0
        except Exception as e:
            logger.error(f"Error getting wishlist count: {e}")
            return 0
    
    def check_wishlist_limit(self, user_id: str, max_items: int = 1000) -> bool:
        """Check if user has reached wishlist limit"""
        try:
            current_count = self.get_wishlist_count(user_id)
            return current_count < max_items
        except Exception as e:
            logger.error(f"Error checking wishlist limit: {e}")
            return False
    
    def is_item_in_wishlist(self, user_id: str, product_id: str) -> bool:
        """Check if item is in user's wishlist"""
        try:
            response = (self.client.table("user_saved_items")
                       .select("id")
                       .eq("user_id", user_id)
                       .eq("product_id", product_id)
                       .execute())
            return bool(response.data)
        except Exception as e:
            logger.error(f"Error checking wishlist: {e}")
            return False
    
    # Search History Management
    def add_to_search_history(self, user_id: str, session_id: str) -> bool:
        """Add search session to user's history"""
        try:
            # Check if we need to clean up old history first (keep last 500 entries per user)
            self.cleanup_old_search_history(user_id, max_entries=500)
            
            history_data = {
                "user_id": user_id,
                "search_session_id": session_id
            }
            response = self.client.table("user_search_history").insert(history_data).execute()
            return bool(response.data)
        except Exception as e:
            logger.error(f"Error adding to search history: {e}")
            return False
    
    def cleanup_old_search_history(self, user_id: str, max_entries: int = 500) -> bool:
        """Clean up old search history entries, keeping only the most recent ones"""
        try:
            # Get count of current entries
            count_response = (self.client.table("user_search_history")
                            .select("id", count="exact")
                            .eq("user_id", user_id)
                            .execute())
            
            current_count = count_response.count
            
            if current_count > max_entries:
                # Get oldest entries to delete
                entries_to_delete = current_count - max_entries
                old_entries_response = (self.client.table("user_search_history")
                                      .select("id")
                                      .eq("user_id", user_id)
                                      .order("created_at", desc=False)
                                      .limit(entries_to_delete)
                                      .execute())
                
                if old_entries_response.data:
                    entry_ids = [entry["id"] for entry in old_entries_response.data]
                    # Delete old entries
                    for entry_id in entry_ids:
                        self.client.table("user_search_history").delete().eq("id", entry_id).execute()
                    
                    logger.info(f"Cleaned up {len(entry_ids)} old search history entries for user {user_id}")
            
            return True
        except Exception as e:
            logger.error(f"Error cleaning up search history: {e}")
            return False

    def get_user_search_history(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get user's search history with session details"""
        try:
            # Enforce reasonable limits
            limit = min(limit, 100)  # Maximum 100 items per request
            
            response = (self.client.table("user_search_history")
                       .select("*, search_sessions(*)")
                       .eq("user_id", user_id)
                       .order("created_at", desc=True)
                       .range(offset, offset + limit - 1)
                       .execute())
            return response.data or []
        except Exception as e:
            logger.error(f"Error getting user search history: {e}")
            return []
    
    # Utility Methods
    def _parse_price(self, value) -> Optional[float]:
        """Parse price value safely"""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _parse_int(self, value) -> Optional[int]:
        """Parse integer value safely"""
        if value is None:
            return None
        try:
            # Handle percentage strings like "20%"
            if isinstance(value, str) and value.endswith('%'):
                value = value[:-1]
            return int(float(value))
        except (ValueError, TypeError):
            return None
    
    def _parse_float(self, value) -> Optional[float]:
        """Parse float value safely"""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    # Health Check
    def health_check(self) -> Dict[str, Any]:
        """Check database connection and return status"""
        try:
            # Simple query to test connection
            response = self.client.table("user_profiles").select("count").execute()
            return {
                "status": "healthy",
                "database": "connected",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    # Anonymous Session Management
    def create_anonymous_search_session(self, file_id: str, image_filename: str, 
                                       image_url: str, country: str = "us", language: str = "en") -> Optional[Dict]:
        """Create a search session for anonymous users"""
        try:
            session_data = {
                "user_id": None,  # Anonymous session
                "file_id": file_id,
                "image_filename": image_filename,
                "image_url": image_url,
                "status": "uploading",
                "country": country,
                "language": language,
                "search_queries": [],
                "num_items_identified": 0,
                "num_products_found": 0
            }
            
            # Use service client for anonymous sessions (bypasses RLS)
            response = self.service_client.table("search_sessions").insert(session_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating anonymous search session: {e}")
            return None
    
    def migrate_anonymous_session_to_user(self, session_id: str, user_id: str) -> bool:
        """Migrate an anonymous search session to a user's account"""
        try:
            # Update the session to assign it to the user
            session_updates = {"user_id": user_id}
            update_response = self.service_client.table("search_sessions").update(session_updates).eq("id", session_id).execute()
            
            if update_response.data:
                # Add to user's search history
                self.add_to_search_history(user_id, session_id)
                logger.info(f"Successfully migrated anonymous session {session_id} to user {user_id}")
                return True
            
            return False
        except Exception as e:
            logger.error(f"Error migrating anonymous session: {e}")
            return False
    
    def cleanup_old_anonymous_sessions(self, days_old: int = 7) -> bool:
        """Clean up old anonymous search sessions"""
        try:
            from datetime import datetime, timedelta
            cutoff_date = (datetime.now() - timedelta(days=days_old)).isoformat()
            
            # Get old anonymous sessions
            old_sessions_response = (self.service_client.table("search_sessions")
                                   .select("id")
                                   .is_("user_id", "null")
                                   .lt("created_at", cutoff_date)
                                   .execute())
            
            if old_sessions_response.data:
                session_ids = [session["id"] for session in old_sessions_response.data]
                
                # Delete associated clothing items and products first (cascade should handle this, but being explicit)
                for session_id in session_ids:
                    # Delete products for this session
                    clothing_items_response = (self.service_client.table("clothing_items")
                                             .select("id")
                                             .eq("search_session_id", session_id)
                                             .execute())
                    
                    if clothing_items_response.data:
                        for item in clothing_items_response.data:
                            self.service_client.table("products").delete().eq("clothing_item_id", item["id"]).execute()
                        
                        # Delete clothing items
                        self.service_client.table("clothing_items").delete().eq("search_session_id", session_id).execute()
                    
                    # Delete the session
                    self.service_client.table("search_sessions").delete().eq("id", session_id).execute()
                
                logger.info(f"Cleaned up {len(session_ids)} old anonymous sessions")
            
            return True
        except Exception as e:
            logger.error(f"Error cleaning up anonymous sessions: {e}")
            return False

# Global database service instance
db_service = DatabaseService() 