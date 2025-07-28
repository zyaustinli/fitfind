# Load environment variables first, before any other imports
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, render_template, send_from_directory, g
from flask_cors import CORS
import os
import uuid
from werkzeug.utils import secure_filename
import json
import jwt
from search_recommendation import outfit_recommendation_with_cleaned_data
import traceback
from datetime import datetime
import logging
import gzip
from functools import wraps

# Setup logging
if os.getenv('FLASK_ENV') == 'production':
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('fitfind.log')
        ]
    )
else:
    logging.basicConfig(level=logging.DEBUG)

logger = logging.getLogger(__name__)

# Import database and auth services
from database_service import db_service
from auth_middleware import require_auth, optional_auth, get_current_user, get_current_user_id, is_authenticated

app = Flask(__name__)

# Production security configuration
if os.getenv('FLASK_ENV') == 'production':
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Configure CORS based on environment
if os.getenv('FLASK_ENV') == 'production':
    # In production, allow specific origins
    frontend_url = os.getenv('FRONTEND_URL', 'https://fitfind-frontend.vercel.app')
    CORS(app, origins=[frontend_url])
else:
    # In development, allow all origins
    CORS(app)

# Add security headers
@app.after_request
def after_request(response):
    if os.getenv('FLASK_ENV') == 'production':
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Content-Security-Policy'] = "default-src 'self'"
    
    # Enable compression for text responses
    if response.content_type.startswith('text/') or response.content_type.startswith('application/json'):
        response.headers['Vary'] = 'Accept-Encoding'
    
    return response

