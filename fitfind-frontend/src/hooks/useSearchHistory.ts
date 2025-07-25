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
  
  // Centralized loading state machine
  const [loadingState, setLoadingState] = useState<{
    type: 'idle' | 'fetching' | 'loading_more' | 'refreshing' | 'deleting' | 'bulk_deleting';
    message?: string;
    progress?: { current: number; total: number };
  }>({ type: 'idle' });
  
  // Legacy loading state for backwards compatibility
  const loading: LoadingState = {
    isLoading: loadingState.type !== 'idle',
    message: loadingState.message
  };
  
  // UI state
  const [error, setError] = useState<ErrorState>({
    hasError: false,
    message: undefined,
    code: undefined
  });
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [undoableDeletes, setUndoableDeletes] = useState<Map<string, DeletedItemState>>(new Map());
  
  // Refs for tracking without causing re-renders
  const lastUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const undoTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const authChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimeRef = useRef<number>(Date.now());

  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  // Enhanced error recovery mechanism
  const handleErrorWithRecovery = useCallback((error: any, operation: string) => {
    console.error(`🔴 useSearchHistory error in ${operation}:`, error);
    
    // Determine if this is a recoverable error
    const isNetworkError = error.message?.includes('fetch') || 
                          error.message?.includes('network') ||
                          error.name === 'TypeError';
    
    const isAuthError = error.status === 401 || 
                       error.status === 403 ||
                       error.message?.includes('Authentication');
    
    const isServerError = error.status >= 500;
    
    let errorMessage = error.message || 'An unexpected error occurred';
    let recoveryActions: string[] = [];
    
    if (isNetworkError) {
      errorMessage = 'Network connection issue. Please check your internet connection.';
      recoveryActions = ['retry', 'refresh'];
    } else if (isAuthError) {
      errorMessage = 'Authentication expired. Please sign in again.';
      recoveryActions = ['reauth'];
    } else if (isServerError) {
      errorMessage = 'Server temporarily unavailable. Please try again in a moment.';
      recoveryActions = ['retry', 'refresh'];
    }
    
    setError({
      hasError: true,
      message: errorMessage,
      code: error.status?.toString(),
      recoveryActions
    });
    
    return { isRecoverable: recoveryActions.length > 0, recoveryActions };
  }, []);

  // Fetch history implementation
  const fetchHistory = useCallback(async (options: { reset?: boolean; includeDetails?: boolean; offset?: number } = {}) => {
    if (!user) {
      return;
    }

    // Cancel any ongoing fetch operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check if already fetching - but allow for fresh navigation
    if (isFetchingRef.current) {
      const timeSinceMount = Date.now() - mountTimeRef.current;
      const isRecentNavigation = timeSinceMount < 2000; // 2 seconds
      
      if (isRecentNavigation) {
        console.log('🔄 Recent navigation detected, resetting fetch flag for legitimate request');
        isFetchingRef.current = false;
      } else {
        console.log('🔄 Fetch already in progress, skipping duplicate request');
        return;
      }
    }

    const { reset = false, includeDetails: fetchDetails = includeDetails, offset } = options;
    const currentOffset = offset !== undefined ? offset : (reset ? 0 : pagination.offset);
    
    // Create new abort controller for this fetch
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    isFetchingRef.current = true;
    
    setLoadingState({
      type: reset ? 'fetching' : 'loading_more',
      message: reset ? 'Loading search history...' : 'Loading more...'
    });
    clearError();

    const result = await executeWithRetry(
      async () => {
        // Check if component is still mounted and operation not aborted
        if (!mountedRef.current || signal.aborted) {
          throw new Error('Operation cancelled');
        }

        const response: SearchHistoryResponse = await getSearchHistory(
          pagination.limit,
          currentOffset,
          fetchDetails,
          { signal } // Pass abort signal to API call
        );

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch search history');
        }

        return response;
      },
      'Fetch search history',
      {
        maxRetries: 3,
        queueWhenOffline: false,
        signal // Pass signal to retry logic
      }
    );

    // Double-check component is still mounted and operation not aborted
    if (!mountedRef.current || signal.aborted) {
      isFetchingRef.current = false;
      return;
    }

    if (result.success && result.data) {
      const response = result.data;
      
      // Only update state if we're still mounted and not aborted
      if (mountedRef.current && !signal.aborted) {
        setHistory(prev => reset ? response.history : [...prev, ...response.history]);
        setPagination(response.pagination);
        
        // Notify global context
        if (reset) {
          historyContext.notifyHistoryRefreshed(response.history);
        }
      }
    } else if (result.error && !result.queued && !signal.aborted) {
      if (mountedRef.current) {
        handleErrorWithRecovery(
          { message: result.error },
          'fetchHistory'
        );
      }
    }
    
    isFetchingRef.current = false;
    if (mountedRef.current && !signal.aborted) {
      setLoadingState({ type: 'idle' });
    }
  }, [user?.id, pagination.limit, includeDetails, executeWithRetry, historyContext, clearError, handleErrorWithRecovery]);

  // Main effect for auth state changes and fetching
  useEffect(() => {
    // Clear any pending auth change timeout
    if (authChangeTimeoutRef.current) {
      clearTimeout(authChangeTimeoutRef.current);
      authChangeTimeoutRef.current = null;
    }

    if (authLoading) {
      return;
    }

    if (!user) {
      // Cancel any ongoing requests when user logs out
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset all state
      setHistory([]);
      setPagination(prev => ({ ...prev, offset: 0, has_more: false, total_count: 0 }));
      setError({ hasError: false });
      setLoading({ isLoading: false });
      isFetchingRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    const currentUserId = user.id;
    if (currentUserId !== lastUserIdRef.current) {
      console.log('🔄 User ID changed, resetting history state', { 
        oldUser: lastUserIdRef.current, 
        newUser: currentUserId 
      });
      
      // Cancel any ongoing requests when user changes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      lastUserIdRef.current = currentUserId;
      setHistory([]);
      setError({ hasError: false });
      isFetchingRef.current = false;
      
      // Debounce the fetch to prevent rapid consecutive calls
      if (autoFetch) {
        authChangeTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && lastUserIdRef.current === currentUserId) {
            fetchHistory({ reset: true });
          }
        }, 100);
      }
    } else if (autoFetch && history.length === 0 && !loading.isLoading && !isFetchingRef.current) {
      // Only fetch if no request is already in progress
      fetchHistory({ reset: true });
    }
  }, [authLoading, user?.id, autoFetch, fetchHistory, history.length, loading.isLoading]);

  // Mount/unmount tracking and comprehensive cleanup
  useEffect(() => {
    mountedRef.current = true;
    mountTimeRef.current = Date.now(); // Track mount time for navigation detection
    
    return () => {
      console.log('🧹 useSearchHistory cleanup: Component unmounting');
      mountedRef.current = false;
      
      // Clear all undo timeouts
      undoTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      undoTimeoutsRef.current.clear();
      
      // Clear auth change timeout
      if (authChangeTimeoutRef.current) {
        clearTimeout(authChangeTimeoutRef.current);
        authChangeTimeoutRef.current = null;
      }
      
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset fetch flag immediately to prevent navigation issues
      isFetchingRef.current = false;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (loading.isLoading || !pagination.has_more || isFetchingRef.current) {
      console.log('🔄 LoadMore skipped: loading or no more data or fetch in progress');
      return;
    }
    
    // Calculate the correct offset based on current data
    // This helps recover from pagination state corruption
    const currentItemCount = history.length;
    const calculatedOffset = Math.max(currentItemCount, pagination.offset);
    
    // Use the calculated offset to ensure we don't have gaps
    const newOffset = calculatedOffset;
    
    console.log('📅 LoadMore: offset calculation', {
      currentHistoryLength: currentItemCount,
      paginationOffset: pagination.offset,
      calculatedOffset,
      newOffset
    });
    
    setPagination(prev => ({
      ...prev,
      offset: newOffset
    }));
    
    await fetchHistory({ reset: false, offset: newOffset });
  }, [loading.isLoading, pagination.has_more, pagination.offset, pagination.limit, fetchHistory, history.length]);

  const refresh = useCallback(async () => {
    // Cancel any ongoing requests before refresh
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Reset pagination and fetch
    setPagination(prev => ({ ...prev, offset: 0 }));
    isFetchingRef.current = false; // Reset fetch flag
    await fetchHistory({ reset: true });
  }, [fetchHistory]);

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
      const currentItemsShown = history.length; // Use current history length after deletions
      
      // Calculate if we still have more items available
      // If total items is now less than or equal to what we have, no more to load
      const actuallyHasMore = newTotalCount > currentItemsShown;
      
      // If we deleted items and now have fewer than expected for this page,
      // we might need to adjust the offset or trigger a reload
      const expectedItemsForPage = Math.min(prev.limit, newTotalCount - prev.offset);
      const needsAdjustment = currentItemsShown < expectedItemsForPage && actuallyHasMore;
      
      console.log('📅 Pagination adjustment:', {
        deletedCount,
        newTotalCount,
        currentItemsShown,
        expectedItemsForPage,
        needsAdjustment,
        actuallyHasMore
      });
      
      return {
        ...prev,
        total_count: newTotalCount,
        has_more: actuallyHasMore,
        // Reset offset if we've deleted too many items and pagination is broken
        ...(needsAdjustment && currentItemsShown === 0 ? { offset: 0 } : {})
      };
    });
  }, [history.length]);

  // Delete history item with undo functionality
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
          undoTimeoutsRef.current.delete(historyId);
        }, maxUndoTimeout);
        
        undoTimeoutsRef.current.set(historyId, undoTimeout);
      }

      // Make the actual API call with retry logic
      const result = await executeWithRetry(
        async () => {
          // Check if component is still mounted
          if (!mountedRef.current) {
            throw new Error('Component unmounted');
          }
          
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

      if (result.success) {
        // Success! Notify global context
        historyContext.notifyItemDeleted(historyId, itemToDelete);
        console.log('Successfully deleted history item:', historyId);
        
        // Check if pagination needs adjustment after successful deletion
        // If we're on the last page and have few items, might need to reload
        if (pagination.has_more === false && history.length <= 3) {
          console.log('🔄 Low item count after deletion, considering refresh');
          // Could trigger a refresh here if needed
        }
        
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
      
      handleErrorWithRecovery(
        err instanceof Error ? err : { message: errorMessage },
        'deleteHistoryItem'
      );

      console.error('Failed to delete history item:', err);
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      // Always remove from deleting state
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(historyId);
        return newSet;
      });
      historyContext.removeDeletingItem(historyId);
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

      // Only update state if component is still mounted
      if (!mountedRef.current) {
        console.log('🖾 Undo cancelled: component unmounted');
        return { success: false, error: 'Operation cancelled' };
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

    // Update loading state with progress
    setLoadingState({
      type: 'bulk_deleting',
      message: `Deleting ${historyIds.length} items...`,
      progress: { current: 0, total: historyIds.length }
    });

    const deletedIds: string[] = [];
    const failedIds: string[] = [];
    const errors: Record<string, string> = {};

    // Process deletions in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < historyIds.length; i += batchSize) {
      // Check if component is still mounted before processing each batch
      if (!mountedRef.current) {
        console.log('🖾 Bulk delete cancelled: component unmounted');
        break;
      }
      
      const batch = historyIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (historyId) => {
        // Double-check mounted state for each operation
        if (!mountedRef.current) {
          failedIds.push(historyId);
          errors[historyId] = 'Operation cancelled';
          return;
        }
        
        const result = await deleteHistoryItem(historyId, { skipUndo: true });
        if (result.success) {
          deletedIds.push(historyId);
        } else {
          failedIds.push(historyId);
          errors[historyId] = result.error || 'Unknown error';
        }
      });

      await Promise.all(batchPromises);
      
      // Update progress
      const processed = Math.min(i + batchSize, historyIds.length);
      if (mountedRef.current) {
        setLoadingState({
          type: 'bulk_deleting',
          message: `Deleting items... (${processed}/${historyIds.length})`,
          progress: { current: processed, total: historyIds.length }
        });
      }
      
      // Small delay between batches (only if still mounted)
      if (i + batchSize < historyIds.length && mountedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    historyContext.notifyBulkDeleteCompleted(deletedIds, failedIds);

    const success = failedIds.length === 0;
    
    // After bulk deletion, check if we need to reload data to maintain proper pagination
    if (deletedIds.length > 0) {
      const remainingItems = history.length - deletedIds.length;
      const shouldRefresh = remainingItems < 5 && pagination.has_more;
      
      if (shouldRefresh) {
        console.log('🔄 Bulk delete: Too few items remaining, refreshing data');
        // Trigger a refresh to load more items
        setTimeout(() => {
          if (mountedRef.current) {
            refresh();
          }
        }, 500);
      }
    }
    
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

    // Reset loading state
    if (mountedRef.current) {
      setLoadingState({ type: 'idle' });
    }
    
    return { success, deletedIds, failedIds, errors };
  }, [user, deleteHistoryItem, historyContext, toast]);

  const getSessionDetails = useCallback(async (sessionId: string) => {
    if (!user || !mountedRef.current) return null;

    try {
      const response = await getSearchSessionDetails(sessionId);
      
      // Check if still mounted after async operation
      if (!mountedRef.current) {
        console.log('🖾 Session details fetch cancelled: component unmounted');
        return null;
      }
      
      if (response.success && response.session) {
        return response.session as SearchSessionDetails;
      }
      return null;
    } catch (err) {
      if (mountedRef.current) {
        console.error('Failed to fetch session details:', err);
      }
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
  const isEmpty = !!user && !loading.isLoading && !error.hasError && history.length === 0;
  const totalCount = pagination.total_count || 0;

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