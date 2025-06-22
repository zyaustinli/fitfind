import os
from dotenv import load_dotenv
from openai import OpenAI
import re
import base64
import json
import pandas as pd
from pathlib import Path
import time
import datetime
import concurrent.futures
from google import genai
from google.genai import types
from google.genai.types import Tool, GenerateContentConfig, GoogleSearch
from serpapi.google_search import GoogleSearch as SerpAPISearch
import requests
    
import time
import random
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs, unquote
from datetime import datetime
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
genai_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
SERPAPI_KEY = os.getenv("SERPAPI_API_KEY")

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")
                

def create_search_query_gemini(image_path, return_conversation=False):
    """
    Create search query for each clothing item in the image
    
    Parameters:
    - image_path: Path to the image file
    - return_conversation: If True, returns both queries and conversation context
    
    Returns:
    - If return_conversation=False: List of search queries or error dict
    - If return_conversation=True: Dict with 'queries', 'conversation_history', 'image_bytes', and 'system_prompt'
    """
    if not image_path:
        return {"error": "No image provided"}
    
    try:
        # Read the image file
        with open(image_path, "rb") as image_file:
            image_bytes = image_file.read()
        
        # System instructions
        system_prompt = """You are a professional fashion researcher specializing in generating precise search queries for clothing identification. When provided with an image containing clothing items, you will analyze each piece and generate specific search queries that can be used to find near-identical replicas online.

ANALYSIS FRAMEWORK:
For each clothing piece, create a google shopping search query (10-15 words max) that captures the most distinctive features in this priority order:

1. ITEM TYPE & GENDER (most important for search algorithms)
- Use specific garment names with gender (e.g., "women's blazer," "men's henley," "midi skirt")
- Use precise fashion terminology (e.g., "bomber jacket" not just "jacket")

2. DOMINANT VISUAL CHARACTERISTICS (what makes it instantly recognizable)
- Color: Primary color + secondary if color-blocked (e.g., "navy blue," "burgundy and cream")
- Pattern/Print: Specific pattern type (e.g., "leopard print," "vertical pinstripes," "floral")
- Silhouette: Key shape descriptor (e.g., "oversized," "fitted," "A-line," "cropped")

3. DISTINCTIVE DETAILS (unique features that narrow the search)
- Material clues: Observable texture (e.g., "ribbed knit," "leather," "satin")
- Structural details: Notable features (e.g., "puff sleeves," "high-waisted," "wrap-style")
- Hardware/embellishments: Visible details (e.g., "gold buttons," "zipper front," "lace trim")

4. STYLE CONTEXT (helps algorithm understand the aesthetic)
- Style category when relevant (e.g., "casual," "formal," "vintage-inspired," "minimalist")

SEARCH QUERY REQUIREMENTS:
- Start with item type + gender
- Include 2-3 most distinctive visual features
- Use fashion industry terminology
- Avoid generic descriptors like "nice" or "stylish"
- Focus on features that are immediately visible, distinctive, and searchable
- Use terms that online retailers commonly use in product descriptions

OUTPUT FORMAT:
Always return your response as a JSON array of strings, with each string being a search query for one clothing piece. Format: ["search query 1", "search query 2", "search query 3"]. If no clothing items are identified, return an empty array, like so: [].

EXAMPLE OUTPUTS:
["women's emerald green satin wrap blouse long sleeves", "men's charcoal wool blend oversized bomber jacket", "black leather high-waisted straight leg pants"]
"""
        
        # User prompt
        user_prompt = """Analyze this image and generate specific search queries for each clothing piece that will help me find near-identical replicas online. Return the results as an array of search queries. For example, ["women's emerald green satin wrap blouse long sleeves", "men's charcoal wool blend oversized bomber jacket", "black leather high-waisted straight leg pants"]. However, if there are no clothing items in the image, return an empty array, like so: []."""
        
        # Initial conversation content
        initial_content = {
            "role": "user", 
            "parts": [
                types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg'),
                {"text": user_prompt}
            ]
        }
        
        # Create a JSON-serializable version for conversation history
        initial_content_serializable = {
            "role": "user", 
            "parts": [
                {"text": "[IMAGE_DATA]"},  # Placeholder for image data
                {"text": user_prompt}
            ]
        }
        
        # Generate response using the system_instruction in config
        response = genai_client.models.generate_content(
            model='gemini-2.5-flash-preview-05-20',
            contents=[initial_content],
            config=GenerateContentConfig(
                system_instruction=system_prompt
            )
        )
        
        response_text = response.text.strip()
        
        # Build conversation history (using serializable version)
        conversation_history = [
            initial_content_serializable,
            {
                "role": "model",
                "parts": [{"text": response_text}]
            }
        ]
        
        # Ensure the response is valid JSON
        try:
            # Find JSON array in the response if it's not pure JSON
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(0)
            
            # Parse the JSON
            items = json.loads(response_text)
            
            if return_conversation:
                return {
                    "queries": items,
                    "conversation_history": conversation_history,
                    "image_bytes": image_bytes,
                    "system_prompt": system_prompt,
                    "model": 'gemini-2.5-flash-preview-05-20'
                }
            else:
                return items
                
        except json.JSONDecodeError:
            # If JSON parsing fails, return a structured error
            error_result = {"error": "Failed to parse JSON from identification response", "raw_response": response_text}
            
            if return_conversation:
                return {
                    "queries": error_result,
                    "conversation_history": conversation_history,
                    "image_bytes": image_bytes,
                    "system_prompt": system_prompt,
                    "model": 'gemini-2.5-flash-preview-05-20'
                }
            else:
                return error_result
            
    except Exception as e:
        # Return a structured error for any other exceptions
        error_result = {"error": f"Error in identify_clothing_items_gemini: {str(e)}"}
        
        if return_conversation:
            return {
                "queries": error_result,
                "conversation_history": [],
                "image_bytes": None,
                "system_prompt": system_prompt if 'system_prompt' in locals() else None,
                "model": 'gemini-2.5-flash-preview-05-20'
            }
        else:
            return error_result


def redo_search_queries(conversation_context, feedback_message=None):
    """
    Continue the conversation with Gemini to redo the search queries
    
    Parameters:
    - conversation_context: Dict returned from create_search_query_gemini with return_conversation=True
    - feedback_message: Optional custom feedback message. If None, uses a default message.
    
    Returns:
    - Dict with new queries and updated conversation context, or error dict
    """
    if not conversation_context or "conversation_history" not in conversation_context:
        return {"error": "Invalid conversation context provided"}
    
    if "error" in conversation_context.get("queries", {}):
        return {"error": "Cannot redo queries from a failed initial request"}
    
    try:
        # Default feedback message if none provided
        if feedback_message is None:
            feedback_message = """The search queries you provided were not very good and didn't yield useful results when searching for these clothing items. Please analyze the image again more carefully and generate better, more specific search queries. Focus on:

1. More precise item descriptions and terminology
2. Better color descriptions  
3. More specific style details and distinguishing features
4. Alternative ways to describe the same items that might work better for online shopping searches

Please provide new search queries in the same JSON array format. Make sure to include each clothing item in the image as before."""

        # Add the feedback to conversation history
        feedback_content = {
            "role": "user",
            "parts": [{"text": feedback_message}]
        }
        
        # Update conversation history
        updated_conversation = conversation_context["conversation_history"] + [feedback_content]
        
        # For the actual API call, we need to reconstruct the conversation with the real image data
        api_conversation = []
        for msg in updated_conversation:
            if msg["role"] == "user" and any("[IMAGE_DATA]" in str(part) for part in msg["parts"]):
                # Replace the placeholder with actual image data for the first user message
                api_msg = {
                    "role": "user",
                    "parts": [
                        types.Part.from_bytes(data=conversation_context["image_bytes"], mime_type='image/jpeg'),
                        {"text": msg["parts"][1]["text"]}  # The actual text prompt
                    ]
                }
                api_conversation.append(api_msg)
            else:
                api_conversation.append(msg)
        
        # Generate new response
        response = genai_client.models.generate_content(
            model=conversation_context["model"],
            contents=api_conversation,
            config=GenerateContentConfig(
                system_instruction=conversation_context["system_prompt"]
            )
        )
        
        response_text = response.text.strip()
        
        # Add model response to conversation history
        final_conversation = updated_conversation + [
            {
                "role": "model", 
                "parts": [{"text": response_text}]
            }
        ]
        
        # Parse the new response
        try:
            # Find JSON array in the response if it's not pure JSON
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(0)
            
            # Parse the JSON
            new_queries = json.loads(response_text)
            
            return {
                "queries": new_queries,
                "conversation_history": final_conversation,
                "image_bytes": conversation_context["image_bytes"],
                "system_prompt": conversation_context["system_prompt"],
                "model": conversation_context["model"],
                "feedback_used": feedback_message
            }
            
        except json.JSONDecodeError:
            return {
                "error": "Failed to parse JSON from redo response", 
                "raw_response": response_text,
                "conversation_history": final_conversation,
                "image_bytes": conversation_context["image_bytes"],
                "system_prompt": conversation_context["system_prompt"],
                "model": conversation_context["model"]
            }
            
    except Exception as e:
        return {"error": f"Error in redo_search_queries: {str(e)}"}


