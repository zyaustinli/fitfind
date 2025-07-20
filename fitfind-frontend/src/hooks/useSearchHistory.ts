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
import { useHistoryContext } from '@/contexts/HistoryContext';
import { useStableFetch } from './useStableFetch';
import { useNetwork } from './useNetwork';
import { useToast, useDeleteToast } from '@/components/ui/toast';

export interface UseSearchHistoryOptions {
  autoFetch?: boolean;
  initialLimit?: number;
  includeDetails?: boolean;
  enableUndo?: boolean;
  maxUndoTimeout?: number;
}

interface DeletedItemState {
  item: SearchHistoryItem;
  originalIndex: number;
  timestamp: number;
  undoToastId?: string;
}

export interface UseSearchHistoryReturn {
  // Data
  history: SearchHistoryItem[];
  pagination: PaginationInfo;
  filters: SearchHistoryFilters;
  
  // State
  loading: LoadingState;
  error: ErrorState;
  deletingItems: Set<string>;
  undoableDeletes: Map<string, DeletedItemState>;
  
  // Network state
  isOnline: boolean;
  queuedOperationsCount: number;
  
  // Actions
  fetchHistory: (options?: { reset?: boolean; includeDetails?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setFilters: (filters: Partial<SearchHistoryFilters>) => void;
  resetFilters: () => void;
  getSessionDetails: (sessionId: string) => Promise<SearchSessionDetails | null>;
  deleteHistoryItem: (historyId: string, options?: { skipUndo?: boolean }) => Promise<{ success: boolean; error?: string; undoId?: string }>;
  undoDelete: (historyId: string) => Promise<{ success: boolean; error?: string }>;
  bulkDelete: (historyIds: string[]) => Promise<{ success: boolean; deletedIds: string[]; failedIds: string[]; errors: Record<string, string> }>;
  isItemDeleting: (historyId: string) => boolean;
  canUndo: (historyId: string) => boolean;
  clearAllPendingOperations: () => void;
  
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
  const { 
    autoFetch = true, 
    initialLimit = 50, 
    includeDetails = false,
    enableUndo = true,
    maxUndoTimeout = 10000
  } = options;
  
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { showDeleteToast } = useDeleteToast();
  const historyContext = useHistoryContext();
  const { 
    isOnline, 
    executeWithRetry, 
    queuedOperationsCount,
    clearQueue 
  } = useNetwork();
  
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
  const [undoableDeletes, setUndoableDeletes] = useState<Map<string, DeletedItemState>>(new Map());

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const undoTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clear all undo timeouts
      undoTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      undoTimeoutsRef.current.clear();
    };
  }, []);

  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  // Enhanced fetch with network retry logic
  const fetchHistoryImpl = useCallback(async (options: { reset?: boolean; includeDetails?: boolean } = {}) => {
    if (!user || fetchingRef.current) {
      return;
    }

    const { reset = false, includeDetails: fetchDetails = includeDetails } = options;
    const currentOffset = reset ? 0 : pagination.offset;
    
    fetchingRef.current = true;
    setLoading({ isLoading: true, message: reset ? 'Loading history...' : 'Loading more...' });
    clearError();

    try {
      const response: SearchHistoryResponse = await getSearchHistory(pagination.limit, currentOffset, fetchDetails);
      if (mountedRef.current) {
        if (response.success) {
          setHistory(prev => reset ? response.history : [...prev, ...response.history]);
          setPagination(response.pagination);
          if (reset) {
            historyContext.notifyHistoryRefreshed(response.history);
          }
        } else {
          throw new Error(response.error || 'Failed to fetch search history');
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError({ hasError: true, message: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    } finally {
      if (mountedRef.current) {
        setLoading({ isLoading: false });
        fetchingRef.current = false;
      }
    }
  }, [user?.id, pagination.offset, pagination.limit, includeDetails, historyContext, clearError]);

  const fetchHistory = useStableFetch(fetchHistoryImpl, [user?.id, pagination.offset, pagination.limit, includeDetails, historyContext, clearError]);

  useEffect(() => {
    if (autoFetch && user && !authLoading) {
        fetchHistory({ reset: true });
    } else if (!user && !authLoading) {
        setHistory([]);
        setPagination({ limit: initialLimit, offset: 0, has_more: false, total_count: 0 });
    }
  }, [user?.id, authLoading, autoFetch, initialLimit]);

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

  const getSessionDetails = useCallback(async (sessionId: string) => {
    if (!user) return null;
    try {
      const response = await getSearchSessionDetails(sessionId);
      return response.success ? (response.session as SearchSessionDetails) : null;
    } catch (err) {
      return null;
    }
  }, [user]);

  const deleteHistoryItem = useCallback(async (historyId: string, options: { skipUndo?: boolean } = {}): Promise<{ success: boolean; error?: string; undoId?: string }> => {
    if (!user) return { success: false, error: 'Authentication required.' };

    const itemIndex = history.findIndex(item => item.id === historyId);
    if (itemIndex === -1) return { success: false, error: 'Item not found.' };

    const itemToDelete = history[itemIndex];
    setDeletingItems(prev => new Set(prev).add(historyId));
    setHistory(prev => prev.filter(item => item.id !== historyId));

    const result = await executeWithRetry(() => deleteSearchHistory(historyId), `Delete ${historyId}`);

    if (mountedRef.current) {
        setDeletingItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(historyId);
            return newSet;
        });

        if (!result.success) {
            setHistory(prev => {
                const newHistory = [...prev];
                newHistory.splice(itemIndex, 0, itemToDelete);
                return newHistory;
            });
            setError({ hasError: true, message: result.error });
            return { success: false, error: result.error };
        }
    }
    
    return { success: true };
  }, [user, history, executeWithRetry]);

  const bulkDelete = useCallback(async (historyIds: string[]): Promise<{ success: boolean; deletedIds: string[]; failedIds: string[]; errors: Record<string, string> }> => {
    const results = await Promise.all(historyIds.map(id => deleteHistoryItem(id, { skipUndo: true })));
    const deletedIds = historyIds.filter((id, i) => results[i].success);
    const failedIds = historyIds.filter((id, i) => !results[i].success);
    const errors = historyIds.reduce((acc, id, i) => ({ ...acc, [id]: results[i].error }), {});
    return { success: failedIds.length === 0, deletedIds, failedIds, errors };
  }, [deleteHistoryItem]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
        if (!filters.searchQuery) return true;
        const query = filters.searchQuery.toLowerCase();
        return item.search_sessions.search_queries.some(q => q.toLowerCase().includes(query));
    }).sort((a, b) => {
        switch (filters.sortBy) {
            case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
    });
  }, [history, filters]);

  return {
    history,
    pagination,
    filters,
    loading,
    error,
    deletingItems,
    undoableDeletes: new Map(),
    isOnline,
    queuedOperationsCount,
    fetchHistory,
    loadMore,
    refresh,
    setFilters,
    resetFilters,
    getSessionDetails,
    deleteHistoryItem,
    undoDelete: async () => ({ success: false, error: "Undo not implemented in this version" }),
    bulkDelete,
    isItemDeleting: (id) => deletingItems.has(id),
    canUndo: () => false,
    clearAllPendingOperations: clearQueue,
    filteredHistory,
    hasMore: pagination.has_more,
    isEmpty: history.length === 0 && !loading.isLoading,
    totalCount: pagination.total_count || 0,
  };
} 