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
  is_saved?: boolean;
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
  session_id?: string; // Database session ID
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

// Database Entity Types
export interface ProductDetails {
  id: string;
  clothing_item_id: string;
  external_id: string | null;
  title: string;
  price: number | null;
  old_price: number | null;
  discount_percentage: number | null;
  image_url: string | null;
  product_url: string | null;
  source: string;
  source_icon: string | null;
  rating: number | null;
  review_count: number | null;
  delivery_info: string | null;
  tags: string[];
  created_at: string;
}

export interface ClothingItemDetails {
  id: string;
  search_session_id: string;
  query: string;
  item_type: string;
  total_products: number;
  price_range_min: number | null;
  price_range_max: number | null;
  price_range_average: number | null;
  created_at: string;
  products?: ProductDetails[];
}

export interface SearchSessionDetails {
  id: string;
  user_id: string | null;
  image_url: string;
  image_filename: string;
  file_id: string;
  status: 'uploading' | 'analyzing' | 'searching' | 'completed' | 'error';
  search_queries: string[];
  num_items_identified: number;
  num_products_found: number;
  conversation_context: any | null;
  error_message: string | null;
  country: string;
  language: string;
  created_at: string;
  updated_at: string;
  clothing_items?: ClothingItemDetails[];
}

// Search History Types
export interface SearchHistoryItem {
  id: string;
  user_id: string;
  search_session_id: string;
  created_at: string;
  search_sessions: SearchSessionDetails;
}

export interface SearchHistoryResponse {
  success: boolean;
  history: SearchHistoryItem[];
  pagination: PaginationInfo;
  error?: string;
}

export interface SearchHistoryDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Wishlist Types
export interface WishlistItemDetailed {
  id: string;
  user_id: string;
  product_id: string;
  notes: string | null;
  tags: string[];
  created_at: string;
  products: ProductDetails;
  // Collection-specific fields (when fetched from a collection)
  collection_position?: number;
  added_to_collection_at?: string;
}

export interface WishlistResponse {
  success: boolean;
  wishlist: WishlistItemDetailed[];
  pagination: PaginationInfo;
  error?: string;
}

export interface WishlistAddResponse {
  success: boolean;
  item?: WishlistItemDetailed;
  wishlist_item?: WishlistItemDetailed; // Keep for backwards compatibility
  message?: string;
  error?: string;
}

export interface WishlistStatusResponse {
  success: boolean;
  wishlist_status: Record<string, boolean>;
  error?: string;
}

// Pagination and Filtering Types
export interface PaginationInfo {
  limit: number;
  offset: number;
  has_more: boolean;
  total_count?: number;
}

export interface SearchHistoryFilters {
  searchQuery?: string; // Search within generated search queries (not filenames)
  sortBy: 'newest' | 'oldest' | 'most_items' | 'most_products';
}

export interface WishlistFilters {
  priceRange?: {
    min: number;
    max: number;
  };
  sources?: string[];
  tags?: string[];
  searchQuery?: string; // Search within product titles
  sortBy: 'newest' | 'oldest' | 'price_low' | 'price_high' | 'rating' | 'title';
  viewMode: 'grid' | 'list';
}

// User Profile Types
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserProfileResponse {
  success: boolean;
  profile?: UserProfile;
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
  is_saved?: boolean;
}

// Product type for the transformed backend data
export interface Product {
  id: string;
  product_id: string;
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
  is_saved?: boolean;
}

// Direct Links UI Component Types
export interface ProductCardAction {
  type: 'google_shopping';
  label: string;
  action: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
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
  sessionId?: string; // Database session ID for authenticated users
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

// API Response Types
export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
}

// Loading and UI State Types
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
  recoveryActions?: string[];
}

// Bulk Operations Types
export interface BulkOperation {
  type: 'delete' | 'export' | 'tag' | 'move';
  selectedIds: string[];
  data?: any;
}

// Statistics and Analytics Types
export interface SearchHistoryStats {
  totalSearches: number;
  successfulSearches: number;
  totalItemsFound: number;
  averageItemsPerSearch: number;
  topSources: Array<{
    source: string;
    count: number;
  }>;
  searchesByMonth: Array<{
    month: string;
    count: number;
  }>;
}

export interface WishlistStats {
  totalItems: number;
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  topSources: Array<{
    source: string;
    count: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
  }>;
}

// Collection Types
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number; // From the backend join
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  saved_item_id: string;
  position: number;
  added_at: string;
}

export interface CollectionsResponse {
  success: boolean;
  collections: Collection[];
  error?: string;
}

export interface CollectionResponse {
  success: boolean;
  collection?: Collection;
  error?: string;
}

export interface CollectionItemsResponse {
  success: boolean;
  collection?: Collection;
  items: WishlistItemDetailed[];
  pagination: PaginationInfo;
  error?: string;
}

export interface CollectionCreateRequest {
  name: string;
  description?: string;
  is_private?: boolean;
}

export interface CollectionUpdateRequest {
  name?: string;
  description?: string;
  is_private?: boolean;
  cover_image_url?: string;
}

export interface AddItemToCollectionRequest {
  saved_item_id: string;
}

// Collection Operation Response
export interface CollectionOperationResponse {
  success: boolean;
  message?: string;
  collection?: Collection;
  error?: string;
} 