def search_shopping_item(query, country="us", language="en"):
    """
    Search for a clothing item using SerpAPI's Google Shopping API
    
    Parameters:
    - query: The search query string
    - country: Two-letter country code (default: "us")
    - language: Language code (default: "en")
    
    Returns:
    - Dictionary containing search results
    """
    if not SERPAPI_KEY:
        return {"error": "SERPAPI_API_KEY not set in environment variables"}
    
    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": SERPAPI_KEY,
        "gl": country,
        "hl": language,
        #"direct_link": "true"
    }
    
    
    try:
        search = SerpAPISearch(params)
        results = search.get_dict()
        
        # Add query metadata to results
        results["original_query"] = query
        
        return results
    except Exception as e:
        return {
            "error": f"Error in search_shopping_item: {str(e)}",
            "original_query": query
        }


def search_items_parallel(queries, country="us", language="en", max_workers=5):
    """
    Search for multiple clothing items in parallel
    
    Parameters:
    - queries: List of search query strings
    - country: Two-letter country code (default: "us")
    - language: Language code (default: "en")
    - max_workers: Maximum number of parallel workers (default: 5)
    
    Returns:
    - List of dictionaries containing search results
    """
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Create a list of futures
        future_to_query = {
            executor.submit(
                search_shopping_item, 
                query, 
                country, 
                language
            ): query for query in queries
        }
        
        # Process results as they complete
        for future in concurrent.futures.as_completed(future_to_query):
            query = future_to_query[future]
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                results.append({
                    "error": f"Error processing query '{query}': {str(e)}",
                    "original_query": query
                })
    
    return results


def process_shopping_results(results):
    """
    Process and flatten the shopping results for easier CSV storage
    
    Parameters:
    - results: List of dictionaries from search_items_parallel
    
    Returns:
    - List of dictionaries with flattened structure for CSV export
    """
    processed_items = []
    
    for result in results:
        original_query = result.get("original_query", "Unknown query")
        
        # Handle error cases
        if "error" in result:
            processed_items.append({
                "query": original_query,
                "error": result["error"],
                "title": None,
                "link": None,
                "price": None,
                "extracted_price": None,
                "source": None,
                "rating": None,
                "reviews": None,
                "thumbnail": None,
                "product_id": None
            })
            continue
        
        # Process shopping results
        shopping_results = result.get("shopping_results", [])
        if not shopping_results:
            processed_items.append({
                "query": original_query,
                "error": "No shopping results found",
                "title": None,
                "link": None,
                "price": None,
                "extracted_price": None,
                "source": None,
                "rating": None,
                "reviews": None,
                "thumbnail": None,
                "product_id": None
            })
            continue
        
        # Process each item in shopping results
        for item in shopping_results:
            processed_item = {
                "query": original_query,
                "title": item.get("title"),
                "link": item.get("link"),
                "price": item.get("price"),
                "extracted_price": item.get("extracted_price"),
                "source": item.get("source"),
                "rating": item.get("rating"),
                "reviews": item.get("reviews"),
                "thumbnail": item.get("thumbnail"),
                "product_id": item.get("product_id"),
                "shipping": item.get("shipping"),
                "tag": item.get("tag")
            }
            processed_items.append(processed_item)
    
    return processed_items


def save_raw_results_to_json(search_results, output_path=None):
    """
    Save complete raw SerpAPI search results to a JSON file
    
    Parameters:
    - search_results: List of raw search result dictionaries from search_items_parallel
    - output_path: Path to save the JSON file (default: generates timestamped filename)
    
    Returns:
    - Path to the saved JSON file
    """
    if not search_results:
        return {"error": "No search results to save"}
    
    # Generate output path if not provided
    if not output_path:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"raw_search_results_{timestamp}.json"
    
    # Ensure directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Save to JSON with proper formatting
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(search_results, f, indent=2, ensure_ascii=False)
        return output_path
    except Exception as e:
        return {"error": f"Failed to save raw results: {str(e)}"}


def save_results_to_csv(processed_items, output_path=None):
    """
    Save processed shopping results to a CSV file
    
    Parameters:
    - processed_items: List of dictionaries from process_shopping_results
    - output_path: Path to save the CSV file (default: generates timestamped filename)
    
    Returns:
    - Path to the saved CSV file
    """
    if not processed_items:
        return {"error": "No items to save"}
    
    # Create DataFrame from processed items
    df = pd.DataFrame(processed_items)
    
    # Generate output path if not provided
    if not output_path:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"shopping_results_{timestamp}.csv"
    
    # Ensure directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Save to CSV
    try:
        df.to_csv(output_path, index=False)
        return output_path
    except Exception as e:
        return {"error": f"Failed to save CSV results: {str(e)}"}


def outfit_recommendation_with_redo(image_path, country="us", language="en", output_path=None, enable_redo=False, save_raw_json=True):
    """
    Enhanced version of outfit_recommendation that optionally returns conversation context for redo functionality
    
    Parameters:
    - image_path: Path to the outfit image
    - country: Two-letter country code (default: "us")
    - language: Language code (default: "en")
    - output_path: Path to save the CSV file (default: generates timestamped filename)
    - enable_redo: If True, returns conversation context for potential redo
    - save_raw_json: If True, saves complete raw SerpAPI responses as JSON
    
    Returns:
    - Dictionary containing results and optionally conversation context for redo
    """
    # Step 1: Get search queries from image using Gemini
    print(f"Analyzing image: {image_path}")
    
    if enable_redo:
        query_result = create_search_query_gemini(image_path, return_conversation=True)
        search_queries = query_result.get("queries", [])
        conversation_context = query_result
    else:
        search_queries = create_search_query_gemini(image_path)
        conversation_context = None
    
    if isinstance(search_queries, dict) and "error" in search_queries:
        result = search_queries
        if enable_redo and conversation_context:
            result["conversation_context"] = conversation_context
        return result
    
    if not search_queries or len(search_queries) == 0:
        result = {"error": "No clothing items identified in the image"}
        if enable_redo and conversation_context:
            result["conversation_context"] = conversation_context
        return result
    
    print(f"Identified {len(search_queries)} clothing items")
    for i, query in enumerate(search_queries):
        print(f"  Item {i+1}: {query}")
    
    # Step 2: Search for each clothing item in parallel
    print(f"Searching for {len(search_queries)} items...")
    search_results = search_items_parallel(
        search_queries,
        country=country,
        language=language
    )
    
    # Step 3: Save raw search results if requested
    raw_json_path = None
    if save_raw_json:
        print("Saving raw search results...")
        if output_path:
            # Generate JSON path based on CSV path
            base_path = os.path.splitext(output_path)[0]
            raw_json_path = f"{base_path}_raw.json"
        else:
            raw_json_path = None
        
        raw_json_result = save_raw_results_to_json(search_results, raw_json_path)
        if isinstance(raw_json_result, dict) and "error" in raw_json_result:
            print(f"Warning: Failed to save raw results - {raw_json_result['error']}")
            raw_json_path = None
        else:
            raw_json_path = raw_json_result
            print(f"Raw search results saved to: {raw_json_path}")
    
    # Step 4: Process the results for CSV storage
    processed_results = process_shopping_results(search_results)
    
    # Step 5: Save processed results to CSV
    csv_result = save_results_to_csv(processed_results, output_path)
    if isinstance(csv_result, dict) and "error" in csv_result:
        result = csv_result
        if enable_redo and conversation_context:
            result["conversation_context"] = conversation_context
        if raw_json_path:
            result["raw_results_saved_to"] = raw_json_path
        return result
    
    csv_path = csv_result
    print(f"Processed results saved to: {csv_path}")
    
    # Return summary
    result = {
        "num_items_identified": len(search_queries),
        "num_products_found": len(processed_results),
        "search_queries": search_queries,
        "results_saved_to": csv_path,
        "results_data": processed_results
    }
    
    if raw_json_path:
        result["raw_results_saved_to"] = raw_json_path
        result["raw_results_data"] = search_results
    
    if enable_redo and conversation_context:
        result["conversation_context"] = conversation_context
    
    return result


