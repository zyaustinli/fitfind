"""
Authentication middleware for FitFind application
Handles JWT token validation and user context management
"""

import os
import jwt
import json
from functools import wraps
from flask import request, jsonify, g
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class AuthMiddleware:
    def __init__(self, supabase_jwt_secret: str):
        """Initialize with Supabase JWT secret"""
        self.jwt_secret = supabase_jwt_secret
    
    def extract_token_from_header(self) -> Optional[str]:
        """Extract JWT token from Authorization header"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None
        
        # Expected format: "Bearer <token>"
        parts = auth_header.split(' ')
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None
        
        return parts[1]
    
    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate JWT token and return payload"""
        try:
            # Decode the JWT token using Supabase's JWT secret
            payload = jwt.decode(
                token, 
                self.jwt_secret, 
                algorithms=['HS256'],
                options={
                    "verify_aud": False,  # Supabase tokens don't always have aud
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True
                }
            )
            
            # Validate required fields
            if not payload.get('sub'):
                logger.warning("Token missing 'sub' field")
                return None
                
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidSignatureError:
            logger.warning("Invalid token signature")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Error validating token: {e}")
            return None
    
    def get_user_from_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Extract user information from JWT token"""
        payload = self.validate_token(token)
        if not payload:
            return None
        
        return {
            'id': payload.get('sub'),
            'email': payload.get('email'),
            'role': payload.get('role'),
            'aud': payload.get('aud'),
            'exp': payload.get('exp'),
            'iat': payload.get('iat'),
            'user_metadata': payload.get('user_metadata', {}),
            'app_metadata': payload.get('app_metadata', {})
        }

def create_auth_middleware():
    """Create auth middleware instance with Supabase JWT secret"""
    jwt_secret = os.getenv('SUPABASE_JWT_SECRET')
    
    if not jwt_secret:
        raise ValueError(
            "SUPABASE_JWT_SECRET is required. Get it from: "
            "Supabase Dashboard -> Settings -> API -> JWT Settings"
        )
    
    return AuthMiddleware(jwt_secret)

# Global auth middleware instance
try:
    auth_middleware = create_auth_middleware()
    logger.info("Auth middleware initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize auth middleware: {e}")
    raise

def require_auth(f):
    """Decorator to require authentication for a route"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = auth_middleware.extract_token_from_header()
        if not token:
            return jsonify({
                'error': 'Authentication required',
                'message': 'No authorization token provided'
            }), 401
        
        user = auth_middleware.get_user_from_token(token)
        if not user:
            return jsonify({
                'error': 'Authentication failed', 
                'message': 'Invalid or expired token'
            }), 401
        
        # Store user in Flask's g object for use in the route
        g.current_user = user
        g.auth_token = token
        
        return f(*args, **kwargs)
    
    return decorated_function

def optional_auth(f):
    """Decorator for routes that work with or without authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = auth_middleware.extract_token_from_header()
        user = None
        
        if token:
            user = auth_middleware.get_user_from_token(token)
            if not user:
                logger.warning("Invalid token provided in optional auth")
        
        # Store user in Flask's g object (may be None)
        g.current_user = user
        g.auth_token = token
        
        return f(*args, **kwargs)
    
    return decorated_function

def get_current_user() -> Optional[Dict[str, Any]]:
    """Get current authenticated user from Flask's g object"""
    return getattr(g, 'current_user', None)

def get_current_user_id() -> Optional[str]:
    """Get current authenticated user ID"""
    user = get_current_user()
    return user.get('id') if user else None

def is_authenticated() -> bool:
    """Check if current request is authenticated"""
    return get_current_user() is not None 