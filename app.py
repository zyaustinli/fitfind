from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import os
import uuid
from werkzeug.utils import secure_filename
import json
from search_recommendation import outfit_recommendation_with_cleaned_data
import traceback
from datetime import datetime

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

@app.route('/')
def index():
    """Serve the main frontend page"""
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
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
            # Generate unique filename
            file_id = str(uuid.uuid4())
            filename = secure_filename(file.filename)
            file_extension = filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{file_id}.{file_extension}"
            
            # Save uploaded file
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(file_path)
            
            # Get optional parameters
            country = request.form.get('country', 'us')
            language = request.form.get('language', 'en')
            
            # Generate output paths
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_output_path = os.path.join(app.config['RESULTS_FOLDER'], f"results_{file_id}_{timestamp}")
            
            # Process the outfit image
            print(f"Processing outfit image: {file_path}")
            result = outfit_recommendation_with_cleaned_data(
                image_path=file_path,
                country=country,
                language=language,
                output_path=f"{base_output_path}.csv",
                enable_redo=True,  # Enable redo functionality
                save_raw_json=True,
                save_cleaned_json=True
            )
            
            # Check for errors
            if "error" in result:
                return jsonify({
                    'error': result["error"],
                    'file_id': file_id
                }), 500
            
            # Prepare conversation context for JSON serialization (remove image_bytes)
            conversation_context = result.get('conversation_context')
            if conversation_context and 'image_bytes' in conversation_context:
                # Create a copy without image_bytes for JSON serialization
                conversation_context = {k: v for k, v in conversation_context.items() if k != 'image_bytes'}
            
            # Prepare response
            response_data = {
                'success': True,
                'file_id': file_id,
                'filename': filename,
                'num_items_identified': result.get('num_items_identified', 0),
                'num_products_found': result.get('num_products_found', 0),
                'search_queries': result.get('search_queries', []),
                'cleaned_data': result.get('cleaned_data', {}),
                'conversation_context': conversation_context,  # For redo functionality
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
def redo_search():
    """Handle redo search requests with custom feedback"""
    try:
        data = request.get_json()
        
        if not data or 'conversation_context' not in data:
            return jsonify({'error': 'Missing conversation context'}), 400
        
        conversation_context = data['conversation_context']
        feedback_message = data.get('feedback_message')
        file_id = data.get('file_id')  # We need the file_id to reconstruct image_bytes
        
        # If conversation_context doesn't have image_bytes, we need to reconstruct it
        if conversation_context and 'image_bytes' not in conversation_context and file_id:
            # Find the uploaded image file
            upload_files = [f for f in os.listdir(app.config['UPLOAD_FOLDER']) 
                           if f.startswith(file_id)]
            if upload_files:
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], upload_files[0])
                # Read and encode the image
                from search_recommendation import encode_image
                image_bytes = encode_image(image_path)
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
def get_results(file_id):
    """Get results for a specific file ID"""
    try:
        # Look for cleaned results file
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

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'upload_folder': app.config['UPLOAD_FOLDER'],
        'results_folder': app.config['RESULTS_FOLDER']
    })

if __name__ == '__main__':
    print("Starting FitFind Outfit Recommendation Server...")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Results folder: {RESULTS_FOLDER}")
    print("Server will be available at: http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000) 