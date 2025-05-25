// Backend API Response Types
export interface BackendProduct {
  id: string;
  title: string;
  price: string | null;
  price_numeric: number | null;
  old_price: string | null;
  old_price_numeric: number | null;
  discount_percentage: string | null;
  image_url: string | null;
  product_url: string | null;
  source: string;
  source_icon: string | null;
  rating: number | null;
  review_count: number | null;
  delivery_info: string | null;
  tags: string[];
}

export interface BackendClothingItem {
  query: string;
  item_type: string;
  products: BackendProduct[];
  total_products: number;
  price_range: {
    min: number;
    max: number;
    average: number;
  } | null;
}

export interface BackendCleanedData {
  clothing_items: BackendClothingItem[];
  summary: {
    total_items: number;
    total_products: number;
    has_errors: boolean;
    error_items: Array<{
      query: string;
      error: string;
    }>;
  };
}

export interface BackendUploadResponse {
  success: boolean;
  file_id: string;
  filename: string;
  num_items_identified: number;
  num_products_found: number;
  search_queries: string[];
  cleaned_data: BackendCleanedData;
  conversation_context?: any; // For redo functionality
  files: {
    csv_file?: string;
    raw_json_file?: string;
    cleaned_json_file?: string;
  };
  error?: string;
}

export interface BackendRedoResponse {
  success: boolean;
  new_queries: string[];
  cleaned_data: BackendCleanedData;
  conversation_context: any;
  feedback_used?: string;
  error?: string;
}

// Frontend Types (keeping existing for compatibility)
export interface ClothingItem {
  query: string;
  title: string | null;
  link: string | null;
  price: string | null;
  extracted_price: number | null;
  source: string | null;
  rating: number | null;
  reviews: number | null;
  thumbnail: string | null;
  product_id: string | null;
  shipping?: string | null;
  tag?: string | null;
  error?: string;
}

export interface SearchSession {
  id: string;
  imageUrl: string;
  status: 'uploading' | 'analyzing' | 'searching' | 'completed' | 'error';
  queries: string[];
  results: ClothingItem[];
  createdAt: Date;
  error?: string;
  conversationContext?: any; // For redo functionality
  backendData?: BackendCleanedData; // Store original backend data
  fileId?: string; // For redo functionality
}

export interface UploadedImage {
  file: File;
  preview: string;
  uploaded: boolean;
}

export interface SearchFilters {
  priceRange: {
    min: number;
    max: number;
  };
  sources: string[];
  sortBy: 'relevance' | 'price-low' | 'price-high' | 'rating';
}

export interface WishlistItem {
  id: string;
  clothingItem: ClothingItem;
  notes?: string;
  addedAt: Date;
} 