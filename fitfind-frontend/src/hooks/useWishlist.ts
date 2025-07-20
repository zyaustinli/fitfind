import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  WishlistItemDetailed, 
  WishlistResponse, 
  WishlistFilters, 
  WishlistAddResponse,
  WishlistStatusResponse,
  PaginationInfo,
  LoadingState,
  ErrorState 
} from '@/types';
import { 
  getWishlist, 
  addToWishlist, 
  removeFromWishlist, 
  checkWishlistStatus 
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStableFetch } from './useStableFetch';

export interface UseWishlistOptions {
  autoFetch?: boolean;
  initialLimit?: number;
}

export interface UseWishlistReturn {
  // Data
  wishlist: WishlistItemDetailed[];
  pagination: PaginationInfo;
  filters: WishlistFilters;
  wishlistStatus: Record<string, boolean>; // productId -> isInWishlist
  
  // State
  loading: LoadingState;
  error: ErrorState;
  isInitialLoadComplete: boolean;
  initialLoadStatus: 'idle' | 'loading' | 'success' | 'error';
  
  // Actions
  fetchWishlist: (options?: { reset?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  addItem: (productId: string, notes?: string, tags?: string[]) => Promise<boolean>;
  removeItem: (productId: string) => Promise<boolean>;
  updateItem: (wishlistItemId: string, updates: { notes?: string; tags?: string[] }) => Promise<boolean>;
  checkStatus: (productIds: string[]) => Promise<void>;
  setFilters: (filters: Partial<WishlistFilters>) => void;
  resetFilters: () => void;
  setInitialStatus: (status: Record<string, boolean>) => void;
  
  // Computed
  filteredWishlist: WishlistItemDetailed[];
  hasMore: boolean;
  isEmpty: boolean;
  totalCount: number;
  isInWishlist: (productId: string) => boolean;
}

const defaultFilters: WishlistFilters = {
  sortBy: 'newest',
  viewMode: 'grid',
};

export function useWishlist(options: UseWishlistOptions = {}): UseWishlistReturn {
  const { autoFetch = true, initialLimit = 50 } = options;
  const { user, loading: authLoading } = useAuth();
  
  // Core state
  const [wishlist, setWishlist] = useState<WishlistItemDetailed[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit: initialLimit,
    offset: 0,
    has_more: false,
    total_count: 0
  });
  const [filters, setFiltersState] = useState<WishlistFilters>(defaultFilters);
  const [wishlistStatus, setWishlistStatus] = useState<Record<string, boolean>>({});
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [initialLoadStatus, setInitialLoadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
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

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  const fetchWishlistImpl = useCallback(async (options: { reset?: boolean } = {}) => {
    if (!user || fetchingRef.current) return;

    const { reset = false } = options;
    const currentOffset = reset ? 0 : pagination.offset;

    fetchingRef.current = true;
    if(reset) setInitialLoadStatus('loading');
    setLoading({ isLoading: true, message: reset ? 'Loading wishlist...' : 'Loading more...' });
    clearError();

    try {
      const response: WishlistResponse = await getWishlist(pagination.limit, currentOffset);

      if (mountedRef.current) {
        if (response.success) {
          const newItems = response.wishlist;
          setWishlist(prev => reset ? newItems : [...prev, ...newItems]);
          setPagination(response.pagination);
          const statusUpdates: Record<string, boolean> = {};
          newItems.forEach(item => {
            statusUpdates[item.products.id] = true;
          });
          setWishlistStatus(prev => ({ ...prev, ...statusUpdates }));
          if (reset) {
              setIsInitialLoadComplete(true);
              setInitialLoadStatus('success');
          }
        } else {
          throw new Error(response.error || 'Failed to fetch wishlist');
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError({ hasError: true, message: err instanceof Error ? err.message : 'An unexpected error occurred' });
        if(reset) setInitialLoadStatus('error');
      }
    } finally {
      if (mountedRef.current) {
        setLoading({ isLoading: false });
        fetchingRef.current = false;
      }
    }
  }, [user?.id, pagination.offset, pagination.limit, clearError]);

  const fetchWishlist = useStableFetch(fetchWishlistImpl, [user?.id, pagination.offset, pagination.limit, clearError]);
  
  useEffect(() => {
    if (autoFetch && user && !authLoading) {
        fetchWishlist({ reset: true });
    } else if (!user && !authLoading) {
        setWishlist([]);
        setWishlistStatus({});
        setPagination(prev => ({ ...prev, total_count: 0, has_more: false, offset: 0 }));
    }
  }, [user?.id, authLoading, autoFetch]);

  const loadMore = useCallback(async () => {
    if (loading.isLoading || !pagination.has_more) return;
    
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
    
    await fetchWishlist({ reset: false });
  }, [loading.isLoading, pagination.has_more, fetchWishlist]);

  const refresh = useCallback(async () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
    await fetchWishlist({ reset: true });
  }, [fetchWishlist]);

  const addItem = useCallback(async (
    productId: string, 
    notes?: string, 
    tags?: string[]
  ): Promise<boolean> => {
    if (!user) {
      console.log('useWishlist.addItem: No user found');
      return false;
    }

    console.log('useWishlist.addItem: Starting save for productId:', productId);
    // Optimistic update
    setWishlistStatus(prev => ({ ...prev, [productId]: true }));
    
    try {
      console.log('useWishlist.addItem: Calling addToWishlist API');
      const response: WishlistAddResponse = await addToWishlist(productId, notes, tags);
      console.log('useWishlist.addItem: API response:', response);
      
      const wishlistItem = response.item || response.wishlist_item;
      if (response.success && wishlistItem) {
        // Add the new item to the wishlist if it's not already there
        setWishlist(prev => {
          const exists = prev.some(item => item.products.id === productId);
          if (exists) return prev;
          return [wishlistItem!, ...prev];
        });
        
        // Update pagination count
        setPagination(prev => ({
          ...prev,
          total_count: (prev.total_count || 0) + 1
        }));
        
        console.log('useWishlist.addItem: Successfully saved item, returning true');
        return true;
      } else {
        console.log('useWishlist.addItem: API response indicates failure:', response.error);
        throw new Error(response.error || 'Failed to add item to wishlist');
      }
    } catch (err) {
      console.log('useWishlist.addItem: Error occurred:', err);
      // Revert optimistic update
      setWishlistStatus(prev => ({ ...prev, [productId]: false }));
      
      const message = err instanceof Error ? err.message : 'Failed to add item to wishlist';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      console.log('useWishlist.addItem: Returning false due to error');
      return false;
    }
  }, [user]);

  const removeItem = useCallback(async (productId: string): Promise<boolean> => {
    if (!user) return false;

    // Find the wishlist item to remove (for optimistic update)
    const itemToRemove = wishlist.find(item => item.products.id === productId);
    
    // Optimistic update
    setWishlistStatus(prev => ({ ...prev, [productId]: false }));
    setWishlist(prev => prev.filter(item => item.products.id !== productId));
    setPagination(prev => ({
      ...prev,
      total_count: Math.max(0, (prev.total_count || 0) - 1)
    }));
    
    try {
      const response = await removeFromWishlist(productId);
      
      if (response.success) {
        return true;
      } else {
        throw new Error(response.error || 'Failed to remove item from wishlist');
      }
    } catch (err) {
      // Revert optimistic update
      setWishlistStatus(prev => ({ ...prev, [productId]: true }));
      if (itemToRemove) {
        setWishlist(prev => [itemToRemove, ...prev]);
        setPagination(prev => ({
          ...prev,
          total_count: (prev.total_count || 0) + 1
        }));
      }
      
      const message = err instanceof Error ? err.message : 'Failed to remove item from wishlist';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    }
  }, [user, wishlist]);

  const updateItem = useCallback(async (
    wishlistItemId: string, 
    updates: { notes?: string; tags?: string[] }
  ): Promise<boolean> => {
    if (!user) return false;

    // Find the item to update
    const itemIndex = wishlist.findIndex(item => item.id === wishlistItemId);
    if (itemIndex === -1) return false;

    const originalItem = wishlist[itemIndex];
    
    // Optimistic update
    setWishlist(prev => {
      const newWishlist = [...prev];
      newWishlist[itemIndex] = {
        ...originalItem,
        notes: updates.notes !== undefined ? updates.notes : originalItem.notes,
        tags: updates.tags !== undefined ? updates.tags : originalItem.tags,
      };
      return newWishlist;
    });
    
    try {
      // Note: This would need a backend endpoint for updating wishlist items
      // For now, we'll simulate success and keep the optimistic update
      // TODO: Implement PUT /api/wishlist/:id endpoint
      return true;
    } catch (err) {
      // Revert optimistic update
      setWishlist(prev => {
        const newWishlist = [...prev];
        newWishlist[itemIndex] = originalItem;
        return newWishlist;
      });
      
      const message = err instanceof Error ? err.message : 'Failed to update wishlist item';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    }
  }, [user, wishlist]);

  const checkStatus = useCallback(async (productIds: string[]) => {
    if (!user || productIds.length === 0) return;

    try {
      const response: WishlistStatusResponse = await checkWishlistStatus(productIds);
      
      if (response.success) {
        setWishlistStatus(prev => ({
          ...prev,
          ...response.wishlist_status
        }));
      }
    } catch (err) {
      // Silent fail for status checks as they're not critical
      console.warn('Failed to check wishlist status:', err);
    }
  }, [user]);

  const setFilters = useCallback((newFilters: Partial<WishlistFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    // Reset pagination when filters change
    setPagination(prev => ({ ...prev, offset: 0 }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    setPagination(prev => ({ ...prev, offset: 0 }));
  }, []);

  // Helper function to check if a product is in wishlist
  const isInWishlist = useCallback((productId: string): boolean => {
    return wishlistStatus[productId] === true;
  }, [wishlistStatus]);

  const setInitialStatus = useCallback((status: Record<string, boolean>) => {
    setWishlistStatus(prev => ({ ...prev, ...status }));
  }, []);

  const filteredWishlist = useMemo(() => {
    return wishlist.filter(item => {
        // Apply filters...
        return true; 
    }).sort((a, b) => {
        switch (filters.sortBy) {
            case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
    });
  }, [wishlist, filters]);

  return {
    wishlist,
    pagination,
    filters,
    wishlistStatus,
    loading,
    error,
    isInitialLoadComplete,
    initialLoadStatus,
    fetchWishlist,
    loadMore,
    refresh,
    addItem,
    removeItem,
    updateItem,
    checkStatus,
    setFilters,
    resetFilters,
    setInitialStatus,
    filteredWishlist,
    hasMore: pagination.has_more,
    isEmpty: wishlist.length === 0 && !loading.isLoading,
    totalCount: pagination.total_count || 0,
    isInWishlist,
  };
} 