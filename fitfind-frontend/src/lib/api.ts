import { 
  BackendUploadResponse, 
  BackendRedoResponse, 
  WishlistResponse, 
  WishlistAddResponse, 
  WishlistStatusResponse,
  SearchHistoryResponse,
  CollectionsResponse,
  CollectionResponse,
  CollectionItemsResponse,
  CollectionOperationResponse,
  WishlistFilters,
  CollectionCreateRequest,
  CollectionUpdateRequest,
  AddItemToCollectionRequest
} from '@/types';
import { supabase } from '@/lib/supabase';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Simple cache implementation
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ApiCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // Make cache accessible for pattern matching
  get keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

const apiCache = new ApiCache();

// Helper function to get auth headers
const getAuthHeaders = async () => {
  if (typeof window === 'undefined') return {};
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Error getting Supabase session:', error);
      return {};
    }
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch (error) {
    console.warn('Failed to get Supabase session:', error);
    return {};
  }
};

// Generic API fetch wrapper with caching
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  cacheable: boolean = false,
  cacheTtl?: number
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = options.method || 'GET';
  
  // Create cache key for GET requests
  const cacheKey = `${method}:${url}:${JSON.stringify(options.body || {})}`;
  
  // Check cache for GET requests
  if (cacheable && method === 'GET') {
    const cached = apiCache.get<T>(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  const data = await response.json();
  
  // Cache successful GET requests
  if (cacheable && method === 'GET') {
    apiCache.set(cacheKey, data, cacheTtl);
  }

  return data;
}

// Upload outfit image
export async function uploadOutfitImage(
  file: File,
  options?: {
    country?: string;
    language?: string;
  }
): Promise<BackendUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  if (options?.country) {
    formData.append('country', options.country);
  }
  if (options?.language) {
    formData.append('language', options.language);
  }

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  return response.json();
}

// Redo search
export async function redoSearch(
  conversationContext: any,
  feedback?: string,
  options?: {
    country?: string;
    language?: string;
    fileId?: string;
    sessionId?: string;
  }
): Promise<BackendRedoResponse> {
  const requestBody: any = {
    conversation_context: conversationContext,
    feedback_message: feedback || undefined,
  };

  if (options?.country) {
    requestBody.country = options.country;
  }
  if (options?.language) {
    requestBody.language = options.language;
  }
  if (options?.fileId) {
    requestBody.file_id = options.fileId;
  }
  if (options?.sessionId) {
    requestBody.session_id = options.sessionId;
  }

  return apiRequest<BackendRedoResponse>('/api/redo', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
}

// Wishlist API functions
export async function getWishlist(
  offset: number = 0,
  limit: number = 20,
  filters?: WishlistFilters
): Promise<WishlistResponse> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
    ...(filters?.source && { source: filters.source }),
    ...(filters?.minPrice && { min_price: filters.minPrice.toString() }),
    ...(filters?.maxPrice && { max_price: filters.maxPrice.toString() }),
    ...(filters?.sortBy && { sort_by: filters.sortBy }),
    ...(filters?.sortOrder && { sort_order: filters.sortOrder }),
  });

  return apiRequest<WishlistResponse>(`/api/wishlist?${params}`, {}, true, 2 * 60 * 1000); // Cache for 2 minutes
}

export async function addToWishlist(
  productId: string,
  sessionId?: string
): Promise<WishlistAddResponse> {
  const result = await apiRequest<WishlistAddResponse>('/api/wishlist', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, session_id: sessionId }),
  });
  
  // Clear wishlist cache after adding item
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/wishlist`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}

export async function removeFromWishlist(productId: string): Promise<{ success: boolean }> {
  const result = await apiRequest<{ success: boolean }>(`/api/wishlist/${productId}`, {
    method: 'DELETE',
  });
  
  // Clear wishlist cache after removing item
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/wishlist`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}

