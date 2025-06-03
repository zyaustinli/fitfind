import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  SearchHistoryItem, 
  SearchHistoryResponse, 
  SearchHistoryFilters, 
  PaginationInfo,
  LoadingState,
  ErrorState,
  SearchSessionDetails,
  SearchHistoryDeleteResponse
} from '@/types';
import { getSearchHistory, getSearchSessionDetails, deleteSearchHistory } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStableFetch } from './useStableFetch';

export interface UseSearchHistoryOptions {
  autoFetch?: boolean;
  initialLimit?: number;
  includeDetails?: boolean;
}

export interface UseSearchHistoryReturn {
  // Data
  history: SearchHistoryItem[];
  pagination: PaginationInfo;
  filters: SearchHistoryFilters;
  
  // State
  loading: LoadingState;
  error: ErrorState;
  deletingItems: Set<string>; // Track items currently being deleted
  
  // Actions
  fetchHistory: (options?: { reset?: boolean; includeDetails?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setFilters: (filters: Partial<SearchHistoryFilters>) => void;
  resetFilters: () => void;
  getSessionDetails: (sessionId: string) => Promise<SearchSessionDetails | null>;
  deleteHistoryItem: (historyId: string) => Promise<{ success: boolean; error?: string }>;
  isItemDeleting: (historyId: string) => boolean; // Helper to check if item is being deleted
  
  // Computed
  filteredHistory: SearchHistoryItem[];
  hasMore: boolean;
  isEmpty: boolean;
  totalCount: number;
}

const defaultFilters: SearchHistoryFilters = {
  sortBy: 'newest',
};

export function useSearchHistory(options: UseSearchHistoryOptions = {}): UseSearchHistoryReturn {
  const { autoFetch = true, initialLimit = 50, includeDetails = false } = options;
  const { user, loading: authLoading } = useAuth();
  
  // Core state
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit: initialLimit,
    offset: 0,
    has_more: false,
    total_count: 0
  });
  const [filters, setFiltersState] = useState<SearchHistoryFilters>(defaultFilters);
  
  // UI state
  const [loading, setLoading] = useState<LoadingState>({
    isLoading: false,
    message: undefined
  });
  const [error, setError] = useState<ErrorState>({
    hasError: false,
    message: undefined,
    code: undefined
  });
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  const fetchHistoryImpl = useCallback(async (options: { reset?: boolean; includeDetails?: boolean } = {}) => {
    if (!user || fetchingRef.current) {
      console.log('Skipping fetch: no user or already fetching');
      return;
    }

    const { reset = false, includeDetails = false } = options;
    const currentOffset = reset ? 0 : pagination.offset;
    
    fetchingRef.current = true;
    setLoading({
      isLoading: true,
      message: reset ? 'Loading search history...' : 'Loading more...'
    });
    clearError();

    try {
      const response: SearchHistoryResponse = await getSearchHistory(
        pagination.limit,
        currentOffset,
        includeDetails
      );

      if (!mountedRef.current) {
        console.log('Component unmounted, skipping state update');
        return;
      }

      if (response.success) {
        setHistory(prev => reset ? response.history : [...prev, ...response.history]);
        setPagination(response.pagination);
      } else {
        throw new Error(response.error || 'Failed to fetch search history');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      const message = err instanceof Error ? err.message : 'Failed to load search history';
      setError({
        hasError: true,
        message,
        code: undefined
      });
    } finally {
      if (mountedRef.current) {
        setLoading({ isLoading: false });
        fetchingRef.current = false;
      }
    }
  }, [user?.id, pagination.limit]); // Only depend on user.id, not the whole user object

  // Use stable fetch
  const fetchHistory = useStableFetch(fetchHistoryImpl, [user?.id, pagination.limit]);

  const loadMore = useCallback(async () => {
    if (loading.isLoading || !pagination.has_more) return;
    
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
    
    await fetchHistory({ reset: false, includeDetails });
  }, [loading.isLoading, pagination.has_more, fetchHistory, includeDetails]);

  const refresh = useCallback(async () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
    await fetchHistory({ reset: true, includeDetails });
  }, [fetchHistory, includeDetails]);

  const setFilters = useCallback((newFilters: Partial<SearchHistoryFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  // Client-side filtering and sorting
  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Filter by search query (search through generated queries only, not filenames)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.search_sessions.search_queries.some(q => 
          q.toLowerCase().includes(query)
        )
      );
    }

