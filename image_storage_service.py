"""
Image storage service using Supabase Storage
Handles uploading, retrieving, and managing outfit images
"""

import os
import uuid
import mimetypes
from typing import Optional, Dict, Any
from supabase import create_client, Client
from werkzeug.datastructures import FileStorage
import logging

logger = logging.getLogger(__name__)

class ImageStorageService:
    def __init__(self):
        """Initialize Supabase client for storage operations"""
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not all([self.supabase_url, self.supabase_service_key]):
            raise ValueError("Missing Supabase configuration for storage service")
        
        # Use service role key for storage operations
        self.client: Client = create_client(self.supabase_url, self.supabase_service_key)
        self.bucket_name = "outfit-images"
    
    def upload_image(self, file: FileStorage, user_id: Optional[str] = None, file_id: str = None) -> Dict[str, Any]:
        """
        Upload an image to Supabase Storage
        
        Args:
            file: The uploaded file
            user_id: ID of the authenticated user (None for anonymous)
            file_id: Unique identifier for the file
            
        Returns:
            Dict containing success status, public URL, and metadata
        """
        try:
            # Generate unique filename
            if not file_id:
                file_id = str(uuid.uuid4())
            
            # Get file extension
            original_filename = file.filename or "image"
            file_extension = os.path.splitext(original_filename)[1] or '.jpg'
            
            # Create storage path
            if user_id:
                # Authenticated user: store in user-specific folder
                storage_path = f"{user_id}/{file_id}{file_extension}"
            else:
                # Anonymous user: store in anonymous folder with expiration
                storage_path = f"anonymous/{file_id}{file_extension}"
            
            # Get file content
            file.seek(0)  # Reset file pointer
            file_content = file.read()
            
            # Determine content type
            content_type = file.content_type or mimetypes.guess_type(original_filename)[0] or 'image/jpeg'
            
            # Upload to Supabase Storage
            result = self.client.storage.from_(self.bucket_name).upload(
                path=storage_path,
                file=file_content,
                file_options={
                    "content-type": content_type,
                    "cache-control": "3600"  # Cache for 1 hour
                }
            )
            
            if hasattr(result, 'error') and result.error:
                raise Exception(f"Storage upload error: {result.error}")
            
            # Get public URL
            public_url = self.client.storage.from_(self.bucket_name).get_public_url(storage_path)
            
            return {
                "success": True,
                "public_url": public_url,
                "storage_path": storage_path,
                "file_id": file_id,
                "file_size": len(file_content),
                "content_type": content_type,
                "original_filename": original_filename
            }
            
        except Exception as e:
            logger.error(f"Error uploading image: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def delete_image(self, storage_path: str) -> Dict[str, Any]:
        """
        Delete an image from Supabase Storage
        
        Args:
            storage_path: The storage path of the image to delete
            
        Returns:
            Dict containing success status
        """
        try:
            result = self.client.storage.from_(self.bucket_name).remove([storage_path])
            
            if hasattr(result, 'error') and result.error:
                raise Exception(f"Storage delete error: {result.error}")
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Error deleting image: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def cleanup_anonymous_images(self, older_than_hours: int = 24) -> Dict[str, Any]:
        """
        Clean up old anonymous images
        
        Args:
            older_than_hours: Delete images older than this many hours
            
        Returns:
            Dict containing cleanup results
        """
        try:
            # List all files in anonymous folder
            result = self.client.storage.from_(self.bucket_name).list("anonymous")
            
            if hasattr(result, 'error') and result.error:
                raise Exception(f"Error listing anonymous images: {result.error}")
            
            # Filter files older than threshold
            from datetime import datetime, timedelta
            cutoff_time = datetime.now() - timedelta(hours=older_than_hours)
            
            old_files = []
            for file_info in result:
                # Parse created_at timestamp and compare
                created_at = datetime.fromisoformat(file_info['created_at'].replace('Z', '+00:00'))
                if created_at < cutoff_time:
                    old_files.append(f"anonymous/{file_info['name']}")
            
            # Delete old files
            if old_files:
                delete_result = self.client.storage.from_(self.bucket_name).remove(old_files)
                if hasattr(delete_result, 'error') and delete_result.error:
                    raise Exception(f"Error deleting old files: {delete_result.error}")
            
            return {
                "success": True,
                "deleted_count": len(old_files),
                "deleted_files": old_files
            }
            
        except Exception as e:
            logger.error(f"Error cleaning up anonymous images: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_image_bytes(self, storage_path: str) -> Dict[str, Any]:
        """
        Retrieve image bytes from Supabase Storage
        
        Args:
            storage_path: The storage path of the image to retrieve
            
        Returns:
            Dict containing success status and image bytes
        """
        try:
            logger.info(f"Attempting to download image from storage path: {storage_path}")
            
            # Download the image from Supabase Storage
            result = self.client.storage.from_(self.bucket_name).download(storage_path)
            
            logger.info(f"Download result type: {type(result)}")
            
            # Check if the result has an error attribute
            if hasattr(result, 'error') and result.error:
                logger.error(f"Storage download error: {result.error}")
                raise Exception(f"Storage download error: {result.error}")
            
            # The result should be bytes directly
            if isinstance(result, bytes):
                logger.info(f"Successfully downloaded {len(result)} bytes from storage")
                return {
                    "success": True,
                    "image_bytes": result
                }
            else:
                logger.error(f"Unexpected result type from storage download: {type(result)}")
                return {
                    "success": False,
                    "error": f"Unexpected result type: {type(result)}"
                }
            
        except Exception as e:
            logger.error(f"Error retrieving image bytes from path '{storage_path}': {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check if storage service is healthy
        
        Returns:
            Dict containing health status
        """
        try:
            # Try to list buckets to test connection
            result = self.client.storage.list_buckets()
            
            if hasattr(result, 'error') and result.error:
                raise Exception(f"Storage health check failed: {result.error}")
            
            # Check if our bucket exists
            bucket_exists = any(bucket['name'] == self.bucket_name for bucket in result)
            
            return {
                "status": "healthy",
                "bucket_exists": bucket_exists,
                "bucket_name": self.bucket_name
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }

# Global storage service instance
storage_service = ImageStorageService() 