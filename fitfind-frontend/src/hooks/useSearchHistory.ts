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
  const hasInitializedRef = useRef(false);
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

    const result = await executeWithRetry(
      async () => {
        const response: SearchHistoryResponse = await getSearchHistory(
          pagination.limit,
          currentOffset,
          includeDetails
        );

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch search history');
        }

        return response;
      },
      'Fetch search history',
      {
        maxRetries: 3,
        queueWhenOffline: false // Don't queue fetch operations
      }
    );

    if (!mountedRef.current) {
      console.log('Component unmounted, skipping state update');
      return;
    }

    if (result.success && result.data) {
      const response = result.data;
      setHistory(prev => reset ? response.history : [...prev, ...response.history]);
      setPagination(response.pagination);
      
      // Notify global context
      if (reset) {
        historyContext.notifyHistoryRefreshed(response.history);
      }
    } else if (result.error && !result.queued) {
      setError({
        hasError: true,
        message: result.error,
        code: undefined
      });
    }

    if (mountedRef.current) {
      setLoading({ isLoading: false });
      fetchingRef.current = false;
    }
  }, [user?.id, pagination.limit, pagination.offset, executeWithRetry, historyContext]);

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

  // Smart pagination adjustment after deletions
  const adjustPaginationAfterDeletion = useCallback((deletedCount: number) => {
    setPagination(prev => {
      const newTotalCount = Math.max(0, (prev.total_count || 0) - deletedCount);
      const currentItemsShown = prev.offset + history.length - deletedCount;
      
      // If we have fewer items than we should on current page, try to load more
      const shouldLoadMore = currentItemsShown < prev.limit && prev.has_more;
      
      return {
        ...prev,
        total_count: newTotalCount,
        // Trigger load more if needed
        has_more: shouldLoadMore ? true : prev.has_more
      };
    });
  }, [history.length]);

  // Enhanced delete with undo functionality and network awareness
  const deleteHistoryItem = useCallback(async (
    historyId: string, 
    options: { skipUndo?: boolean } = {}
  ): Promise<{ success: boolean; error?: string; undoId?: string }> => {
    if (!user) {
      return { 
        success: false, 
        error: 'Authentication required. Please log in.' 
      };
    }

    const { skipUndo = false } = options;

    // Check if this item is already being deleted
    if (deletingItems.has(historyId)) {
      return { 
        success: false, 
        error: 'Item is already being deleted.' 
      };
    }

    // Find the item to delete
    const itemIndex = history.findIndex(item => item.id === historyId);
    if (itemIndex === -1) {
      return { 
        success: false, 
        error: 'History item not found.' 
      };
    }

    const itemToDelete = history[itemIndex];
    
    // Store for potential undo
    const deleteState: DeletedItemState = {
      item: itemToDelete,
      originalIndex: itemIndex,
      timestamp: Date.now()
    };

    try {
      // Mark item as being deleted
      setDeletingItems(prev => new Set([...prev, historyId]));
      historyContext.addDeletingItem(historyId);

      // Optimistic update - remove item immediately from UI
      setHistory(prev => prev.filter(item => item.id !== historyId));
      adjustPaginationAfterDeletion(1);
      clearError();

      // Show undo toast if enabled
      let undoToastId: string | undefined;
      if (enableUndo && !skipUndo) {
        undoToastId = showDeleteToast(
          'Search history item',
          () => undoDelete(historyId),
          {
            description: 'Item removed from your history',
            undoTimeout: maxUndoTimeout
          }
        );
        deleteState.undoToastId = undoToastId;
      }

      // Store for undo
      if (enableUndo && !skipUndo) {
        setUndoableDeletes(prev => new Map(prev).set(historyId, deleteState));
        
        // Set timeout to clear undo state
        const undoTimeout = setTimeout(() => {
          setUndoableDeletes(prev => {
            const newMap = new Map(prev);
            newMap.delete(historyId);
            return newMap;
          });
        }, maxUndoTimeout);
        
        undoTimeoutsRef.current.set(historyId, undoTimeout);
      }

      // Make the actual API call with retry logic
      const result = await executeWithRetry(
        async () => {
          const response: SearchHistoryDeleteResponse = await deleteSearchHistory(historyId);
          if (!response.success) {
            throw new Error(response.error || 'Failed to delete history item');
          }
          return response;
        },
        `Delete history item: ${itemToDelete.search_sessions.image_filename}`,
        {
          maxRetries: 3,
          queueWhenOffline: true
        }
      );

      if (!mountedRef.current) {
        return { success: true, undoId: undoToastId };
      }

      if (result.success) {
        // Success! Notify global context
        historyContext.notifyItemDeleted(historyId, itemToDelete);
        console.log('Successfully deleted history item:', historyId);
        return { success: true, undoId: undoToastId };
      } else if (result.queued) {
        // Operation was queued for later
        toast({
          type: "info",
          title: "Delete Queued",
          description: "Delete operation will complete when connection is restored.",
          duration: 5000
        });
        return { success: true, undoId: undoToastId };
      } else {
        // API returned error, rollback the optimistic update
        throw new Error(result.error || 'Failed to delete history item');
      }
    } catch (err) {
      if (!mountedRef.current) {
        return { success: false, error: 'Operation cancelled' };
      }

      // Rollback optimistic update
      setHistory(prev => {
        const newHistory = [...prev];
        newHistory.splice(itemIndex, 0, itemToDelete);
        return newHistory;
      });
      adjustPaginationAfterDeletion(-1); // Add back the count

      // Clear undo state
      setUndoableDeletes(prev => {
        const newMap = new Map(prev);
        newMap.delete(historyId);
        return newMap;
      });

      const errorMessage = err instanceof Error ? err.message : 'Failed to delete history item';
      
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
      // Always remove from deleting state
      if (mountedRef.current) {
        setDeletingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(historyId);
          return newSet;
        });
        historyContext.removeDeletingItem(historyId);
      }
    }
  }, [
    user, 
    history, 
    deletingItems, 
    enableUndo, 
    maxUndoTimeout,
    executeWithRetry, 
    historyContext, 
    showDeleteToast,
    toast,
    adjustPaginationAfterDeletion,
    clearError
  ]);

  // Undo delete functionality
  const undoDelete = useCallback(async (historyId: string): Promise<{ success: boolean; error?: string }> => {
    const deleteState = undoableDeletes.get(historyId);
    if (!deleteState) {
      return { success: false, error: 'Cannot undo: delete state not found' };
    }

    try {
      // Clear undo timeout
      const timeout = undoTimeoutsRef.current.get(historyId);
      if (timeout) {
        clearTimeout(timeout);
        undoTimeoutsRef.current.delete(historyId);
      }

      // Restore item to original position
      setHistory(prev => {
        const newHistory = [...prev];
        newHistory.splice(deleteState.originalIndex, 0, deleteState.item);
        return newHistory;
      });
      
      adjustPaginationAfterDeletion(-1); // Add back the count

      // Clear undo state
      setUndoableDeletes(prev => {
        const newMap = new Map(prev);
        newMap.delete(historyId);
        return newMap;
      });

      // Notify global context
      historyContext.notifyItemRestored(historyId, deleteState.item);

      toast({
        type: "success",
        title: "Item Restored",
        description: "The item has been restored to your history.",
        duration: 3000
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to undo delete:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to undo delete' 
      };
    }
  }, [undoableDeletes, historyContext, toast, adjustPaginationAfterDeletion]);

  // Bulk delete functionality
  const bulkDelete = useCallback(async (historyIds: string[]): Promise<{ 
    success: boolean; 
    deletedIds: string[]; 
    failedIds: string[]; 
    errors: Record<string, string> 
  }> => {
    if (!user || historyIds.length === 0) {
      return { 
        success: false, 
        deletedIds: [], 
        failedIds: historyIds,
        errors: historyIds.reduce((acc, id) => ({ ...acc, [id]: 'Invalid operation' }), {})
      };
    }

    historyContext.notifyBulkDeleteStarted(historyIds);

    const deletedIds: string[] = [];
    const failedIds: string[] = [];
    const errors: Record<string, string> = {};

    // Process deletions in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < historyIds.length; i += batchSize) {
      const batch = historyIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (historyId) => {
        const result = await deleteHistoryItem(historyId, { skipUndo: true });
        if (result.success) {
          deletedIds.push(historyId);
        } else {
          failedIds.push(historyId);
          errors[historyId] = result.error || 'Unknown error';
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < historyIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    historyContext.notifyBulkDeleteCompleted(deletedIds, failedIds);

    const success = failedIds.length === 0;
    
    if (success) {
      toast({
        type: "success",
        title: "Bulk Delete Complete",
        description: `Successfully deleted ${deletedIds.length} items.`,
        duration: 5000
      });
    } else {
      toast({
        type: "warning",
        title: "Bulk Delete Partial",
        description: `Deleted ${deletedIds.length} items. ${failedIds.length} failed.`,
        duration: 8000
      });
    }

    return { success, deletedIds, failedIds, errors };
  }, [user, deleteHistoryItem, historyContext, toast]);

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

  const isItemDeleting = useCallback((historyId: string): boolean => {
    return deletingItems.has(historyId) || historyContext.isDeletingItem(historyId);
  }, [deletingItems, historyContext]);

  const canUndo = useCallback((historyId: string): boolean => {
    return undoableDeletes.has(historyId);
  }, [undoableDeletes]);

  const clearAllPendingOperations = useCallback(() => {
    setDeletingItems(new Set());
    setUndoableDeletes(new Map());
    undoTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    undoTimeoutsRef.current.clear();
    historyContext.clearAllDeletingItems();
    clearQueue();
  }, [historyContext, clearQueue]);

  // Client-side filtering and sorting
  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.search_sessions.search_queries.some(q => 
          q.toLowerCase().includes(query)
        )
      );
    }

    // Sort
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
    
    if (authLoading) {
      console.log('Auth still loading, skipping fetch');
      return;
    }

    if (!user) {
      console.log('No user, clearing data');
      setHistory([]);
      setPagination(prev => ({ ...prev, offset: 0, has_more: false, total_count: 0 }));
      hasInitializedRef.current = false;
      clearAllPendingOperations();
      return;
    }

    if (!hasInitializedRef.current) {
      console.log('Initial fetch for user:', user.id);
      hasInitializedRef.current = true;
      fetchHistory({ reset: true, includeDetails });
    }
  }, [user?.id, authLoading, autoFetch, fetchHistory, includeDetails, clearAllPendingOperations]);

  // Reset initialization flag when user changes
  useEffect(() => {
    hasInitializedRef.current = false;
    clearAllPendingOperations();
  }, [user?.id, clearAllPendingOperations]);

  return {
    // Data
    history,
    pagination,
    filters,
    
    // State
    loading,
    error,
    deletingItems,
    undoableDeletes,
    
    // Network state
    isOnline,
    queuedOperationsCount,
    
    // Actions
    fetchHistory,
    loadMore,
    refresh,
    setFilters,
    resetFilters,
    getSessionDetails,
    deleteHistoryItem,
    undoDelete,
    bulkDelete,
    isItemDeleting,
    canUndo,
    clearAllPendingOperations,
    
    // Computed
    filteredHistory,
    hasMore,
    isEmpty,
    totalCount,
  };
} 