# Configuration
UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)
os.makedirs('static', exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULTS_FOLDER'] = RESULTS_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Production error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    if os.getenv('FLASK_ENV') == 'production':
        logger.error(f"Internal server error: {error}")
        return jsonify({'error': 'Internal server error'}), 500
    return jsonify({'error': str(error)}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large. Maximum size is 16MB'}), 413

@app.errorhandler(429)
def ratelimit_handler(error):
    return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429

def setup_db_context():
    """Helper function to set up database context for authenticated requests"""
    # No longer needed since we use service_client for all backend operations
    # The backend has already authenticated users via JWT middleware
    pass

@app.route('/')
def index():
    """Serve the main frontend page"""
    return render_template('index.html')

# Authentication and User Management Endpoints

@app.route('/api/auth/status', methods=['GET'])
@optional_auth
def auth_status():
    """Check authentication status and user info"""
    user = get_current_user()
    return jsonify({
        'authenticated': user is not None,
        'user': user,
        'has_profile': False if not user else db_service.get_user_profile(user['id']) is not None
    })

@app.route('/api/auth/profile', methods=['GET'])
@require_auth
def get_profile():
    """Get current user's profile"""
    try:
        user_id = get_current_user_id()
        profile = db_service.get_user_profile(user_id)
        
        if not profile:
            # Create profile if it doesn't exist
            user = get_current_user()
            profile = db_service.create_user_profile(
                user_id=user_id,
                email=user.get('email'),
                full_name=user.get('user_metadata', {}).get('full_name') or user.get('full_name')
            )
        
        return jsonify({
            'success': True,
            'profile': profile
        })
    except Exception as e:
        print(f"Error getting profile: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error getting profile: {str(e)}'
        }), 500

@app.route('/api/auth/profile', methods=['PUT'])
@require_auth
def update_profile():
    """Update current user's profile"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Only allow updating certain fields
        allowed_fields = ['full_name', 'avatar_url', 'preferences']
        updates = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not updates:
            return jsonify({
                'success': False,
                'error': 'No valid fields to update'
            }), 400
        
        profile = db_service.update_user_profile(user_id, updates)
        
        return jsonify({
            'success': True,
            'profile': profile
        })
    except Exception as e:
        print(f"Error updating profile: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error updating profile: {str(e)}'
        }), 500

# Search History Endpoints

@app.route('/api/history', methods=['GET'])
@require_auth
def get_search_history():
    """Get user's search history with optional detailed results"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Authentication required',
                'error_code': 'AUTH_MISSING'
            }), 401
            
        # Validate and sanitize parameters
        try:
            limit = min(int(request.args.get('limit', 50)), 100)  # Cap at 100
            offset = max(int(request.args.get('offset', 0)), 0)   # Ensure non-negative
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Invalid pagination parameters',
                'error_code': 'INVALID_PARAMS'
            }), 400
            
        include_details = request.args.get('include_details', 'false').lower() == 'true'
        
        # Get search history with enhanced error handling
        history = db_service.get_user_search_history(user_id, limit, offset, include_details)
        if history is None:
            return jsonify({
                'success': False,
                'error': 'Failed to retrieve search history due to database connection issues',
                'error_code': 'DB_CONNECTION_ERROR'
            }), 503
        
        # Get total count with timeout and retry
        try:
            total_count_response = db_service.service_client.table("user_search_history").select("id", count="exact").eq("user_id", user_id).is_("deleted_at", "null").execute()
            total_count = total_count_response.count or 0
        except Exception as count_error:
            print(f"Warning: Could not get total count for user {user_id}: {count_error}")
            # Fallback: estimate count based on returned results
            total_count = len(history) if len(history) < limit else len(history) + 1
        
        return jsonify({
            'success': True,
            'history': history,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'has_more': len(history) == limit,
                'total_count': total_count
            },
            'include_details': include_details
        })
    except jwt.ExpiredSignatureError:
        print(f"Expired token for search history request")
        return jsonify({
            'success': False,
            'error': 'Authentication token has expired. Please sign in again.',
            'error_code': 'TOKEN_EXPIRED'
        }), 401
    except jwt.InvalidTokenError:
        print(f"Invalid token for search history request")
        return jsonify({
            'success': False,
            'error': 'Invalid authentication token. Please sign in again.',
            'error_code': 'TOKEN_INVALID'
        }), 401
    except ConnectionError as conn_error:
        print(f"Database connection error getting search history: {conn_error}")
        return jsonify({
            'success': False,
            'error': 'Database connection temporarily unavailable. Please try again.',
            'error_code': 'DB_CONNECTION_ERROR'
        }), 503
    except TimeoutError:
        print(f"Timeout getting search history for user {user_id}")
        return jsonify({
            'success': False,
            'error': 'Request timed out. Please try again.',
            'error_code': 'TIMEOUT'
        }), 504
    except Exception as e:
        # Enhanced error logging with more context
        error_type = type(e).__name__
        error_msg = str(e)
        print(f"Unexpected error getting search history for user {user_id}: {error_type} - {error_msg}")
        
        # Try to provide more specific error messages based on common issues
        if 'postgrest' in error_msg.lower():
            error_response = 'Database query failed. Please try again.'
            error_code = 'DB_QUERY_ERROR'
        elif 'timeout' in error_msg.lower():
            error_response = 'Request timed out. Please try again.'
            error_code = 'TIMEOUT'
        elif 'connection' in error_msg.lower():
            error_response = 'Database connection issue. Please try again.'
            error_code = 'DB_CONNECTION_ERROR'
        else:
            error_response = 'An unexpected error occurred. Please try again.'
            error_code = 'INTERNAL_ERROR'
        
        return jsonify({
            'success': False,
            'error': error_response,
            'error_code': error_code,
            'error_type': error_type
        }), 500

@app.route('/api/history/<history_id>', methods=['DELETE'])
@require_auth
def delete_search_history_item(history_id):
    """Soft delete a search history item"""
    try:
        user_id = get_current_user_id()
        
        success = db_service.soft_delete_search_history_item(user_id, history_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Search history item deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Search history item not found or already deleted'
            }), 404
    except Exception as e:
        print(f"Error deleting search history item: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error deleting search history item: {str(e)}'
        }), 500

@app.route('/api/history/<session_id>', methods=['GET'])
@require_auth
def get_search_session_details(session_id):
    """Get detailed information for a specific search session"""
    try:
        user_id = get_current_user_id()
        
        session_details = db_service.get_search_session_details(session_id, user_id)
        
        if not session_details:
            return jsonify({
                'success': False,
                'error': 'Search session not found or access denied'
            }), 404
        
        return jsonify({
            'success': True,
            'session': session_details
        })
    except Exception as e:
        print(f"Error getting search session details: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error getting search session details: {str(e)}'
        }), 500

# Wishlist Endpoints