def outfit_recommendation(image_path, country="us", language="en", output_path=None, save_raw_json=True):
    """
    Main function to process an outfit image and get shopping recommendations
    (Backward compatibility wrapper for outfit_recommendation_with_redo)
    
    Parameters:
    - image_path: Path to the outfit image
    - country: Two-letter country code (default: "us")
    - language: Language code (default: "en")
    - output_path: Path to save the CSV file (default: generates timestamped filename)
    - save_raw_json: If True, saves complete raw SerpAPI responses as JSON
    
    Returns:
    - Dictionary containing results summary and path to the saved CSV file
    """
    return outfit_recommendation_with_redo(
        image_path=image_path,
        country=country,
        language=language,
        output_path=output_path,
        enable_redo=False,
        save_raw_json=save_raw_json
    )


def clean_search_results_for_frontend(raw_search_results):
    """
    Clean and process raw search results for frontend display
    
    This function takes the raw SerpAPI search results and extracts only the essential
    information needed for the frontend, organizing it by clothing item queries.
    
    Parameters:
    - raw_search_results: List of raw search result dictionaries from search_items_parallel
    
    Returns:
    - Dictionary with cleaned data organized by clothing items:
      {
        "clothing_items": [
          {
            "query": "search query used",
            "item_type": "extracted item type (e.g., 'blouse', 'skirt')",
            "products": [
              {
                "id": "unique product id",
                "title": "product title",
                "price": "formatted price string",
                "price_numeric": float,
                "old_price": "original price if on sale",
                "old_price_numeric": float,
                "discount_percentage": "discount % if applicable",
                "image_url": "product thumbnail URL",
                "product_url": "link to product page",
                "source": "retailer name",
                "source_icon": "retailer icon URL",
                "rating": float,
                "review_count": int,
                "delivery_info": "delivery information",
                "tags": ["sale tags like '25% OFF'"]
              }
            ],
            "total_products": int,
            "price_range": {
              "min": float,
              "max": float,
              "average": float
            }
          }
        ],
        "summary": {
          "total_items": int,
          "total_products": int,
          "has_errors": bool,
          "error_items": []
        }
      }
    """
    
    if not raw_search_results:
        return {
            "clothing_items": [],
            "summary": {
                "total_items": 0,
                "total_products": 0,
                "has_errors": False,
                "error_items": []
            }
        }
    
    cleaned_items = []
    error_items = []
    total_products = 0
    
    for result in raw_search_results:
        original_query = result.get("original_query", "Unknown query")
        
        # Extract item type from query (first word after gender if present)
        item_type = extract_item_type_from_query(original_query)
        
        # Handle error cases
        if "error" in result:
            error_items.append({
                "query": original_query,
                "error": result["error"]
            })
            continue
        
        # Process shopping results
        shopping_results = result.get("shopping_results", [])
        if not shopping_results:
            error_items.append({
                "query": original_query,
                "error": "No shopping results found"
            })
            continue
        
        # Clean each product
        cleaned_products = []
        prices = []
        
        for product in shopping_results:
            cleaned_product = clean_single_product(product)
            if cleaned_product:
                cleaned_products.append(cleaned_product)
                if cleaned_product["price_numeric"]:
                    prices.append(cleaned_product["price_numeric"])
        
        # Calculate price range
        price_range = calculate_price_range(prices) if prices else None
        
        # Create clothing item entry
        clothing_item = {
            "query": original_query,
            "item_type": item_type,
            "products": cleaned_products,
            "total_products": len(cleaned_products),
            "price_range": price_range
        }
        
        cleaned_items.append(clothing_item)
        total_products += len(cleaned_products)
    
    return {
        "clothing_items": cleaned_items,
        "summary": {
            "total_items": len(cleaned_items),
            "total_products": total_products,
            "has_errors": len(error_items) > 0,
            "error_items": error_items
        }
    }

