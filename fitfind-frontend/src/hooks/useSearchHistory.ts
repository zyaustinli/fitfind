import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  SearchHistoryItem, 
  SearchHistoryResponse, 
  SearchHistoryFilters, 
  PaginationInfo,
  LoadingState,
  ErrorState 
} from '@/types';
import { getSearchHistory } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface UseSearchHistoryOptions {
  autoFetch?: boolean;
  initialLimit?: number;
}

export interface UseSearchHistoryReturn {
  // Data
  history: SearchHistoryItem[];
  pagination: PaginationInfo;
  filters: SearchHistoryFilters;
  
  // State
  loading: LoadingState;
  error: ErrorState;
  
  // Actions
  fetchHistory: (options?: { reset?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setFilters: (filters: Partial<SearchHistoryFilters>) => void;
  resetFilters: () => void;
  
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
  const { autoFetch = true, initialLimit = 50 } = options;
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

  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  const fetchHistory = useCallback(async (options: { reset?: boolean } = {}) => {
    if (!user) {
      setHistory([]);
      return;
    }

    const { reset = false } = options;
    const currentOffset = reset ? 0 : pagination.offset;
    
    setLoading({
      isLoading: true,
      message: reset ? 'Loading search history...' : 'Loading more...'
    });
    clearError();

    try {
      const response: SearchHistoryResponse = await getSearchHistory(
        pagination.limit,
        currentOffset
      );

      if (response.success) {
        setHistory(prev => reset ? response.history : [...prev, ...response.history]);
        setPagination(response.pagination);
      } else {
        throw new Error(response.error || 'Failed to fetch search history');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load search history';
      setError({
        hasError: true,
        message,
        code: undefined
      });
    } finally {
      setLoading({ isLoading: false });
    }
  }, [user, pagination.limit, pagination.offset, clearError]);

  const loadMore = useCallback(async () => {
    if (loading.isLoading || !pagination.has_more) return;
    
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
    
    await fetchHistory({ reset: false });
  }, [loading.isLoading, pagination.has_more, fetchHistory]);

  const refresh = useCallback(async () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
    await fetchHistory({ reset: true });
  }, [fetchHistory]);

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

  // Auto-fetch on mount and when user changes
  useEffect(() => {
    if (autoFetch && user && !authLoading) {
      fetchHistory({ reset: true });
    } else if (!user) {
      setHistory([]);
      setPagination(prev => ({ ...prev, offset: 0, has_more: false, total_count: 0 }));
    }
  }, [user, authLoading, autoFetch]);

  return {
    // Data
    history,
    pagination,
    filters,
    
    // State
    loading,
    error,
    
    // Actions
    fetchHistory,
    loadMore,
    refresh,
    setFilters,
    resetFilters,
    
    // Computed
    filteredHistory,
    hasMore,
    isEmpty,
    totalCount,
  };
} 