@app.route('/api/wishlist', methods=['GET'])
@require_auth
def get_wishlist():
    """Get user's wishlist"""
    try:
        user_id = get_current_user_id()
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        wishlist = db_service.get_user_wishlist(user_id, limit, offset)
        total_count = db_service.get_wishlist_count(user_id)
        
        return jsonify({
            'success': True,
            'wishlist': wishlist,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'has_more': len(wishlist) == limit,
                'total_count': total_count
            }
        })
    except Exception as e:
        print(f"Error getting wishlist: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error getting wishlist: {str(e)}'
        }), 500

@app.route('/api/wishlist/add', methods=['POST'])
@require_auth
def add_to_wishlist():
    """Add item to user's wishlist"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data or 'product_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Product ID is required'
            }), 400
        
        product_id = data['product_id']
        notes = data.get('notes')
        tags = data.get('tags', [])
        
        # Check wishlist limit (optional, adjust as needed)
        if not db_service.check_wishlist_limit(user_id, max_items=1000):
            return jsonify({
                'success': False,
                'error': 'Wishlist limit reached (1000 items maximum)'
            }), 400
        
        # Add to wishlist
        wishlist_item = db_service.add_to_wishlist(user_id, product_id, notes, tags)
        
        if wishlist_item:
            return jsonify({
                'success': True,
                'item': wishlist_item,
                'message': 'Item added to wishlist successfully'
            })
        else:
            # Check if it's already in wishlist or product doesn't exist
            if db_service.is_item_in_wishlist(user_id, product_id):
                return jsonify({
                    'success': False,
                    'error': 'Item is already in your wishlist'
                }), 400
            else:
                return jsonify({
                    'success': False,
                    'error': 'Product not found or could not be added to wishlist'
                }), 400
    except Exception as e:
        print(f"Error adding to wishlist: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error adding to wishlist: {str(e)}'
        }), 500

@app.route('/api/wishlist/remove', methods=['POST'])
@require_auth
def remove_from_wishlist():
    """Remove item from user's wishlist"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data or 'product_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Product ID is required'
            }), 400
        
        product_id = data['product_id']
        
        # Remove from wishlist
        success = db_service.remove_from_wishlist(user_id, product_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Item removed from wishlist successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to remove item from wishlist'
            }), 400
    except Exception as e:
        print(f"Error removing from wishlist: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error removing from wishlist: {str(e)}'
        }), 500

@app.route('/api/wishlist/check', methods=['POST'])
@require_auth
def check_wishlist_status():
    """Check if items are in user's wishlist"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request data is required'
            }), 400
        
        # Handle both single product_id and array of product_ids
        if 'product_id' in data:
            product_ids = [data['product_id']]
        elif 'product_ids' in data:
            product_ids = data['product_ids']
        else:
            return jsonify({
                'success': False,
                'error': 'product_id or product_ids is required'
            }), 400
        
        # Check wishlist status for each product
        wishlist_status = {}
        for product_id in product_ids:
            wishlist_status[product_id] = db_service.is_item_in_wishlist(user_id, product_id)
        
        return jsonify({
            'success': True,
            'wishlist_status': wishlist_status
        })
    except Exception as e:
        print(f"Error checking wishlist status: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error checking wishlist status: {str(e)}'
        }), 500

@app.route('/api/wishlist/update', methods=['PUT'])
@require_auth
def update_wishlist_item():
    """Update a wishlist item (notes, tags)"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()

        if not data or 'wishlist_item_id' not in data:
            return jsonify({'success': False, 'error': 'Wishlist Item ID is required'}), 400

        wishlist_item_id = data['wishlist_item_id']
        updates = data.get('updates', {})

        if not updates:
            return jsonify({'success': False, 'error': 'No update data provided'}), 400

        updated_item = db_service.update_wishlist_item(wishlist_item_id, user_id, updates)

        if updated_item:
            return jsonify({
                'success': True,
                'item': updated_item,
                'message': 'Wishlist item updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update wishlist item. It may not exist or you may not have permission.'
            }), 404
    except Exception as e:
        print(f"Error updating wishlist item: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error updating wishlist item: {str(e)}'
        }), 500

# Collections Endpoints

@app.route('/api/collections', methods=['GET'])
@require_auth
def get_collections():
    """Get user's collections"""
    try:
        user_id = get_current_user_id()
        collections = db_service.get_collections_by_user(user_id)
        
        return jsonify({
            'success': True,
            'collections': collections
        })
    except Exception as e:
        print(f"Error getting collections: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error getting collections: {str(e)}'
        }), 500