export async function checkWishlistStatus(
  productIds: string[]
): Promise<WishlistStatusResponse> {
  return apiRequest<WishlistStatusResponse>('/api/wishlist/check', {
    method: 'POST',
    body: JSON.stringify({ product_ids: productIds }),
  });
}

// Search history API functions
export async function getSearchHistory(
  offset: number = 0,
  limit: number = 20
): Promise<SearchHistoryResponse> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
  });

  return apiRequest<SearchHistoryResponse>(`/api/history?${params}`, {}, true, 1 * 60 * 1000); // Cache for 1 minute
}

export async function deleteSearchHistory(historyId: string): Promise<{ success: boolean }> {
  const result = await apiRequest<{ success: boolean }>(`/api/history/${historyId}`, {
    method: 'DELETE',
  });
  
  // Clear history cache after deleting item
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/history`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}

export async function bulkDeleteSearchHistory(
  historyIds: string[]
): Promise<{ success: boolean }> {
  const result = await apiRequest<{ success: boolean }>('/api/history/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ history_ids: historyIds }),
  });
  
  // Clear history cache after bulk delete
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/history`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}

export async function getSearchSessionDetails(sessionId: string): Promise<{ success: boolean; session?: any; error?: string }> {
  return apiRequest<{ success: boolean; session?: any; error?: string }>(`/api/history/${sessionId}`, {}, true, 1 * 60 * 1000); // Cache for 1 minute
}

// Collections API functions
export async function getCollections(): Promise<CollectionsResponse> {
  return apiRequest<CollectionsResponse>('/api/collections', {}, true, 3 * 60 * 1000); // Cache for 3 minutes
}

export async function getCollection(collectionId: string): Promise<CollectionResponse> {
  return apiRequest<CollectionResponse>(`/api/collections/${collectionId}`, {}, true, 2 * 60 * 1000); // Cache for 2 minutes
}

export async function getCollectionItems(
  collectionId: string,
  offset: number = 0,
  limit: number = 20
): Promise<CollectionItemsResponse> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
  });

  return apiRequest<CollectionItemsResponse>(`/api/collections/${collectionId}/items?${params}`, {}, true, 2 * 60 * 1000); // Cache for 2 minutes
}

export async function createCollection(
  data: CollectionCreateRequest
): Promise<CollectionOperationResponse> {
  const result = await apiRequest<CollectionOperationResponse>('/api/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // Clear collections cache after creating new collection
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/collections`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}

export async function updateCollection(
  collectionId: string,
  data: CollectionUpdateRequest
): Promise<CollectionOperationResponse> {
  const result = await apiRequest<CollectionOperationResponse>(`/api/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  
  // Clear related caches after updating collection
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/collections`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}

export async function deleteCollection(collectionId: string): Promise<CollectionOperationResponse> {
  const result = await apiRequest<CollectionOperationResponse>(`/api/collections/${collectionId}`, {
    method: 'DELETE',
  });
  
  // Clear all collections-related caches after deleting collection
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/collections`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}

export async function addItemToCollection(
  collectionId: string,
  data: AddItemToCollectionRequest
): Promise<CollectionOperationResponse> {
  const result = await apiRequest<CollectionOperationResponse>(`/api/collections/${collectionId}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // Clear collection items cache after adding item
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/collections/(${collectionId}|$)`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}

export async function removeItemFromCollection(
  collectionId: string,
  savedItemId: string
): Promise<CollectionOperationResponse> {
  const result = await apiRequest<CollectionOperationResponse>(`/api/collections/${collectionId}/items/${savedItemId}`, {
    method: 'DELETE',
  });
  
  // Clear collection items cache after removing item
  const cachePattern = new RegExp(`GET:${API_BASE_URL}/api/collections/(${collectionId}|$)`);
  apiCache.keys.forEach(key => {
    if (cachePattern.test(key)) {
      apiCache.delete(key);
    }
  });
  
  return result;
}