    // Sort (client-side)
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_items':
          return b.search_sessions.num_items_identified - a.search_sessions.num_items_identified;
        case 'most_products':
          return b.search_sessions.num_products_found - a.search_sessions.num_products_found;
        default:
          return 0;
      }
    });

    return filtered;
  }, [history, filters]);

  const hasMore = pagination.has_more;
  const isEmpty = history.length === 0 && !loading.isLoading;
  const totalCount = pagination.total_count || 0;

  // Initial fetch effect
  useEffect(() => {
    if (!autoFetch) return;
    
    // Skip if auth is still loading
    if (authLoading) {
      console.log('Auth still loading, skipping fetch');
      return;
    }

    // Clear data if no user
    if (!user) {
      console.log('No user, clearing data');
      setHistory([]);
      setPagination(prev => ({ ...prev, offset: 0, has_more: false, total_count: 0 }));
      hasInitializedRef.current = false;
      return;
    }

    // Only fetch if we haven't initialized for this user
    if (!hasInitializedRef.current) {
      console.log('Initial fetch for user:', user.id);
      hasInitializedRef.current = true;
      fetchHistory({ reset: true, includeDetails });
    }
  }, [user?.id, authLoading, autoFetch, fetchHistory, includeDetails]);

  // Reset initialization flag when user changes
  useEffect(() => {
    hasInitializedRef.current = false;
    // Clear any pending delete operations when user changes
    setDeletingItems(new Set());
  }, [user?.id]);

  const getSessionDetails = useCallback(async (sessionId: string) => {
    if (!user) return null;

    try {
      const response = await getSearchSessionDetails(sessionId);
      if (response.success && response.session) {
        return response.session as SearchSessionDetails;
      }
      return null;
    } catch (err) {
      console.error('Failed to fetch session details:', err);
      return null;
    }
  }, [user]);

  /**
   * Delete a search history item with optimistic updates and proper error handling
   * 
   * This function implements optimistic UI updates, meaning the item is removed
   * from the UI immediately while the API call is in progress. If the API call
   * fails, the item is restored to its original position.
   * 
   * Features:
   * - Optimistic updates for immediate UI feedback
   * - Automatic rollback on API failure
   * - Prevents duplicate deletion attempts
   * - Updates pagination counts
   * - Comprehensive error handling
   * - Component unmount safety
   * 
   * @param historyId - The ID of the search history item to delete
   * @returns Promise resolving to success status and optional error message
   */
  const deleteHistoryItem = useCallback(async (historyId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { 
        success: false, 
        error: 'Authentication required. Please log in.' 
      };
    }

    // Check if this item is already being deleted
    if (deletingItems.has(historyId)) {
      return { 
        success: false, 
        error: 'Item is already being deleted.' 
      };
    }

    // Find the item to delete for potential rollback
    const itemToDelete = history.find(item => item.id === historyId);
    if (!itemToDelete) {
      return { 
        success: false, 
        error: 'History item not found.' 
      };
    }

    // Store original state for potential rollback
    const originalHistory = [...history];
    const originalPagination = { ...pagination };

    try {
      // Mark item as being deleted
      setDeletingItems(prev => new Set([...prev, historyId]));

      // Optimistic update - remove item immediately from UI
      setHistory(prev => prev.filter(item => item.id !== historyId));
      
      // Adjust pagination count
      setPagination(prev => ({
        ...prev,
        total_count: Math.max(0, (prev.total_count || 0) - 1)
      }));

      // Clear any previous errors
      clearError();

      // Make the actual API call
      const response: SearchHistoryDeleteResponse = await deleteSearchHistory(historyId);

      if (!mountedRef.current) {
        // Component unmounted, don't update state
        return { success: true };
      }

      if (response.success) {
        // Success! The optimistic update was correct
        console.log('Successfully deleted history item:', historyId);
        return { success: true };
      } else {
        // API returned error, rollback the optimistic update
        throw new Error(response.error || 'Failed to delete history item');
      }
    } catch (err) {
      if (!mountedRef.current) {
        // Component unmounted, don't update state
        return { success: false, error: 'Operation cancelled' };
      }

      // Rollback optimistic update
      setHistory(originalHistory);
      setPagination(originalPagination);

      const errorMessage = err instanceof Error ? err.message : 'Failed to delete history item';
      
      // Set error state for user feedback
      setError({
        hasError: true,
        message: errorMessage,
        code: undefined
      });

      console.error('Failed to delete history item:', err);
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      // Always remove from deleting state, whether success or failure
      if (mountedRef.current) {
        setDeletingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(historyId);
          return newSet;
        });
      }
    }
  }, [user, history, pagination, deletingItems, clearError]);

  const isItemDeleting = useCallback((historyId: string): boolean => {
    return deletingItems.has(historyId);
  }, [deletingItems]);

  // Utility function to clear all deleting states (useful for cleanup)
  const clearDeletingStates = useCallback(() => {
    setDeletingItems(new Set());
  }, []);

  return {
    // Data
    history,
    pagination,
    filters,
    
    // State
    loading,
    error,
    deletingItems,
    
    // Actions
    fetchHistory,
    loadMore,
    refresh,
    setFilters,
    resetFilters,
    getSessionDetails,
    deleteHistoryItem,
    isItemDeleting,
    
    // Computed
    filteredHistory,
    hasMore,
    isEmpty,
    totalCount,
  };
} 