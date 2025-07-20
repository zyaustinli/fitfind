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
  AddItemToCollectionRequest,
  SearchHistoryDeleteResponse,
  SearchSessionDetails
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

// Helper function to get auth headers
const getAuthHeaders = async () => {
  if (typeof window === 'undefined') return {};
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Error getting Supabase session for API headers:', error);
      return {};
    }
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch (error) {
    console.warn('Failed to get Supabase session for API headers:', error);
    return {};
  }
};

// Generic API fetch wrapper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
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

  return response.json();
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
  
  if (options?.country) formData.append('country', options.country);
  if (options?.language) formData.append('language', options.language);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { ...(await getAuthHeaders()) },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.error || `HTTP ${response.status}: ${response.statusText}`, response.status, errorData);
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
  return apiRequest<BackendRedoResponse>('/api/redo', {
    method: 'POST',
    body: JSON.stringify({ ...options, conversation_context: conversationContext, feedback_message: feedback }),
  });
}

// Wishlist API functions
export async function getWishlist(limit: number = 20, offset: number = 0): Promise<WishlistResponse> {
    const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
    });

    return apiRequest<WishlistResponse>(`/api/wishlist?${params.toString()}`);
}

export async function addToWishlist(
  productId: string,
  notes?: string,
  tags?: string[]
): Promise<WishlistAddResponse> {
  return apiRequest<WishlistAddResponse>('/api/wishlist/add', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, notes, tags }),
  });
}

export async function removeFromWishlist(productId: string): Promise<{ success: boolean; error?: string }> {
  return apiRequest<{ success: boolean; error?: string }>('/api/wishlist/remove', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  });
}

export async function checkWishlistStatus(productIds: string[]): Promise<WishlistStatusResponse> {
  return apiRequest<WishlistStatusResponse>('/api/wishlist/check', {
    method: 'POST',
    body: JSON.stringify({ product_ids: productIds }),
  });
}

// Search history API functions
export async function getSearchHistory(
    limit: number = 20, 
    offset: number = 0, 
    includeDetails: boolean = false
): Promise<SearchHistoryResponse> {
    const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        include_details: String(includeDetails),
    });

    return apiRequest<SearchHistoryResponse>(`/api/history?${params.toString()}`);
}

export async function deleteSearchHistory(historyId: string): Promise<SearchHistoryDeleteResponse> {
  return apiRequest<SearchHistoryDeleteResponse>(`/api/history/${historyId}`, { method: 'DELETE' });
}

export async function getSearchSessionDetails(sessionId: string): Promise<{ success: boolean; session?: SearchSessionDetails; error?: string }> {
    return apiRequest<{ success: boolean; session?: SearchSessionDetails; error?: string }>(`/api/history/${sessionId}`);
}

// Collections API functions
export async function getCollections(): Promise<CollectionsResponse> {
  return apiRequest<CollectionsResponse>('/api/collections');
}

export async function getCollectionItems(collectionId: string, limit: number, offset: number): Promise<CollectionItemsResponse> {
    const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
    });
    return apiRequest<CollectionItemsResponse>(`/api/collections/${collectionId}/items?${params.toString()}`);
}


export async function createCollection(data: CollectionCreateRequest): Promise<CollectionResponse> {
    return apiRequest<CollectionResponse>('/api/collections', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateCollection(collectionId: string, data: CollectionUpdateRequest): Promise<CollectionResponse> {
    return apiRequest<CollectionResponse>(`/api/collections/${collectionId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteCollection(collectionId: string): Promise<ApiResponse> {
    return apiRequest<ApiResponse>(`/api/collections/${collectionId}`, {
        method: 'DELETE',
    });
}

export async function addItemToCollection(collectionId: string, data: AddItemToCollectionRequest): Promise<ApiResponse> {
    return apiRequest<ApiResponse>(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function removeItemFromCollection(collectionId: string, savedItemId: string): Promise<ApiResponse> {
    return apiRequest<ApiResponse>(`/api/collections/${collectionId}/items/${savedItemId}`, {
        method: 'DELETE',
    });
}