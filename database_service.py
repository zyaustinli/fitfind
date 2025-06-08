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
import uuid
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
        # This method is no longer needed since we use service_client for backend operations
        # The backend has already verified the user via JWT middleware
        try:
            logger.info("User context set (using service client for backend operations)")
            return True
        except Exception as e:
            logger.error(f"Failed to set user context: {e}")
            return False
    
    # User Profile Management
    def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """Get user profile by ID"""
        try:
            response = self.service_client.table("user_profiles").select("*").eq("id", user_id).execute()
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
            response = self.service_client.table("user_profiles").insert(profile_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating user profile: {e}")
            return None
    
    def update_user_profile(self, user_id: str, updates: Dict) -> Optional[Dict]:
        """Update user profile"""
        try:
            response = self.service_client.table("user_profiles").update(updates).eq("id", user_id).execute()
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
            # Use service client to bypass RLS - backend has already authenticated user
            response = self.service_client.table("search_sessions").insert(session_data).execute()
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
            # Always use service client for backend operations
            response = self.service_client.table("search_sessions").update(updates).eq("id", session_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating search session: {e}")
            return None
    
    def get_search_session(self, session_id: str) -> Optional[Dict]:
        """Get search session by ID"""
        try:
            response = self.service_client.table("search_sessions").select("*").eq("id", session_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting search session: {e}")
            return None
    
    def get_search_session_by_file_id(self, file_id: str) -> Optional[Dict]:
        """Get search session by file ID"""
        try:
            response = self.service_client.table("search_sessions").select("*").eq("file_id", file_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting search session by file_id: {e}")
            return None
    
    def get_user_search_sessions(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get user's search sessions with pagination"""
        try:
            response = (self.service_client.table("search_sessions")
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
            # ALWAYS use service_client for backend operations
            # The backend has already verified the user owns this session
            client = self.service_client
            
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
                            self.save_products(clothing_item_record["id"], clothing_items[i]["products"], True)  # Always pass True
                
                return True
            return False
        except Exception as e:
            logger.error(f"Error saving clothing items: {e}")
            return False
    
    def save_products(self, clothing_item_id: str, products: List[Dict], use_service_client: bool = True) -> bool:
        """Save products for a clothing item"""
        try:
            # Always use service client for backend operations
            client = self.service_client
            
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
    def _is_valid_uuid(self, val):
        try:
            uuid.UUID(str(val))
            return True
        except ValueError:
            return False
    # Saved Items (Wishlist) Management
    def add_to_wishlist(self, user_id: str, product_id: str, notes: str = None, tags: List[str] = None) -> Optional[Dict]:
        """Add item to user's wishlist using either the internal product UUID or the external ID."""
        try:
            internal_product_uuid = None
            product_data = None

            # The frontend might send an internal UUID from the history page,
            # or an external_id from the main search page. We handle both.
            if self._is_valid_uuid(product_id):
                # If it looks like a UUID, assume it's the internal `id`.
                product_response = self.service_client.table("products").select("*, id").eq("id", product_id).limit(1).execute()
                if product_response.data:
                    product_data = product_response.data[0]
                    internal_product_uuid = product_data['id']
                else:
                    # Fallback: It's a UUID but not an internal one, so it must be an external_id.
                    product_response = self.service_client.table("products").select("*, id").eq("external_id", product_id).limit(1).execute()
            else:
                # If not a UUID, it must be an `external_id`.
                product_response = self.service_client.table("products").select("*, id").eq("external_id", product_id).limit(1).execute()

            # After trying the lookups, check if we found a product.
            if not product_response or not product_response.data:
                logger.error(f"Product not found with provided ID: {product_id}")
                return None

            if not product_data:
                product_data = product_response.data[0]
                internal_product_uuid = product_data['id']

            # Now, check if this item is already in the user's wishlist
            existing_response = (self.service_client.table("user_saved_items")
                               .select("id")
                               .eq("user_id", user_id)
                               .eq("product_id", internal_product_uuid)
                               .execute())

            if existing_response.data:
                logger.warning(f"Product {product_id} is already in the wishlist for user {user_id}")
                return None

            # Insert the new wishlist item
            wishlist_data = {
                "user_id": user_id,
                "product_id": internal_product_uuid,
                "notes": notes,
                "tags": tags or []
            }
            insert_response = self.service_client.table("user_saved_items").insert(wishlist_data).execute()

            if insert_response.data:
                wishlist_item = insert_response.data[0]
                # Attach the full product details for the frontend response
                wishlist_item["products"] = product_data
                return wishlist_item
            
            return None
        except Exception as e:
            logger.error(f"Error adding to wishlist: {e}")
            #traceback.print_exc()
            return None
    
    def remove_from_wishlist(self, user_id: str, product_id: str) -> bool:
        """Remove item from user's wishlist using external product ID"""
        try:
            # Find the internal product UUID from the external ID
            product_response = self.service_client.table("products").select("id").eq("external_id", product_id).limit(1).execute()
            if not product_response.data:
                logger.warning(f"Product not found for removal with external_id: {product_id}")
                return False

            internal_product_uuid = product_response.data[0]['id']

            response = (self.service_client.table("user_saved_items")
                       .delete()
                       .eq("user_id", user_id)
                       .eq("product_id", internal_product_uuid) # Use the internal UUID
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
            
            response = (self.service_client.table("user_saved_items")
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
            response = (self.service_client.table("user_saved_items")
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
        """Check if item is in user's wishlist using external product ID"""
        try:
            # Find the internal product UUID from the external ID
            product_response = self.service_client.table("products").select("id").eq("external_id", product_id).limit(1).execute()
            if not product_response.data:
                return False # Product doesn't exist

            internal_product_uuid = product_response.data[0]['id']

            response = (self.service_client.table("user_saved_items")
                       .select("id")
                       .eq("user_id", user_id)
                       .eq("product_id", internal_product_uuid)
                       .execute())
            return bool(response.data)
        except Exception as e:
            logger.error(f"Error checking wishlist: {e}")
            return False

    def update_wishlist_item(self, wishlist_item_id: str, user_id: str, updates: Dict) -> Optional[Dict]:
        """Update a wishlist item's notes or tags"""
        try:
            allowed_updates = {k: v for k, v in updates.items() if k in ['notes', 'tags']}
            if not allowed_updates:
                return None

            response = (self.service_client.table("user_saved_items")
                       .update(allowed_updates)
                       .eq("id", wishlist_item_id)
                       .eq("user_id", user_id)
                       .execute())

            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating wishlist item {wishlist_item_id}: {e}")
            return None
    
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
            # Use service client for backend operations
            response = self.service_client.table("user_search_history").insert(history_data).execute()
            return bool(response.data)
        except Exception as e:
            logger.error(f"Error adding to search history: {e}")
            return False
    
    def cleanup_old_search_history(self, user_id: str, max_entries: int = 500) -> bool:
        """Clean up old search history entries, keeping only the most recent ones"""
        try:
            # Get count of current entries
            count_response = (self.service_client.table("user_search_history")
                            .select("id", count="exact")
                            .eq("user_id", user_id)
                            .execute())
            
            current_count = count_response.count
            
            if current_count > max_entries:
                # Get oldest entries to delete
                entries_to_delete = current_count - max_entries
                old_entries_response = (self.service_client.table("user_search_history")
                                      .select("id")
                                      .eq("user_id", user_id)
                                      .order("created_at", desc=False)
                                      .limit(entries_to_delete)
                                      .execute())
                
                if old_entries_response.data:
                    entry_ids = [entry["id"] for entry in old_entries_response.data]
                    # Delete old entries
                    for entry_id in entry_ids:
                        self.service_client.table("user_search_history").delete().eq("id", entry_id).execute()
                    
                    logger.info(f"Cleaned up {len(entry_ids)} old search history entries for user {user_id}")
            
            return True
        except Exception as e:
            logger.error(f"Error cleaning up search history: {e}")
            return False

    def get_user_search_history(self, user_id: str, limit: int = 50, offset: int = 0, include_details: bool = False) -> List[Dict]:
        """Get user's search history with session details and optionally full results"""
        try:
            # Enforce reasonable limits
            limit = min(limit, 100)  # Maximum 100 items per request
            
            if include_details:
                # Get detailed results with clothing items and products
                response = (self.service_client.table("user_search_history")
                           .select("""
                               *,
                               search_sessions(
                                   *,
                                   clothing_items(
                                       *,
                                       products(*)
                                   )
                               )
                           """)
                           .eq("user_id", user_id)
                           .is_("deleted_at", "null")
                           .order("created_at", desc=True)
                           .range(offset, offset + limit - 1)
                           .execute())
            else:
                # Get basic session info only
                response = (self.service_client.table("user_search_history")
                           .select("*, search_sessions(*)")
                           .eq("user_id", user_id)
                           .is_("deleted_at", "null")
                           .order("created_at", desc=True)
                           .range(offset, offset + limit - 1)
                           .execute())
            
            return response.data or []
        except Exception as e:
            logger.error(f"Error getting user search history: {e}")
            return []
    
    def soft_delete_search_history_item(self, user_id: str, history_id: str) -> bool:
        """Soft delete a search history item (hide from user's view)"""
        try:
            # Update the history item to set deleted_at timestamp
            response = (self.service_client.table("user_search_history")
                       .update({"deleted_at": datetime.now().isoformat()})
                       .eq("id", history_id)
                       .eq("user_id", user_id)
                       .is_("deleted_at", "null")  # Only delete if not already deleted
                       .execute())
            
            if response.data:
                logger.info(f"Successfully soft deleted search history item {history_id} for user {user_id}")
                return True
            else:
                logger.warning(f"Search history item {history_id} not found or already deleted for user {user_id}")
                return False
        except Exception as e:
            logger.error(f"Error soft deleting search history item {history_id}: {e}")
            return False

    def restore_search_history_item(self, user_id: str, history_id: str) -> bool:
        """Restore a soft deleted search history item"""
        try:
            # Update the history item to clear deleted_at timestamp
            response = (self.service_client.table("user_search_history")
                       .update({"deleted_at": None})
                       .eq("id", history_id)
                       .eq("user_id", user_id)
                       .not_.is_("deleted_at", "null")  # Only restore if actually deleted
                       .execute())
            
            if response.data:
                logger.info(f"Successfully restored search history item {history_id} for user {user_id}")
                return True
            else:
                logger.warning(f"Search history item {history_id} not found or not deleted for user {user_id}")
                return False
        except Exception as e:
            logger.error(f"Error restoring search history item {history_id}: {e}")
            return False
    
    def get_search_session_details(self, session_id: str, user_id: str) -> Optional[Dict]:
        """Get complete search session details with all clothing items and products"""
        try:
            # First verify the session belongs to the user
            session_check = (self.service_client.table("search_sessions")
                           .select("user_id")
                           .eq("id", session_id)
                           .eq("user_id", user_id)
                           .execute())
            
            if not session_check.data:
                logger.warning(f"Session {session_id} not found or doesn't belong to user {user_id}")
                return None
            
            # Get complete session details
            response = (self.service_client.table("search_sessions")
                       .select("""
                           *,
                           clothing_items(
                               *,
                               products(*)
                           )
                       """)
                       .eq("id", session_id)
                       .execute())
            
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error getting search session details for session {session_id}: {e}")
            return None
    
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
            response = self.service_client.table("user_profiles").select("count").execute()
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