# Load environment variables first, before any other imports
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, render_template, send_from_directory, g
from flask_cors import CORS
import os
import uuid
from werkzeug.utils import secure_filename
import json
from search_recommendation import outfit_recommendation_with_cleaned_data
import traceback
from datetime import datetime
import logging

# Setup logging
logger = logging.getLogger(__name__)

# Import database and auth services
from database_service import db_service
from auth_middleware import require_auth, optional_auth, get_current_user, get_current_user_id, is_authenticated

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

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
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        include_details = request.args.get('include_details', 'false').lower() == 'true'
        
        history = db_service.get_user_search_history(user_id, limit, offset, include_details)
        
        # Get total count for better pagination (exclude soft-deleted items)
        total_count_response = db_service.service_client.table("user_search_history").select("id", count="exact").eq("user_id", user_id).is_("deleted_at", "null").execute()
        total_count = total_count_response.count or 0
        
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
    except Exception as e:
        print(f"Error getting search history: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error getting search history: {str(e)}'
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
            result = outfit_recommendation_with_cleaned_data(
                image_path=temp_file_path,
                country=country,
                language=language,
                output_path=f"{base_output_path}.csv",
                enable_redo=True,
                save_raw_json=True,
                save_cleaned_json=True
            )
            
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
                # Remove image_bytes for JSON serialization in database
                if conversation_context_for_db and 'image_bytes' in conversation_context_for_db:
                    conversation_context_for_db = {k: v for k, v in conversation_context_for_db.items() if k != 'image_bytes'}
                
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
                }
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
        # Get authenticated user if available
        user_id = get_current_user_id()
        if user_id:
            logger.info(f"Processing redo search for authenticated user: {user_id}")
        else:
            logger.info("Processing redo search for anonymous user")
        
        data = request.get_json()
        
        if not data or 'conversation_context' not in data:
            return jsonify({'error': 'Missing conversation context'}), 400
        
        conversation_context = data['conversation_context']
        feedback_message = data.get('feedback_message')
        file_id = data.get('file_id')  # We need the file_id to reconstruct image_bytes
        session_id = data.get('session_id')  # Database session ID
        
        # If conversation_context doesn't have image_bytes, we need to reconstruct it
        if conversation_context and 'image_bytes' not in conversation_context and file_id:
            # Find the uploaded image file
            upload_files = [f for f in os.listdir(app.config['UPLOAD_FOLDER']) 
                           if f.startswith(file_id)]
            if upload_files:
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], upload_files[0])
                # Read the raw image bytes (not base64 encoded)
                with open(image_path, "rb") as image_file:
                    image_bytes = image_file.read()
                conversation_context['image_bytes'] = image_bytes
        
        # Import the redo function
        from search_recommendation import redo_search_queries
        
        # Redo the search queries
        redo_result = redo_search_queries(conversation_context, feedback_message)
        
        if "error" in redo_result:
            return jsonify({'error': redo_result["error"]}), 500
        
        # Get the new queries
        new_queries = redo_result.get("queries", [])
        
        if not new_queries or "error" in new_queries:
            return jsonify({'error': 'Failed to generate new search queries'}), 500
        
        # Perform new search with updated queries
        from search_recommendation import search_items_parallel, clean_search_results_for_frontend
        
        country = data.get('country', 'us')
        language = data.get('language', 'en')
        
        # Search for items with new queries
        search_results = search_items_parallel(new_queries, country=country, language=language)
        
        # Clean the results
        cleaned_data = clean_search_results_for_frontend(search_results)
        
        # Update database session if user is authenticated and session_id provided
        if user_id and session_id:
            try:
                # Remove image_bytes from redo_result for JSON serialization in database
                conversation_context_for_db = redo_result
                if conversation_context_for_db and 'image_bytes' in conversation_context_for_db:
                    conversation_context_for_db = {k: v for k, v in conversation_context_for_db.items() if k != 'image_bytes'}
                
                session_updates = {
                    'search_queries': new_queries,
                    'num_products_found': cleaned_data.get('summary', {}).get('total_products', 0),
                    'conversation_context': conversation_context_for_db
                }
                db_service.update_search_session(session_id, session_updates)
                logger.info(f"Updated search session {session_id} for user {user_id}")
                
                # Save new clothing items and products
                clothing_items = cleaned_data.get('clothing_items', [])
                if clothing_items:
                    success = db_service.save_clothing_items(session_id, clothing_items)
                    if success:
                        logger.info(f"Saved {len(clothing_items)} clothing items for session {session_id}")
                    else:
                        logger.error(f"Failed to save clothing items for session {session_id}")
                        # Continue without failing the request
            except Exception as e:
                logger.error(f"Error updating search session {session_id}: {str(e)}")
                # Continue without database updates
        
        # Prepare conversation context for JSON serialization (remove image_bytes)
        updated_conversation_context = redo_result
        if updated_conversation_context and 'image_bytes' in updated_conversation_context:
            # Create a copy without image_bytes for JSON serialization
            updated_conversation_context = {k: v for k, v in updated_conversation_context.items() if k != 'image_bytes'}
        
        response_data = {
            'success': True,
            'new_queries': new_queries,
            'cleaned_data': cleaned_data,
            'conversation_context': updated_conversation_context,  # Updated conversation context
            'feedback_used': redo_result.get('feedback_used')
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
    print("Server will be available at: http://localhost:5000")
    
    # Test database connection on startup
    try:
        db_health = db_service.health_check()
        print(f"Database status: {db_health['status']}")
    except Exception as e:
        print(f"Warning: Database connection failed: {e}")
        print("Server will start but database features will be unavailable")
    
    app.run(debug=True, host='0.0.0.0', port=5000) 