def extract_item_type_from_query(query):
    """
    Extract the clothing item type from a search query with comprehensive coverage
    
    Parameters:
    - query: Search query string
    
    Returns:
    - String representing the item type
    """
    if not query:
        return "unknown"
    
    query_lower = query.lower().strip()
    
    # Comprehensive multi-word patterns (most specific first)
    multi_word_patterns = [
        # Tops - specific patterns
        ('tank top', 'tank_top'),
        ('tube top', 'tube_top'),
        ('crop top', 'crop_top'),
        ('halter top', 'halter_top'),
        ('mock neck', 'turtleneck'),
        ('cowl neck', 'sweater'),
        ('v-neck', 'shirt'),
        ('crew neck', 'shirt'),
        ('crewneck', 'shirt'),
        
        # Outerwear patterns
        ('leather jacket', 'leather_jacket'),
        ('denim jacket', 'denim_jacket'),
        ('jean jacket', 'denim_jacket'),
        ('bomber jacket', 'bomber_jacket'),
        ('puffer jacket', 'puffer_jacket'),
        ('down jacket', 'puffer_jacket'),
        ('track jacket', 'track_jacket'),
        ('varsity jacket', 'varsity_jacket'),
        ('rain jacket', 'raincoat'),
        ('trench coat', 'trench_coat'),
        ('pea coat', 'peacoat'),
        ('duffle coat', 'coat'),
        
        # Bottoms - specific patterns
        ('cargo pants', 'cargo_pants'),
        ('cargo shorts', 'cargo_shorts'),
        ('yoga pants', 'yoga_pants'),
        ('track pants', 'track_pants'),
        ('sweat pants', 'sweatpants'),
        ('palazzo pants', 'palazzo_pants'),
        ('wide leg pants', 'wide_leg_pants'),
        ('straight leg pants', 'pants'),
        ('skinny jeans', 'skinny_jeans'),
        ('slim jeans', 'jeans'),
        ('boyfriend jeans', 'jeans'),
        ('mom jeans', 'jeans'),
        ('bootcut jeans', 'jeans'),
        ('bermuda shorts', 'bermuda_shorts'),
        ('board shorts', 'board_shorts'),
        ('bike shorts', 'bike_shorts'),
        ('cycling shorts', 'bike_shorts'),
        ('running shorts', 'athletic_shorts'),
        ('athletic shorts', 'athletic_shorts'),
        ('denim shorts', 'denim_shorts'),
        ('jean shorts', 'denim_shorts'),
        
        # Skirts - specific patterns
        ('pencil skirt', 'pencil_skirt'),
        ('a-line skirt', 'a_line_skirt'),
        ('a line skirt', 'a_line_skirt'),
        ('circle skirt', 'circle_skirt'),
        ('pleated skirt', 'pleated_skirt'),
        ('wrap skirt', 'wrap_skirt'),
        ('mini skirt', 'mini_skirt'),
        ('midi skirt', 'midi_skirt'),
        ('maxi skirt', 'maxi_skirt'),
        
        # Dresses - specific patterns
        ('cocktail dress', 'cocktail_dress'),
        ('evening dress', 'evening_dress'),
        ('ball gown', 'gown'),
        ('sheath dress', 'sheath_dress'),
        ('shift dress', 'shift_dress'),
        ('wrap dress', 'wrap_dress'),
        ('shirt dress', 'shirt_dress'),
        ('sweater dress', 'sweater_dress'),
        ('jumper dress', 'jumper_dress'),
        ('slip dress', 'slip_dress'),
        ('bodycon dress', 'bodycon_dress'),
        ('fit and flare dress', 'fit_and_flare_dress'),
        ('a-line dress', 'a_line_dress'),
        ('a line dress', 'a_line_dress'),
        ('maxi dress', 'maxi_dress'),
        ('midi dress', 'midi_dress'),
        ('mini dress', 'mini_dress'),
        ('sun dress', 'sundress'),
        
        # Formal wear
        ('dress shirt', 'dress_shirt'),
        ('button down', 'button_down'),
        ('button up', 'button_down'),
        ('oxford shirt', 'oxford_shirt'),
        ('polo shirt', 'polo'),
        ('rugby shirt', 'rugby_shirt'),
        
        # Athletic wear
        ('sports bra', 'sports_bra'),
        ('compression shirt', 'compression_shirt'),
        ('rash guard', 'rashguard'),
        ('swim trunks', 'swim_trunks'),
        ('swim shorts', 'swim_shorts'),
        ('bathing suit', 'swimsuit'),
        ('swimming costume', 'swimsuit'),
        
        # Footwear - specific patterns
        ('running shoes', 'running_shoes'),
        ('tennis shoes', 'sneakers'),
        ('athletic shoes', 'sneakers'),
        ('high tops', 'high_tops'),
        ('low tops', 'sneakers'),
        ('high heels', 'heels'),
        ('kitten heels', 'heels'),
        ('block heels', 'heels'),
        ('ankle boots', 'ankle_boots'),
        ('knee high boots', 'knee_high_boots'),
        ('over the knee boots', 'over_knee_boots'),
        ('thigh high boots', 'thigh_high_boots'),
        ('cowboy boots', 'cowboy_boots'),
        ('combat boots', 'combat_boots'),
        ('work boots', 'work_boots'),
        ('hiking boots', 'hiking_boots'),
        ('rain boots', 'rain_boots'),
        ('snow boots', 'snow_boots'),
        ('chelsea boots', 'chelsea_boots'),
        ('desert boots', 'desert_boots'),
        ('chukka boots', 'chukka_boots'),
        ('ugg boots', 'uggs'),
        ('boat shoes', 'boat_shoes'),
        ('deck shoes', 'boat_shoes'),
        ('driving shoes', 'loafers'),
        ('penny loafers', 'loafers'),
        ('ballet flats', 'flats'),
        ('flip flops', 'flip_flops'),
        ('gladiator sandals', 'sandals'),
        
        # Accessories
        ('baseball cap', 'baseball_cap'),
        ('trucker hat', 'trucker_hat'),
        ('bucket hat', 'bucket_hat'),
        ('sun hat', 'sun_hat'),
        ('winter hat', 'beanie'),
        ('knit hat', 'beanie'),
        ('bow tie', 'bow_tie'),
        ('fanny pack', 'fanny_pack'),
        ('waist pack', 'fanny_pack'),
        ('belt bag', 'belt_bag'),
        ('cross body bag', 'crossbody_bag'),
        ('crossbody bag', 'crossbody_bag'),
        ('shoulder bag', 'shoulder_bag'),
        ('tote bag', 'tote'),
        ('messenger bag', 'messenger_bag'),
        
        # Underwear/intimates
        ('boxer briefs', 'boxer_briefs'),
        ('sports bra', 'sports_bra'),
        ('boy shorts', 'boyshorts'),
        
        # One-pieces
        ('one piece', 'bodysuit'),
        ('two piece', 'bikini'),
    ]
    
    # Check multi-word patterns first
    for pattern, item_type in multi_word_patterns:
        if pattern in query_lower:
            return item_type
    
    # Comprehensive single-word clothing items (ordered by specificity)
    clothing_items = [
        # Outerwear (check before generic "coat" or "jacket")
        'parka', 'anorak', 'windbreaker', 'raincoat', 'peacoat', 'overcoat',
        'blazer', 'puffer', 'bomber', 'varsity', 'mackintosh', 'slicker',
        
        # Specific tops (before generic "top" or "shirt")
        'hoodie', 'hoody', 'sweatshirt', 'sweater', 'jumper', 'pullover',
        'cardigan', 'cardi', 'shrug', 'bolero', 'turtleneck', 'henley',
        'polo', 'tunic', 'camisole', 'cami', 'blouse', 'bodysuit', 'leotard',
        'unitard', 'jersey', 'fleece', 'thermal', 'rashguard',
        
        # Dresses and one-pieces
        'dress', 'gown', 'sundress', 'pinafore', 'smock', 'frock',
        'jumpsuit', 'romper', 'playsuit', 'onesie', 'catsuit',
        'coveralls', 'overalls', 'dungarees', 'shortalls',
        
        # Specific bottoms (before generic "pants")
        'jeans', 'denim', 'chinos', 'khakis', 'corduroys', 'cords',
        'culottes', 'gauchos', 'joggers', 'sweatpants', 'sweats',
        'leggings', 'tights', 'jeggings', 'treggings', 'capris',
        'trousers', 'slacks', 'britches', 'knickers',
        
        # Shorts
        'shorts', 'bermudas', 'jorts', 'cutoffs',
        
        # Skirts
        'skirt', 'kilt', 'sarong', 'tutu', 'petticoat',
        
        # Underwear/Intimates
        'underwear', 'panties', 'briefs', 'boxers', 'thong', 'boyshorts',
        'bra', 'brassiere', 'bralette', 'bustier', 'corset', 'basque',
        'slip', 'chemise', 'teddy', 'negligee', 'lingerie',
        
        # Sleepwear
        'pajamas', 'pyjamas', 'pjs', 'nightgown', 'nightie', 'nightshirt',
        'robe', 'bathrobe', 'housecoat', 'dressing gown',
        
        # Swimwear
        'swimsuit', 'bikini', 'tankini', 'monokini', 'wetsuit', 'swimwear',
        
        # Footwear
        'shoes', 'sneakers', 'trainers', 'runners', 'kicks',
        'boots', 'booties', 'wellies', 'uggs', 'wellingtons',
        'heels', 'stilettos', 'pumps', 'platforms', 'wedges',
        'flats', 'espadrilles', 'mules', 'clogs', 'slides',
        'sandals', 'flip-flops', 'thongs', 'huaraches', 'birkenstocks',
        'loafers', 'moccasins', 'oxfords', 'brogues', 'derbies',
        'cleats', 'spikes',
        
        # Accessories
        'hat', 'cap', 'beanie', 'beret', 'fedora', 'trilby', 'panama',
        'bowler', 'sombrero', 'fascinator', 'headband', 'headscarf',
        'turban', 'visor', 'snapback', 'stetson',
        'scarf', 'tie', 'necktie', 'ascot', 'cravat', 'bandana',
        'gloves', 'mittens', 'gauntlets',
        'belt', 'sash', 'cummerbund', 'suspenders', 'braces',
        'bag', 'purse', 'handbag', 'clutch', 'wristlet', 'wallet',
        'backpack', 'rucksack', 'satchel', 'tote', 'briefcase',
        
        # Traditional/Cultural
        'sari', 'saree', 'kimono', 'yukata', 'cheongsam', 'qipao',
        'dirndl', 'lederhosen', 'poncho', 'serape', 'dashiki', 'kaftan',
        'thobe', 'abaya', 'hijab', 'burqa', 'niqab', 'dhoti', 'lungi',
        'hanbok', 'kente',
        
        # Formal
        'suit', 'tuxedo', 'tux', 'waistcoat', 'vest', 'gilet',
        
        # Generic terms (last)
        'jacket', 'coat', 'top', 'shirt', 'pants', 'garment', 'apparel'
    ]
    
    # Check for plural forms and exact matches
    words = query_lower.split()
    
    # First check exact word matches (including plurals)
    for word in words:
        # Remove common punctuation
        clean_word = re.sub(r'[^\w\s-]', '', word)
        
        # Check singular form
        if clean_word in clothing_items:
            return clean_word
        
        # Check if it's a plural form
        if clean_word.endswith('s') and clean_word[:-1] in clothing_items:
            return clean_word[:-1]
        
        # Check irregular plurals
        irregular_plurals = {
            'scarves': 'scarf',
            'gloves': 'glove',
            'clothes': 'clothing',
            'jeans': 'jeans',  # already plural
            'pants': 'pants',  # already plural
            'shorts': 'shorts',  # already plural
            'tights': 'tights',  # already plural
            'glasses': 'glasses',  # already plural
        }
        if clean_word in irregular_plurals:
            return irregular_plurals[clean_word]
    
    # Then check for items within compound words
    for item in clothing_items:
        if item in query_lower:
            return item
    
    # Look for gender-specific patterns
    gender_markers = ['women\'s', 'womens', 'women\'s', 'men\'s', 'mens', 'men\'s', 
                      'girls', 'boys', 'ladies', 'unisex', 'kids', 'children\'s', 'childrens']
    
    for i, word in enumerate(words):
        if word in gender_markers and i + 1 < len(words):
            next_word = words[i + 1]
            # Skip common modifiers
            modifiers = ['vintage', 'casual', 'formal', 'summer', 'winter', 'spring', 'fall',
                        'designer', 'luxury', 'cheap', 'discount', 'new', 'used', 'small',
                        'medium', 'large', 'xl', 'xxl', 'plus', 'size', 'petite', 'tall']
            
            j = i + 1
            while j < len(words) and words[j] in modifiers:
                j += 1
            
            if j < len(words):
                potential_item = words[j]
                # Check if it's a clothing item
                if potential_item in clothing_items:
                    return potential_item
                # Check singular form
                if potential_item.endswith('s') and potential_item[:-1] in clothing_items:
                    return potential_item[:-1]
    
    # If query contains clothing-related terms but no specific item
    clothing_indicators = ['wear', 'outfit', 'apparel', 'garment', 'attire', 'clothing', 'fashion']
    for indicator in clothing_indicators:
        if indicator in query_lower:
            return 'clothing'
    
    # Default return
    return 'clothing'


