import { useState, useEffect, useCallback, useMemo } from 'react';
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

  const fetchWishlist = useCallback(async (options: { reset?: boolean } = {}) => {
    if (!user) {
      setWishlist([]);
      setWishlistStatus({});
      return;
    }

    const { reset = false } = options;
    const currentOffset = reset ? 0 : pagination.offset;
    
    setLoading({
      isLoading: true,
      message: reset ? 'Loading wishlist...' : 'Loading more...'
    });
    clearError();

    try {
      const response: WishlistResponse = await getWishlist(
        pagination.limit,
        currentOffset
      );

      if (response.success) {
        const newItems = response.wishlist;
        setWishlist(prev => reset ? newItems : [...prev, ...newItems]);
        setPagination(response.pagination);
        
        // Update wishlist status for fetched items
        const statusUpdates: Record<string, boolean> = {};
        newItems.forEach(item => {
          statusUpdates[item.products.id] = true;
        });
        setWishlistStatus(prev => ({ ...prev, ...statusUpdates }));
      } else {
        throw new Error(response.error || 'Failed to fetch wishlist');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load wishlist';
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
    if (!user) return false;

    // Optimistic update
    setWishlistStatus(prev => ({ ...prev, [productId]: true }));
    
    try {
      const response: WishlistAddResponse = await addToWishlist(productId, notes, tags);
      
      if (response.success && response.wishlist_item) {
        // Add the new item to the wishlist if it's not already there
        setWishlist(prev => {
          const exists = prev.some(item => item.products.id === productId);
          if (exists) return prev;
          return [response.wishlist_item!, ...prev];
        });
        
        // Update pagination count
        setPagination(prev => ({
          ...prev,
          total_count: (prev.total_count || 0) + 1
        }));
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to add item to wishlist');
      }
    } catch (err) {
      // Revert optimistic update
      setWishlistStatus(prev => ({ ...prev, [productId]: false }));
      
      const message = err instanceof Error ? err.message : 'Failed to add item to wishlist';
      setError({
        hasError: true,
        message,
        code: undefined
      });
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

  // Computed values
  const filteredWishlist = useMemo(() => {
    let filtered = [...wishlist];

    // Filter by price range
    if (filters.priceRange) {
      const { min, max } = filters.priceRange;
      filtered = filtered.filter(item => {
        const price = item.products.price;
        if (price === null) return true; // Include items without price
        return price >= min && price <= max;
      });
    }

    // Filter by sources
    if (filters.sources && filters.sources.length > 0) {
      filtered = filtered.filter(item => 
        filters.sources!.includes(item.products.source)
      );
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(item =>
        filters.tags!.some(tag => 
          item.tags.includes(tag) || item.products.tags.includes(tag)
        )
      );
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.products.title.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query) ||
        item.products.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'price_low':
          const priceA = a.products.price || 0;
          const priceB = b.products.price || 0;
          return priceA - priceB;
        case 'price_high':
          const priceA2 = a.products.price || 0;
          const priceB2 = b.products.price || 0;
          return priceB2 - priceA2;
        case 'rating':
          const ratingA = a.products.rating || 0;
          const ratingB = b.products.rating || 0;
          return ratingB - ratingA;
        case 'title':
          return a.products.title.localeCompare(b.products.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [wishlist, filters]);

  const hasMore = pagination.has_more;
  const isEmpty = wishlist.length === 0 && !loading.isLoading;
  const totalCount = pagination.total_count || 0;

  // Auto-fetch on mount and when user changes
  useEffect(() => {
    if (autoFetch && user && !authLoading) {
      fetchWishlist({ reset: true });
    } else if (!user) {
      setWishlist([]);
      setWishlistStatus({});
      setPagination(prev => ({ ...prev, offset: 0, has_more: false, total_count: 0 }));
    }
  }, [user, authLoading, autoFetch]); // Removed fetchWishlist from deps to avoid infinite loop

  // Re-fetch when sort filters change (for server-side sorting)
  useEffect(() => {
    if (user && (filters.sortBy === 'newest' || filters.sortBy === 'oldest')) {
      // These might require server-side sorting, so refetch
      fetchWishlist({ reset: true });
    }
  }, [filters.sortBy, user]); // Removed fetchWishlist from deps

  return {
    // Data
    wishlist,
    pagination,
    filters,
    wishlistStatus,
    
    // State
    loading,
    error,
    
    // Actions
    fetchWishlist,
    loadMore,
    refresh,
    addItem,
    removeItem,
    updateItem,
    checkStatus,
    setFilters,
    resetFilters,
    
    // Computed
    filteredWishlist,
    hasMore,
    isEmpty,
    totalCount,
    isInWishlist,
  };
} 