@app.route('/api/collections', methods=['POST'])
@require_auth
def create_collection():
    """Create a new collection"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data or 'name' not in data:
            return jsonify({
                'success': False,
                'error': 'Collection name is required'
            }), 400
        
        name = data['name']
        description = data.get('description')
        is_private = data.get('is_private', False)
        
        # Check for duplicate collection names
        existing_collections = db_service.get_collections_by_user(user_id)
        if any(collection['name'].lower() == name.lower() for collection in existing_collections):
            return jsonify({
                'success': False,
                'error': 'A collection with this name already exists'
            }), 400
        
        collection = db_service.create_collection(user_id, name, description, is_private)
        
        if collection:
            # Add item_count for consistency
            collection['item_count'] = 0
            return jsonify({
                'success': True,
                'collection': collection,
                'message': 'Collection created successfully'
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create collection'
            }), 400
    except Exception as e:
        print(f"Error creating collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error creating collection: {str(e)}'
        }), 500

@app.route('/api/collections/<collection_id>/items', methods=['GET'])
@require_auth
def get_collection_items(collection_id):
    """Get items in a collection with pagination"""
    try:
        user_id = get_current_user_id()
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        # Get collection details
        collection = db_service.get_collection_by_id(collection_id, user_id)
        if not collection:
            return jsonify({
                'success': False,
                'error': 'Collection not found'
            }), 404
        
        # Get items in collection
        items = db_service.get_items_in_collection(collection_id, user_id, limit, offset)
        total_count = db_service.get_collection_items_count(collection_id)
        
        return jsonify({
            'success': True,
            'collection': collection,
            'items': items,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'has_more': len(items) == limit,
                'total_count': total_count
            }
        })
    except Exception as e:
        print(f"Error getting collection items: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error getting collection items: {str(e)}'
        }), 500

@app.route('/api/collections/<collection_id>', methods=['PUT'])
@require_auth
def update_collection(collection_id):
    """Update a collection"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Check if collection exists and belongs to user
        existing_collection = db_service.get_collection_by_id(collection_id, user_id)
        if not existing_collection:
            return jsonify({
                'success': False,
                'error': 'Collection not found'
            }), 404
        
        # Prevent renaming the default collection
        if existing_collection.get('name') == 'My Favorites' and 'name' in data:
            if data['name'] != 'My Favorites':
                return jsonify({
                    'success': False,
                    'error': 'Cannot rename the default "My Favorites" collection'
                }), 400
        
        # Check for duplicate names if name is being updated
        if 'name' in data and data['name'] != existing_collection.get('name'):
            existing_collections = db_service.get_collections_by_user(user_id)
            if any(collection['name'].lower() == data['name'].lower() for collection in existing_collections):
                return jsonify({
                    'success': False,
                    'error': 'A collection with this name already exists'
                }), 400
        
        updated_collection = db_service.update_collection(collection_id, user_id, data)
        
        if updated_collection:
            return jsonify({
                'success': True,
                'collection': updated_collection,
                'message': 'Collection updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update collection'
            }), 400
    except Exception as e:
        print(f"Error updating collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error updating collection: {str(e)}'
        }), 500

@app.route('/api/collections/<collection_id>', methods=['DELETE'])
@require_auth
def delete_collection(collection_id):
    """Delete a collection"""
    try:
        user_id = get_current_user_id()
        
        # Check if collection exists and belongs to user
        existing_collection = db_service.get_collection_by_id(collection_id, user_id)
        if not existing_collection:
            return jsonify({
                'success': False,
                'error': 'Collection not found'
            }), 404
        
        # Prevent deleting the default collection
        if existing_collection.get('name') == 'My Favorites':
            return jsonify({
                'success': False,
                'error': 'Cannot delete the default "My Favorites" collection'
            }), 400
        
        success = db_service.delete_collection(collection_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Collection deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete collection'
            }), 400
    except Exception as e:
        print(f"Error deleting collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error deleting collection: {str(e)}'
        }), 500