def normalize_item_type(item_type):
    """
    Optionally normalize specific item types to broader categories
    
    Parameters:
    - item_type: The specific item type extracted
    
    Returns:
    - Normalized category string
    """
    normalizations = {
        # Normalize all shoe types to 'shoes'
        'sneakers': 'shoes', 'trainers': 'shoes', 'runners': 'shoes',
        'heels': 'shoes', 'stilettos': 'shoes', 'pumps': 'shoes',
        'platforms': 'shoes', 'wedges': 'shoes', 'flats': 'shoes',
        'loafers': 'shoes', 'moccasins': 'shoes', 'oxfords': 'shoes',
        'brogues': 'shoes', 'derbies': 'shoes', 'espadrilles': 'shoes',
        'mules': 'shoes', 'clogs': 'shoes', 'slides': 'shoes',
        'sandals': 'shoes', 'flip-flops': 'shoes', 'thongs': 'shoes',
        
        # Normalize all boot types to 'boots'
        'booties': 'boots', 'wellies': 'boots', 'uggs': 'boots',
        
        # Normalize jacket types
        'blazer': 'jacket', 'bomber': 'jacket', 'puffer': 'jacket',
        'varsity': 'jacket', 'windbreaker': 'jacket',
        
        # Normalize coat types
        'parka': 'coat', 'peacoat': 'coat', 'overcoat': 'coat',
        'raincoat': 'coat', 'anorak': 'coat',
        
        # Normalize pants types
        'jeans': 'pants', 'chinos': 'pants', 'khakis': 'pants',
        'trousers': 'pants', 'slacks': 'pants', 'joggers': 'pants',
        'sweatpants': 'pants', 'leggings': 'pants', 'tights': 'pants',
        
        # Normalize underwear
        'panties': 'underwear', 'briefs': 'underwear', 'boxers': 'underwear',
        'thong': 'underwear', 'boyshorts': 'underwear',
    }
    
    return normalizations.get(item_type, item_type)


def clean_single_product(product):
    """
    Clean a single product from the shopping results
    
    Parameters:
    - product: Single product dictionary from shopping_results
    
    Returns:
    - Cleaned product dictionary or None if invalid
    """
    if not product or not isinstance(product, dict):
        return None
    
    # Extract and clean price information
    price_info = extract_price_info(product)
    
    # Extract discount information
    discount_info = extract_discount_info(product, price_info)
    
    # Get the best available image URL
    image_url = get_best_image_url(product)
    
    # Clean and validate product URL
    product_url = product.get("product_link") or product.get("link")
    
    # Extract delivery information
    delivery_info = product.get("delivery") or product.get("shipping")
    
    # Extract tags (like sale tags)
    tags = extract_product_tags(product)
    
    cleaned_product = {
        "id": product.get("product_id") or product.get("position", "unknown"),
        "title": clean_product_title(product.get("title", "")),
        "price": price_info["price_display"],
        "price_numeric": price_info["price_numeric"],
        "old_price": price_info["old_price_display"],
        "old_price_numeric": price_info["old_price_numeric"],
        "discount_percentage": discount_info["percentage"],
        "image_url": image_url,
        "product_url": product_url,
        "source": product.get("source", "Unknown"),
        "source_icon": product.get("source_icon"),
        "rating": clean_rating(product.get("rating")),
        "review_count": clean_review_count(product.get("reviews")),
        "delivery_info": delivery_info,
        "tags": tags
    }
    
    return cleaned_product


def extract_price_info(product):
    """Extract and clean price information from a product"""
    price_display = product.get("price")
    price_numeric = product.get("extracted_price")
    old_price_display = product.get("old_price")
    old_price_numeric = product.get("extracted_old_price")
    
    # Clean price display strings
    if price_display and isinstance(price_display, str):
        price_display = price_display.strip()
    
    if old_price_display and isinstance(old_price_display, str):
        old_price_display = old_price_display.strip()
        # Remove "Was" prefix if present
        if old_price_display.lower().startswith("was "):
            old_price_display = old_price_display[4:].strip()
    
    return {
        "price_display": price_display,
        "price_numeric": float(price_numeric) if price_numeric else None,
        "old_price_display": old_price_display,
        "old_price_numeric": float(old_price_numeric) if old_price_numeric else None
    }


def extract_discount_info(product, price_info):
    """Extract discount information from a product"""
    # Check for discount tags first
    extensions = product.get("extensions", [])
    tag = product.get("tag")
    
    discount_percentage = None
    
    # Look for percentage in tag or extensions
    for item in [tag] + (extensions if extensions else []):
        if item and isinstance(item, str) and "%" in item and "OFF" in item.upper():
            # Extract percentage number
            import re
            match = re.search(r'(\d+)%', item)
            if match:
                discount_percentage = f"{match.group(1)}% OFF"
                break
    
    # If no tag found but we have both prices, calculate discount
    if not discount_percentage and price_info["price_numeric"] and price_info["old_price_numeric"]:
        old_price = price_info["old_price_numeric"]
        new_price = price_info["price_numeric"]
        if old_price > new_price:
            percentage = round(((old_price - new_price) / old_price) * 100)
            discount_percentage = f"{percentage}% OFF"
    
    return {
        "percentage": discount_percentage
    }


def get_best_image_url(product):
    """Get the best available image URL for a product"""
    # Priority order: thumbnail, thumbnails[0], serpapi_thumbnails[0]
    image_url = product.get("thumbnail")
    
    if not image_url:
        thumbnails = product.get("thumbnails", [])
        if thumbnails and len(thumbnails) > 0:
            image_url = thumbnails[0]
    
    if not image_url:
        serpapi_thumbnails = product.get("serpapi_thumbnails", [])
        if serpapi_thumbnails and len(serpapi_thumbnails) > 0:
            image_url = serpapi_thumbnails[0]
    
    return image_url


def extract_product_tags(product):
    """Extract tags from a product (like sale tags)"""
    tags = []
    
    # Add tag if present
    tag = product.get("tag")
    if tag and isinstance(tag, str):
        tags.append(tag)
    
    # Add extensions if they're different from tag
    extensions = product.get("extensions", [])
    if extensions:
        for ext in extensions:
            if ext and isinstance(ext, str) and ext not in tags:
                tags.append(ext)
    
    return tags


def clean_product_title(title):
    """Clean and truncate product title if needed"""
    if not title:
        return "Untitled Product"
    
    title = title.strip()
    
    # Truncate very long titles
    if len(title) > 100:
        title = title[:97] + "..."
    
    return title


def clean_rating(rating):
    """Clean and validate rating value"""
    if rating is None:
        return None
    
    try:
        rating_float = float(rating)
        # Ensure rating is between 0 and 5
        if 0 <= rating_float <= 5:
            return round(rating_float, 1)
    except (ValueError, TypeError):
        pass
    
    return None


def clean_review_count(reviews):
    """Clean and validate review count"""
    if reviews is None:
        return None
    
    try:
        review_count = int(reviews)
        return review_count if review_count >= 0 else None
    except (ValueError, TypeError):
        pass
    
    return None


def calculate_price_range(prices):
    """Calculate price range statistics from a list of prices"""
    if not prices:
        return None
    
    prices = [p for p in prices if p is not None and p > 0]
    if not prices:
        return None
    
    return {
        "min": round(min(prices), 2),
        "max": round(max(prices), 2),
        "average": round(sum(prices) / len(prices), 2)
    }