@app.route('/api/collections/<collection_id>/items', methods=['POST'])
@require_auth
def add_item_to_collection(collection_id):
    """Add an item to a collection"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()
        
        if not data or 'saved_item_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Saved item ID is required'
            }), 400
        
        saved_item_id = data['saved_item_id']
        
        result = db_service.add_item_to_collection(collection_id, saved_item_id, user_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Item added to collection successfully'
            })
        else:
            # Return specific error based on error code
            error_message = result['error']
            error_code = result.get('error_code')
            
            # Map error codes to HTTP status codes
            status_code = 400
            if error_code == 'COLLECTION_NOT_FOUND':
                status_code = 404
                error_message = 'Collection not found'
            elif error_code == 'SAVED_ITEM_NOT_FOUND':
                status_code = 404
                error_message = 'Saved item not found. The item may have been removed from your wishlist.'
            elif error_code == 'ITEM_ALREADY_IN_COLLECTION':
                status_code = 409
                error_message = 'Item is already in this collection'
            elif error_code == 'DATABASE_ERROR':
                status_code = 500
                error_message = 'Database error occurred'
            
            return jsonify({
                'success': False,
                'error': error_message,
                'error_code': error_code
            }), status_code
    except Exception as e:
        print(f"Error adding item to collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error adding item to collection: {str(e)}'
        }), 500

@app.route('/api/collections/<collection_id>/items/<saved_item_id>', methods=['DELETE'])
@require_auth
def remove_item_from_collection(collection_id, saved_item_id):
    """Remove an item from a collection"""
    try:
        user_id = get_current_user_id()
        
        success = db_service.remove_item_from_collection(collection_id, saved_item_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Item removed from collection successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to remove item from collection'
            }), 400
    except Exception as e:
        print(f"Error removing item from collection: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error removing item from collection: {str(e)}'
        }), 500

@app.route('/api/upload', methods=['POST'])
@optional_auth
def upload_file():
    """Handle outfit image upload and process recommendations"""
    try:
        # Check if the post request has the file part
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # If user does not select file, browser also submits an empty part without filename
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # Generate unique file ID
            file_id = str(uuid.uuid4())
            
            # Get optional parameters
            country = request.form.get('country', 'us')
            language = request.form.get('language', 'en')
            user_id = get_current_user_id()
            
            # Upload image to Supabase Storage
            from image_storage_service import storage_service
            upload_result = storage_service.upload_image(
                file=file,
                user_id=user_id,
                file_id=file_id
            )
            
            if not upload_result.get('success'):
                return jsonify({
                    'error': f"Failed to upload image: {upload_result.get('error')}",
                    'file_id': file_id
                }), 500
            
            # Get the public URL for the uploaded image
            image_url = upload_result['public_url']
            storage_path = upload_result['storage_path']
            
            # Save uploaded file locally for processing (temporary)
            temp_filename = f"{file_id}.{upload_result['original_filename'].split('.')[-1]}"
            temp_file_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
            
            # Save file for processing (reset file pointer first)
            file.seek(0)
            file.save(temp_file_path)
            
            # Create database session (for both authenticated and anonymous users)
            session_record = None
            
            if user_id:
                # Authenticated user
                try:
                    session_record = db_service.create_search_session(
                        user_id=user_id,
                        file_id=file_id,
                        image_filename=upload_result['original_filename'],
                        image_url=image_url,  # Now using the public URL from Supabase Storage
                        country=country,
                        language=language
                    )
                    if session_record:
                        logger.info(f"Created search session {session_record['id']} for user {user_id}")
                    else:
                        logger.error(f"Failed to create search session for user {user_id}")
                except Exception as e:
                    logger.error(f"Error creating search session for user {user_id}: {str(e)}")
                    # Continue without database session
            else:
                # Anonymous user - create anonymous session
                try:
                    session_record = db_service.create_anonymous_search_session(
                        file_id=file_id,
                        image_filename=upload_result['original_filename'],
                        image_url=image_url,  # Now using the public URL from Supabase Storage
                        country=country,
                        language=language
                    )
                    if session_record:
                        logger.info(f"Created anonymous search session {session_record['id']}")
                except Exception as e:
                    logger.error(f"Error creating anonymous search session: {str(e)}")
                    # Continue without database session
            
            # Update session with storage path for cleanup
            if session_record:
                db_service.update_search_session(session_record['id'], {
                    'storage_path': storage_path
                })
            
            # Generate output paths
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_output_path = os.path.join(app.config['RESULTS_FOLDER'], f"results_{file_id}_{timestamp}")
            
            # Process the outfit image (using temporary local file)
            print(f"Processing outfit image: {temp_file_path}")
            
            # Progress tracking for client updates (could be enhanced with WebSockets)
            progress_messages = []
            def progress_callback(message):
                progress_messages.append(message)
                print(f"🔄 Progress: {message}")
            
            result = outfit_recommendation_with_cleaned_data(
                image_path=temp_file_path,
                country=country,
                language=language,
                output_path=f"{base_output_path}.csv",
                enable_redo=True,
                save_raw_json=True,
                save_cleaned_json=True,
                progress_callback=progress_callback,
                user_id=user_id
            )
            
            # <<<--- ADD THIS DEBUGGING BLOCK --- START --->>>
            print("\n--- FITFIND SEARCH DEBUG ---")
            if "error" in result:
                print(f"[DEBUG] An error occurred during search: {result['error']}")
            else:
                print(f"[DEBUG] Search queries generated: {result.get('search_queries')}")
                raw_results = result.get('raw_results_data', [])
                print(f"[DEBUG] Number of raw result sets from SerpAPI: {len(raw_results)}")
                if raw_results:
                    shopping_results = raw_results[0].get('shopping_results', [])
                    print(f"[DEBUG] Number of products in the first result set: {len(shopping_results)}")
                cleaned_summary = result.get('cleaned_data', {}).get('summary', {})
                print(f"[DEBUG] Cleaned data summary: {cleaned_summary}")
            print("--- FITFIND SEARCH DEBUG ---\n")
            
            # Clean up temporary file
            try:
                os.remove(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file: {e}")
            
            # Check for errors
            if "error" in result:
                # Update session status if exists
                if session_record:
                    db_service.update_search_session(session_record['id'], {
                        'status': 'error',
                        'error_message': result["error"]
                    })
                
                # Determine appropriate status code based on error type
                error_message = result["error"]
                if "No clothing items identified" in error_message:
                    status_code = 422  # Unprocessable Entity
                elif "API key" in error_message or "environment" in error_message:
                    status_code = 500  # Server configuration error
                else:
                    status_code = 400  # Bad request
                
                return jsonify({
                    'success': False,
                    'error': error_message,
                    'file_id': file_id
                }), status_code
            
            # Save results to database if user is authenticated
            if session_record and result.get('cleaned_data'):
                # Update session with results
                conversation_context_for_db = result.get('conversation_context', {})
                # Remove image_bytes for JSON serialization in database but keep other essential fields
                if conversation_context_for_db and 'image_bytes' in conversation_context_for_db:
                    # Keep all fields except image_bytes
                    conversation_context_for_db = {k: v for k, v in conversation_context_for_db.items() if k != 'image_bytes'}
                    logger.info(f"Storing conversation_context with fields: {list(conversation_context_for_db.keys())}")
                
                session_updates = {
                    'status': 'completed',
                    'search_queries': result.get('search_queries', []),
                    'num_items_identified': result.get('num_items_identified', 0),
                    'num_products_found': result.get('num_products_found', 0),
                    'conversation_context': conversation_context_for_db
                }
                db_service.update_search_session(session_record['id'], session_updates)
                
                # Save clothing items and products
                clothing_items = result.get('cleaned_data', {}).get('clothing_items', [])
                if clothing_items:
                    success = db_service.save_clothing_items(session_record['id'], clothing_items)
                    if not success:
                        print(f"WARNING: Failed to save clothing items for session {session_record['id']}")
                        # Log but don't fail the request since we have the data
                    else:
                        print(f"✅ Successfully saved clothing items and products for session {session_record['id']}")
            
            # Prepare conversation context for JSON serialization
            conversation_context = result.get('conversation_context')
            if conversation_context and 'image_bytes' in conversation_context:
                conversation_context = {k: v for k, v in conversation_context.items() if k != 'image_bytes'}
            
            # Prepare response with public URL
            response_data = {
                'success': True,
                'file_id': file_id,
                'filename': upload_result['original_filename'],
                'image_url': image_url,  # Public URL for frontend display
                'num_items_identified': result.get('num_items_identified', 0),
                'num_products_found': result.get('num_products_found', 0),
                'search_queries': result.get('search_queries', []),
                'cleaned_data': result.get('cleaned_data', {}),
                'conversation_context': conversation_context,
                'session_id': session_record['id'] if session_record else None,
                'files': {
                    'csv_file': result.get('results_saved_to'),
                    'raw_json_file': result.get('raw_results_saved_to'),
                    'cleaned_json_file': result.get('cleaned_results_saved_to')
                },
                'progress_messages': progress_messages  # For debugging/analytics
            }
            
            print(f"Successfully processed outfit. Found {result.get('num_products_found', 0)} products.")
            return jsonify(response_data)
        
        else:
            return jsonify({'error': 'Invalid file type. Please upload an image file.'}), 400
            
    except Exception as e:
        print(f"Error processing upload: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': f'Server error: {str(e)}',
            'details': 'Please check the server logs for more information.'
        }), 500

@app.route('/api/redo', methods=['POST'])
@optional_auth
def redo_search():
    """Handle redo search requests with custom feedback"""
    try:
        user_id = get_current_user_id()
        data = request.get_json()

        if not data or 'conversation_context' not in data:
            return jsonify({'error': 'Missing conversation context'}), 400

        conversation_context = data['conversation_context']
        feedback_message = data.get('feedback_message')
        session_id = data.get('session_id')

        if not session_id:
            return jsonify({'error': 'Missing session_id required for image retrieval'}), 400

        # Retrieve the session details from the database
        session_details = db_service.get_search_session(session_id)
        if not session_details:
            return jsonify({'error': 'Search session not found.'}), 404

        storage_path = session_details.get('storage_path')
        if not storage_path:
            return jsonify({'error': 'Image storage path not found for this session.'}), 400

        # Retrieve the image from Supabase Storage
        from image_storage_service import storage_service
        image_result = storage_service.get_image_bytes(storage_path)

        if not image_result.get('success'):
            logger.error(f"Failed to retrieve image from storage: {image_result.get('error')}")
            return jsonify({
                'error': 'Could not retrieve image data for redo operation. The image may have been deleted or is inaccessible.',
                'details': {'storage_path': storage_path}
            }), 500

        conversation_context['image_bytes'] = image_result['image_bytes']

        # Now, with the image bytes, proceed with the redo operation
        from search_recommendation import redo_search_queries, search_items_parallel, clean_search_results_for_frontend

        redo_result = redo_search_queries(conversation_context, feedback_message)

        if "error" in redo_result:
            return jsonify({'error': redo_result["error"]}), 500

        new_queries = redo_result.get("queries", [])
        if not new_queries or "error" in new_queries:
            return jsonify({'error': 'Failed to generate new search queries'}), 500

        country = data.get('country', 'us')
        language = data.get('language', 'en')

        search_results = search_items_parallel(new_queries, country=country, language=language)
        cleaned_data = clean_search_results_for_frontend(search_results)

        # Update the session in the database
        if user_id and session_id:
            conversation_context_for_db = {k: v for k, v in redo_result.items() if k != 'image_bytes'}
            session_updates = {
                'search_queries': new_queries,
                'num_products_found': cleaned_data.get('summary', {}).get('total_products', 0),
                'conversation_context': conversation_context_for_db
            }
            db_service.update_search_session(session_id, session_updates)
            clothing_items = cleaned_data.get('clothing_items', [])
            if clothing_items:
                db_service.save_clothing_items(session_id, clothing_items)

        updated_conversation_context = {k: v for k, v in redo_result.items() if k != 'image_bytes'}

        response_data = {
            'success': True,
            'new_queries': new_queries,
            'cleaned_data': cleaned_data,
            'conversation_context': updated_conversation_context,
            'feedback_used': redo_result.get('feedback_used'),
        }

        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error in redo search: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': f'Server error: {str(e)}',
            'details': 'Please check the server logs for more information.'
        }), 500

@app.route('/api/results/<file_id>')
@optional_auth
def get_results(file_id):
    """Get results for a specific file ID"""
    try:
        user_id = get_current_user_id()
        
        # If user is authenticated, try to get from database first
        if user_id:
            session = db_service.get_search_session_by_file_id(file_id)
            if session and session['user_id'] == user_id:
                # Get complete session with items and products
                complete_session = db_service.get_session_with_items_and_products(session['id'])
                if complete_session:
                    # Transform database format to frontend format
                    cleaned_data = {
                        'clothing_items': complete_session.get('clothing_items', []),
                        'summary': {
                            'total_items': len(complete_session.get('clothing_items', [])),
                            'total_products': complete_session.get('num_products_found', 0),
                            'has_errors': False,
                            'error_items': []
                        }
                    }
                    
                    return jsonify({
                        'success': True,
                        'cleaned_data': cleaned_data,
                        'file_id': file_id,
                        'session': complete_session
                    })
        
        # Fallback to file-based results
        results_files = [f for f in os.listdir(app.config['RESULTS_FOLDER']) 
                        if f.startswith(f"results_{file_id}") and f.endswith('_cleaned.json')]
        
        if not results_files:
            return jsonify({'error': 'Results not found'}), 404
        
        # Get the most recent results file
        results_file = sorted(results_files)[-1]
        results_path = os.path.join(app.config['RESULTS_FOLDER'], results_file)
        
        with open(results_path, 'r', encoding='utf-8') as f:
            cleaned_data = json.load(f)
        
        return jsonify({
            'success': True,
            'cleaned_data': cleaned_data,
            'file_id': file_id
        })
        
    except Exception as e:
        print(f"Error getting results: {str(e)}")
        return jsonify({'error': f'Error loading results: {str(e)}'}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/results/<filename>')
def result_file(filename):
    """Serve result files"""
    return send_from_directory(app.config['RESULTS_FOLDER'], filename)

@app.route('/api/storage/cleanup', methods=['POST'])
def cleanup_storage():
    """Clean up old anonymous images and orphaned files"""
    try:
        from image_storage_service import storage_service
        
        # Clean up anonymous images older than 24 hours
        cleanup_result = storage_service.cleanup_anonymous_images(older_than_hours=24)
        
        if cleanup_result.get('success'):
            return jsonify({
                'success': True,
                'message': f"Cleaned up {cleanup_result['deleted_count']} old anonymous images",
                'deleted_count': cleanup_result['deleted_count']
            })
        else:
            return jsonify({
                'success': False,
                'error': cleanup_result.get('error')
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/storage/status', methods=['GET'])
@require_auth
def get_storage_status():
    """Get storage usage statistics for authenticated user"""
    try:
        user_id = get_current_user_id()
        
        # Get user's image count from database
        user_sessions = db_service.get_user_search_sessions(user_id, limit=1000)
        
        # Calculate statistics
        total_sessions = len(user_sessions)
        sessions_with_images = sum(1 for session in user_sessions if session.get('image_url'))
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'statistics': {
                'total_sessions': total_sessions,
                'sessions_with_images': sessions_with_images,
                'storage_usage': 'Calculated from Supabase Storage API'
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health')
def health_check():
    """Enhanced health check endpoint with storage status"""
    try:
        # Check database health
        db_health = db_service.health_check()
        
        # Check storage health
        from image_storage_service import storage_service
        storage_health = storage_service.health_check()
        
        overall_status = 'healthy' if (
            db_health.get('status') == 'healthy' and 
            storage_health.get('status') == 'healthy'
        ) else 'unhealthy'
        
        return jsonify({
            'status': overall_status,
            'timestamp': datetime.now().isoformat(),
            'services': {
                'database': db_health,
                'storage': storage_health
            },
            'upload_folder': app.config['UPLOAD_FOLDER'],
            'results_folder': app.config['RESULTS_FOLDER']
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.now().isoformat(),
            'error': str(e),
            'services': {
                'database': {'status': 'unknown'},
                'storage': {'status': 'unknown'}
            }
        }), 500

if __name__ == '__main__':
    print("Starting FitFind Outfit Recommendation Server...")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Results folder: {RESULTS_FOLDER}")
    
    # Test database connection on startup
    try:
        db_health = db_service.health_check()
        print(f"Database status: {db_health['status']}")
    except Exception as e:
        print(f"Warning: Database connection failed: {e}")
        print("Server will start but database features will be unavailable")
    
    # Configure for environment
    if os.getenv('FLASK_ENV') == 'production':
        print("Running in production mode")
        app.run(debug=False, host='0.0.0.0', port=int(os.getenv('PORT', 5000)))
    else:
        print("Running in development mode")
        print("Server will be available at: http://localhost:5000")
        app.run(debug=True, host='0.0.0.0', port=5000) 