def save_cleaned_results_to_json(cleaned_data, output_path=None):
    """
    Save cleaned search results to a JSON file
    
    Parameters:
    - cleaned_data: Cleaned data from clean_search_results_for_frontend
    - output_path: Path to save the JSON file (default: generates timestamped filename)
    
    Returns:
    - Path to the saved JSON file or error dict
    """
    if not cleaned_data:
        return {"error": "No cleaned data to save"}
    
    # Generate output path if not provided
    if not output_path:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"cleaned_search_results_{timestamp}.json"
    
    # Ensure directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Save to JSON with proper formatting
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
        return output_path
    except Exception as e:
        return {"error": f"Failed to save cleaned results: {str(e)}"}


# Enhanced version of outfit_recommendation that includes cleaned data
def outfit_recommendation_with_cleaned_data(image_path, country="us", language="en", output_path=None, enable_redo=False, save_raw_json=True, save_cleaned_json=True, extract_direct_links=True, progress_callback=None):
    """
    Enhanced version that returns both raw and cleaned data for frontend use with direct link extraction
    
    Parameters:
    - image_path: Path to the outfit image
    - country: Two-letter country code (default: "us")
    - language: Language code (default: "en")
    - output_path: Base path for output files (default: generates timestamped filename)
    - enable_redo: If True, returns conversation context for potential redo
    - save_raw_json: If True, saves complete raw SerpAPI responses as JSON
    - save_cleaned_json: If True, saves cleaned data optimized for frontend
    - extract_direct_links: If True, extracts direct retailer links from Google Shopping URLs
    - progress_callback: Optional callback function for progress updates
    
    Returns:
    - Dictionary containing results, cleaned data, and optionally conversation context
    """
    
    # Progress tracking
    def update_progress(message):
        if progress_callback:
            progress_callback(message)
        print(f"🔄 {message}")
    
    update_progress("Identifying clothing items...")
    
    # Get the base result from the existing function
    result = outfit_recommendation_with_redo(
        image_path=image_path,
        country=country,
        language=language,
        output_path=output_path,
        enable_redo=enable_redo,
        save_raw_json=save_raw_json
    )
    
    # If there was an error in the base function, return it
    if "error" in result:
        return result
    
    update_progress("Cleaning and organizing search results...")
    
    # Clean the raw search results for frontend
    raw_results = result.get("raw_results_data", [])
    cleaned_data = clean_search_results_for_frontend(raw_results)
    
    # Extract direct links if requested
    if extract_direct_links and cleaned_data.get("clothing_items"):
        update_progress("Extracting direct retailer links...")
        
        try:
            # Extract direct links with progress updates
            cleaned_data = extract_direct_links_for_products(
                cleaned_data=cleaned_data,
                progress_callback=update_progress,
                max_workers=20,  # Optimized for speed
                delay=0  # Maximum speed as requested
            )
            
            # Add extraction metadata to result
            result["direct_links_extracted"] = True
            result["direct_links_extraction_time"] = datetime.now().isoformat()
            
        except Exception as e:
            print(f"⚠️ Warning: Direct link extraction failed: {e}")
            result["direct_links_extracted"] = False
            result["direct_links_error"] = str(e)
            update_progress("Direct link extraction failed, continuing without direct links...")
    else:
        result["direct_links_extracted"] = False
        result["direct_links_reason"] = "Disabled or no products found"
    
    update_progress("Finalizing results...")
    
    # Save cleaned data if requested
    cleaned_json_path = None
    if save_cleaned_json:
        if output_path:
            # Generate cleaned JSON path based on base path
            base_path = os.path.splitext(output_path)[0]
            cleaned_json_path = f"{base_path}_cleaned.json"
        else:
            cleaned_json_path = None
        
        cleaned_json_result = save_cleaned_results_to_json(cleaned_data, cleaned_json_path)
        if isinstance(cleaned_json_result, dict) and "error" in cleaned_json_result:
            print(f"Warning: Failed to save cleaned results - {cleaned_json_result['error']}")
            cleaned_json_path = None
        else:
            cleaned_json_path = cleaned_json_result
            print(f"Cleaned search results saved to: {cleaned_json_path}")
    
    # Add cleaned data to result
    result["cleaned_data"] = cleaned_data
    if cleaned_json_path:
        result["cleaned_results_saved_to"] = cleaned_json_path
    
    update_progress("Search and extraction complete!")
    
    return result


def extract_retailer_urls(google_url, delay=0):
    """
    Extract all retailer URLs from a Google Shopping product page.
    
    Args:
        google_url (str): The Google Shopping product URL
        delay (float): Delay between requests in seconds (default: 0)
    
    Returns:
        list: List of retailer URLs
    """
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # Add delay to be respectful to the server
        if delay > 0:
            time.sleep(delay)
        
        # Send GET request
        response = requests.get(google_url, headers=headers)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find all divs with class "UAVKwf" that contain retailer links
        retailer_containers = soup.find_all('div', class_='UAVKwf')
        
        retailer_urls = []
        
        for container in retailer_containers:
            # Find the anchor tag within each container
            link = container.find('a', class_='UxuaJe')
            
            if link and link.get('href'):
                href = link.get('href')
                
                # Extract actual URL from Google redirect
                actual_url = extract_actual_url(href)
                
                if actual_url and actual_url not in retailer_urls:
                    retailer_urls.append(actual_url)
        
        return retailer_urls
        
    except requests.RequestException as e:
        print(f"Error fetching the page: {e}")
        return []
    except Exception as e:
        print(f"Error parsing the page: {e}")
        return []

def extract_actual_url(google_redirect_url):
    """
    Extract the actual URL from Google's redirect URL format.
    
    Args:
        google_redirect_url (str): Google redirect URL (e.g., "/url?q=https://example.com&...")
    
    Returns:
        str: The actual retailer URL or None if extraction fails
    """
    try:
        # Parse the URL
        parsed = urlparse(google_redirect_url)
        
        # Extract query parameters
        query_params = parse_qs(parsed.query)
        
        # Get the 'q' parameter which contains the actual URL
        if 'q' in query_params:
            actual_url = query_params['q'][0]
            # URL decode in case there are encoded characters
            actual_url = unquote(actual_url)
            return actual_url
        
        return None
        
    except Exception as e:
        print(f"Error extracting URL from: {google_redirect_url} - {e}")
        return None

def scrape_single_url(args):
    """
    Scrape a single URL with retry logic. Designed for parallel execution.
    
    Args:
        args (tuple): (url, delay, max_retries, backoff_factor, thread_id)
    
    Returns:
        dict: Result containing success/failure info
    """
    url, delay, max_retries, backoff_factor, thread_id = args
    
    result = {
        'url': url,
        'thread_id': thread_id,
        'success': False,
        'retailer_urls': [],
        'error': None,
        'attempts': 0,
        'rate_limited': False,
        'start_time': time.time()
    }
    
    current_delay = delay
    
    for attempt in range(max_retries + 1):
        result['attempts'] = attempt + 1
        
        try:
            print(f"[Thread {thread_id}] Attempt {attempt + 1} for {url[:50]}...")
            
            retailer_urls = extract_retailer_urls(url, delay=current_delay)
            
            if retailer_urls:
                result['success'] = True
                result['retailer_urls'] = retailer_urls
                result['end_time'] = time.time()
                print(f"[Thread {thread_id}] ✓ Success: Found {len(retailer_urls)} retailer URLs")
                break
            else:
                if attempt < max_retries:
                    current_delay *= backoff_factor
                    print(f"[Thread {thread_id}] ⚠ No results, retrying with {current_delay:.2f}s delay...")
                    time.sleep(current_delay)
                else:
                    result['error'] = "No retailer URLs found after all retries"
                    print(f"[Thread {thread_id}] ✗ Failed: No results after {max_retries + 1} attempts")
                        
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:  # Rate limited
                result['rate_limited'] = True
                if attempt < max_retries:
                    current_delay *= backoff_factor
                    print(f"[Thread {thread_id}] ⚠ Rate limited (429). Backing off for {current_delay:.2f}s...")
                    time.sleep(current_delay)
                else:
                    result['error'] = f"Rate limited after {max_retries + 1} attempts"
                    print(f"[Thread {thread_id}] ✗ Failed: Rate limited, max retries reached")
                    break
            else:
                result['error'] = f"HTTP Error: {e}"
                print(f"[Thread {thread_id}] ✗ Failed: HTTP Error {e}")
                break
                
        except Exception as e:
            result['error'] = f"Unexpected error: {e}"
            print(f"[Thread {thread_id}] ✗ Failed: {e}")
            break
    
    result['end_time'] = time.time()
    result['duration'] = result['end_time'] - result['start_time']
    return result

def parallel_scrape_google_products(urls, delay=0, max_workers=20, max_retries=2, 
                                   backoff_factor=2.0, save_progress=True, 
                                   progress_file="parallel_scraping_progress.json"):
    """
    Scrape multiple Google Shopping product pages in parallel.
    
    Args:
        urls (list): List of Google Shopping product URLs
        delay (float): Base delay between requests in seconds (default: 0)
        max_workers (int): Maximum number of parallel threads (default: 10)
        max_retries (int): Maximum number of retries for failed requests
        backoff_factor (float): Multiplier for exponential backoff
        save_progress (bool): Save progress to file
        progress_file (str): File to save progress to
    
    Returns:
        dict: Results with URLs as keys and retailer URLs as values, plus metadata
    """
    
    # Thread-safe lock for shared data
    lock = threading.Lock()
    
    results = {
        'successful': {},
        'failed': {},
        'stats': {
            'total_urls': len(urls),
            'successful_count': 0,
            'failed_count': 0,
            'start_time': datetime.now().isoformat(),
            'rate_limit_hits': 0,
            'total_requests': 0,
            'max_workers': max_workers,
            'base_delay': delay
        }
    }
    
    print(f"🚀 Starting PARALLEL scraping of {len(urls)} URLs...")
    print(f"⚡ Max workers: {max_workers}, Base delay: {delay}s, Max retries: {max_retries}")
    print("⚠️  WARNING: Parallel processing with 0 delay will likely trigger rate limits quickly!")
    print("-" * 80)
    
    # Prepare arguments for parallel execution
    worker_args = [(url, delay, max_retries, backoff_factor, i) 
                   for i, url in enumerate(urls)]
    
    completed_count = 0
    start_time = time.time()
    
    # Execute in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_url = {executor.submit(scrape_single_url, args): args[0] 
                        for args in worker_args}
        
        # Process completed tasks as they finish
        for future in as_completed(future_to_url):
            with lock:  # Thread-safe access to shared results
                result = future.result()
                completed_count += 1
                
                results['stats']['total_requests'] += result['attempts']
                
                if result['success']:
                    results['successful'][result['url']] = result['retailer_urls']
                    results['stats']['successful_count'] += 1
                else:
                    results['failed'][result['url']] = result['error']
                    results['stats']['failed_count'] += 1
                
                if result['rate_limited']:
                    results['stats']['rate_limit_hits'] += 1
                
                # Print progress update
                elapsed = time.time() - start_time
                progress_pct = (completed_count / len(urls)) * 100
                success_rate = (results['stats']['successful_count'] / completed_count) * 100
                
                print(f"[{completed_count}/{len(urls)}] ({progress_pct:.1f}%) "
                      f"Success: {success_rate:.1f}% | "
                      f"Rate limits: {results['stats']['rate_limit_hits']} | "
                      f"Elapsed: {elapsed:.1f}s")
                
                # Save progress periodically (every 10 completions)
                if save_progress and completed_count % 10 == 0:
                    try:
                        with open(progress_file, 'w') as f:
                            json.dump(results, f, indent=2)
                        print(f"📁 Progress saved to {progress_file}")
                    except Exception as e:
                        print(f"❌ Error saving progress: {e}")
    
    # Calculate final stats
    total_time = time.time() - start_time
    results['stats']['end_time'] = datetime.now().isoformat()
    results['stats']['total_duration'] = total_time
    results['stats']['avg_requests_per_second'] = results['stats']['total_requests'] / total_time if total_time > 0 else 0
    
    # Final save
    if save_progress:
        try:
            with open(progress_file, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"💾 Final results saved to {progress_file}")
        except Exception as e:
            print(f"❌ Error saving final results: {e}")
    
    # Print comprehensive summary
    print("\n" + "=" * 80)
    print("🏁 FINAL PARALLEL SCRAPING RESULTS")
    print("=" * 80)
    print(f"📊 Total URLs processed: {len(urls)}")
    print(f"✅ Successful: {results['stats']['successful_count']} ({(results['stats']['successful_count']/len(urls)*100):.1f}%)")
    print(f"❌ Failed: {results['stats']['failed_count']} ({(results['stats']['failed_count']/len(urls)*100):.1f}%)")
    print(f"🚫 Rate limit hits: {results['stats']['rate_limit_hits']}")
    print(f"📈 Total requests made: {results['stats']['total_requests']}")
    print(f"⏱️  Total duration: {total_time:.2f} seconds")
    print(f"🔥 Average requests/second: {results['stats']['avg_requests_per_second']:.2f}")
    print(f"⚡ Max workers used: {max_workers}")
    
    # Rate limiting analysis
    if results['stats']['rate_limit_hits'] > 0:
        rate_limit_percentage = (results['stats']['rate_limit_hits'] / len(urls)) * 100
        print(f"⚠️  Rate limiting detected on {rate_limit_percentage:.1f}% of requests")
        print("💡 Consider reducing max_workers or adding delays")
    else:
        print("🎉 No rate limiting detected - you might be able to push harder!")
    
    return results
def _extract_retailer_name_from_url(url: str) -> str:
    """
    Extract a clean retailer name from a URL.
    """
    try:
        domain = urlparse(url).netloc.lower().replace('www.', '')
        # Capitalize the first part of the domain for a clean name
        return domain.split('.')[0].capitalize()
    except Exception:
        return "Unknown"

def _extract_retailer_domain_local(url: str) -> str:
    """
    Extract the domain from a URL.
    """
    try:
        return urlparse(url).netloc.replace('www.', '')
    except:
        return ""

def extract_direct_links_for_products(cleaned_data, progress_callback=None, max_workers=20, delay=0):
    """
    Extract direct retailer links for all products in cleaned search data.
    
    Args:
        cleaned_data (dict): Cleaned data from clean_search_results_for_frontend
        progress_callback (callable): Optional callback for progress updates
        max_workers (int): Maximum number of parallel threads
        delay (float): Base delay between requests
    
    Returns:
        dict: Enhanced cleaned_data with direct_links added to products
    """
    if not cleaned_data or not cleaned_data.get("clothing_items"):
        if progress_callback:
            progress_callback("No clothing items found for direct link extraction")
        return cleaned_data
    
    if progress_callback:
        progress_callback("Extracting direct retailer links...")
    
    # Collect all Google Shopping URLs from products with enhanced debugging
    url_to_product_mapping = {}  # Maps URL to list of products
    google_urls = []
    total_products = 0
    
    print("🔍 [DEBUG] Starting URL collection for direct link extraction...")
    
    for item_idx, clothing_item in enumerate(cleaned_data["clothing_items"]):
        item_query = clothing_item.get("query", "unknown")
        print(f"🔍 [DEBUG] Processing clothing item {item_idx + 1}: '{item_query}'")
        
        for prod_idx, product in enumerate(clothing_item.get("products", [])):
            total_products += 1
            product_url = product.get("product_url")
            product_title = product.get("title", "Unknown")[:50]
            
            print(f"   📦 Product {prod_idx + 1}: {product_title}")
            print(f"   🔗 URL: {product_url}")
            
            if product_url:
                if "google.com/shopping" in product_url:
                    if product_url not in url_to_product_mapping:
                        url_to_product_mapping[product_url] = []
                        google_urls.append(product_url)
                        print(f"   ✅ Added to extraction queue")
                    else:
                        print(f"   🔄 URL already queued")
                    url_to_product_mapping[product_url].append(product)
                else:
                    print(f"   ❌ Not a Google Shopping URL")
            else:
                print(f"   ❌ No URL found")
    
    print(f"🔍 [DEBUG] Collection complete:")
    print(f"   📊 Total products processed: {total_products}")
    print(f"   🔗 Unique Google Shopping URLs found: {len(google_urls)}")
    print(f"   📋 Sample URLs:")
    for i, url in enumerate(google_urls[:3]):
        print(f"      {i+1}. {url}")
    
    if not google_urls:
        if progress_callback:
            progress_callback("No Google Shopping URLs found for direct link extraction")
        print("⚠️ [DEBUG] No Google Shopping URLs found - all products will have empty direct_links")
        
        # Still add empty direct_links to all products for consistency
        for clothing_item in cleaned_data["clothing_items"]:
            for product in clothing_item.get("products", []):
                product["direct_links"] = []
        return cleaned_data
    
    if progress_callback:
        progress_callback(f"Extracting direct links from {len(google_urls)} product pages...")
    
    print(f"🚀 [DEBUG] Starting parallel scraping with {max_workers} workers...")
    
    # Use optimized settings for speed with enhanced error reporting
    try:
        scraping_results = parallel_scrape_google_products(
            urls=google_urls,
            delay=delay,
            max_workers=max_workers,
            max_retries=1,  # Fast fail for initial extraction
            backoff_factor=1.5,
            save_progress=False  # Don't save progress files for this
        )
        
        print(f"🔍 [DEBUG] Scraping completed:")
        print(f"   ✅ Successful extractions: {len(scraping_results.get('successful', {}))}")
        print(f"   ❌ Failed extractions: {len(scraping_results.get('failed', {}))}")
        print(f"   📊 Total requests made: {scraping_results.get('stats', {}).get('total_requests', 0)}")
        
    except Exception as e:
        print(f"❌ [DEBUG] Parallel scraping failed with exception: {e}")
        import traceback
        traceback.print_exc()
        
        # Set empty direct_links for all products
        for clothing_item in cleaned_data["clothing_items"]:
            for product in clothing_item.get("products", []):
                product["direct_links"] = []
        return cleaned_data
    
    # Apply the extracted direct links to products with detailed logging
    total_links_found = 0
    products_enhanced = 0
    
    print(f"🔍 [DEBUG] Applying extracted links to products...")
    
    for url, retailer_urls in scraping_results.get("successful", {}).items():
        if url in url_to_product_mapping:
            # Create a list of objects that match the frontend's DirectLink type
            direct_links_objects = [
                {
                    "id": f"dl_live_{i}", # Temporary ID for frontend keys
                    "retailer_url": retailer_url,
                    "retailer_name": _extract_retailer_name_from_url(retailer_url),
                    "retailer_domain": _extract_retailer_domain_local(retailer_url),
                    "is_active": True,
                    "created_at": datetime.now().isoformat()
                }
                for i, retailer_url in enumerate(retailer_urls)
            ]

            # Assign the list of objects to all products that came from this Google URL
            for product in url_to_product_mapping[url]:
                product["direct_links"] = direct_links_objects
                print(f"      📦 Enhanced product: {product.get('title', 'Unknown')[:40]}...")

    # For failed extractions, ensure the direct_links key is an empty array
    for url, error in scraping_results.get("failed", {}).items():
        print(f"   ❌ URL: {url[:60]}... → Failed: {error}")
        if url in url_to_product_mapping:
            for product in url_to_product_mapping[url]:
                product["direct_links"] = []
                print(f"      📦 Set empty links for: {product.get('title', 'Unknown')[:40]}...")


    print(f"🔍 [DEBUG] Link application complete:")
    print(f"   📦 Products enhanced: {products_enhanced}")
    print(f"   🔗 Total links found: {total_links_found}")
    
    if progress_callback:
        success_rate = (scraping_results['stats']['successful_count'] / len(google_urls)) * 100 if google_urls else 0
        progress_callback(f"Direct link extraction complete: {success_rate:.1f}% success rate, {total_links_found} total links found")
    
    return cleaned_data


def save_direct_links_to_database(cleaned_data, session_id=None):
    """
    Save direct links to database for products that have been saved.
    This should be called after products are saved to get their database IDs.
    
    Args:
        cleaned_data (dict): Cleaned data with direct_links
        session_id (str): Session ID to get products from database
    
    Returns:
        dict: Stats about links saved
    """
    try:
        from database_service import db_service
        
        print(f"🔍 [DEBUG] Starting direct links database save for session {session_id}")
        
        if not session_id:
            print("❌ [DEBUG] No session ID provided")
            return {"error": "Session ID required to save direct links"}
        
        # Get session with products from database
        print(f"🔍 [DEBUG] Fetching session data from database...")
        session_data = db_service.get_session_with_items_and_products(session_id)
        if not session_data:
            print(f"❌ [DEBUG] Session {session_id} not found in database")
            return {"error": f"Session {session_id} not found"}
        
        print(f"✅ [DEBUG] Session found with {len(session_data.get('clothing_items', []))} clothing items")
        
        stats = {
            "products_processed": 0,
            "links_saved": 0,
            "failed_saves": 0
        }
        
        # Create mapping from external_id to database product
        external_id_to_db_product = {}
        db_products_count = 0
        
        print(f"🔍 [DEBUG] Building external_id mapping...")
        for clothing_item in session_data.get("clothing_items", []):
            for db_product in clothing_item.get("products", []):
                db_products_count += 1
                external_id = db_product.get("external_id")
                if external_id:
                    external_id_to_db_product[external_id] = db_product
                    print(f"   📦 Mapped external_id {external_id} to DB product {db_product['id']}")
                else:
                    print(f"   ⚠️ DB product {db_product['id']} has no external_id")
        
        print(f"🔍 [DEBUG] Mapping complete:")
        print(f"   📊 Total DB products: {db_products_count}")
        print(f"   🗂️ Products with external_id: {len(external_id_to_db_product)}")
        print(f"   🔗 Sample mappings: {list(external_id_to_db_product.keys())[:3]}")
        
        # Save direct links for products that have them
        print(f"🔍 [DEBUG] Processing cleaned data products...")
        for item_idx, clothing_item in enumerate(cleaned_data.get("clothing_items", [])):
            for prod_idx, product in enumerate(clothing_item.get("products", [])):
                stats["products_processed"] += 1
                
                external_id = product.get("id")  # This is the external_id
                direct_links = product.get("direct_links", [])
                product_title = product.get("title", "Unknown")[:40]
                
                print(f"   📦 Product {stats['products_processed']}: {product_title}")
                print(f"      🔗 External ID: {external_id}")
                print(f"      🔗 Direct links count: {len(direct_links)}")
                
                if external_id and external_id in external_id_to_db_product:
                    print(f"      ✅ Found mapping to DB product")
                    if direct_links:
                        db_product = external_id_to_db_product[external_id]
                        product_id = db_product["id"]
                        
                        print(f"      💾 Saving {len(direct_links)} links to product {product_id}")
                        for i, link in enumerate(direct_links[:3]):  # Show first 3 links
                            print(f"         {i+1}. {link}")
                        
                        success = db_service.save_product_direct_links(product_id, direct_links)
                        if success:
                            stats["links_saved"] += len(direct_links)
                            print(f"      ✅ Successfully saved {len(direct_links)} links")
                        else:
                            stats["failed_saves"] += 1
                            print(f"      ❌ Failed to save links")
                    else:
                        print(f"      ⚠️ No direct links to save")
                else:
                    if not external_id:
                        print(f"      ❌ No external_id found")
                    else:
                        print(f"      ❌ External_id {external_id} not found in DB mapping")
                        print(f"         Available external_ids: {list(external_id_to_db_product.keys())[:5]}")
        
        print(f"🔍 [DEBUG] Database save complete:")
        print(f"   📊 Products processed: {stats['products_processed']}")
        print(f"   💾 Links saved: {stats['links_saved']}")
        print(f"   ❌ Failed saves: {stats['failed_saves']}")
        
        return stats
        
    except Exception as e:
        print(f"❌ [DEBUG] Exception in save_direct_links_to_database: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to save direct links: {str(e)}"}


# Example usage (commented out)
# if __name__ == "__main__":
#     # Basic usage
#     result = outfit_recommendation("path/to/outfit_image.jpg")
#     print(result)
#     
#     # Usage with redo capability
#     result_with_redo = outfit_recommendation_with_redo(
#         "path/to/outfit_image.jpg", 
#         enable_redo=True
#     )
#     
#     # If you want to redo the search queries
#     if "conversation_context" in result_with_redo:
#         redo_result = redo_search_queries(
#             result_with_redo["conversation_context"],
#             feedback_message="Please focus more on specific brand styles and materials"
#         )
#         print("New queries:", redo_result.get("queries", []))

