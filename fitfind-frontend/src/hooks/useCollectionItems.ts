import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  CollectionItem,
  CollectionItemsResponse,
  CollectionItemFilters,
  PaginationInfo,
  LoadingState,
  ErrorState,
  Collection
} from '@/types';
import { 
  getCollectionItems,
  addItemToCollection,
  removeItemFromCollection,
  reorderCollectionItems
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStableFetch } from './useStableFetch';

export interface UseCollectionItemsOptions {
  collectionId: string;
  autoFetch?: boolean;
  initialLimit?: number;
}

export interface UseCollectionItemsReturn {
  // Data
  items: CollectionItem[];
  pagination: PaginationInfo;
  filters: CollectionItemFilters;
  
  // State
  loading: LoadingState;
  error: ErrorState;
  isAddingItem: boolean;
  isRemovingItem: boolean;
  isReordering: boolean;
  
  // Actions
  fetchItems: (options?: { reset?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  addItem: (savedItemId: string, position?: number) => Promise<boolean>;
  removeItem: (savedItemId: string) => Promise<boolean>;
  reorderItems: (newOrder: Array<{ saved_item_id: string; position: number }>) => Promise<boolean>;
  setFilters: (filters: Partial<CollectionItemFilters>) => void;
  resetFilters: () => void;
  
  // Item management
  moveItemUp: (savedItemId: string) => Promise<boolean>;
  moveItemDown: (savedItemId: string) => Promise<boolean>;
  moveItemToPosition: (savedItemId: string, newPosition: number) => Promise<boolean>;
  
  // Computed
  filteredItems: CollectionItem[];
  hasMore: boolean;
  isEmpty: boolean;
  totalCount: number;
  isItemInCollection: (savedItemId: string) => boolean;
  getItemPosition: (savedItemId: string) => number;
}

const defaultFilters: CollectionItemFilters = {
  sortBy: 'position',
};

export function useCollectionItems(options: UseCollectionItemsOptions): UseCollectionItemsReturn {
  const { collectionId, autoFetch = true, initialLimit = 50 } = options;
  const { user, loading: authLoading } = useAuth();
  
  // Core state
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit: initialLimit,
    offset: 0,
    has_more: false,
    total_count: 0
  });
  const [filters, setFiltersState] = useState<CollectionItemFilters>(defaultFilters);
  
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
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isRemovingItem, setIsRemovingItem] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

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

  const fetchItemsImpl = useCallback(async (options: { reset?: boolean } = {}) => {
    if (!user || !collectionId || fetchingRef.current) {
      console.log('Skipping collection items fetch: missing requirements or already fetching');
      return;
    }

    const { reset = false } = options;
    const currentOffset = reset ? 0 : pagination.offset;
    
    fetchingRef.current = true;
    setLoading({
      isLoading: true,
      message: reset ? 'Loading items...' : 'Loading more...'
    });
    clearError();

    try {
      const response: CollectionItemsResponse = await getCollectionItems(
        collectionId,
        pagination.limit,
        currentOffset
      );

      if (!mountedRef.current) {
        console.log('Component unmounted, skipping collection items state update');
        return;
      }

      if (response.success) {
        const newItems = response.items;
        setItems(prev => reset ? newItems : [...prev, ...newItems]);
        setPagination(response.pagination);
      } else {
        throw new Error(response.error || 'Failed to fetch collection items');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      const message = err instanceof Error ? err.message : 'Failed to load collection items';
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
  }, [user?.id, collectionId, pagination.limit]);

  // Use stable fetch
  const fetchItems = useStableFetch(fetchItemsImpl, [user?.id, collectionId, pagination.limit]);

  const loadMore = useCallback(async () => {
    if (loading.isLoading || !pagination.has_more) return;
    
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
    
    await fetchItems({ reset: false });
  }, [loading.isLoading, pagination.has_more, fetchItems]);

  const refresh = useCallback(async () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
    await fetchItems({ reset: true });
  }, [fetchItems]);

  const addItem = useCallback(async (
    savedItemId: string,
    position?: number
  ): Promise<boolean> => {
    if (!user || !collectionId) return false;

    setIsAddingItem(true);
    clearError();

    try {
      const response = await addItemToCollection(collectionId, savedItemId, position);
      
      if (response.success) {
        // Refresh to get the updated list with correct positions
        await refresh();
        return true;
      } else {
        throw new Error(response.error || 'Failed to add item to collection');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add item to collection';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    } finally {
      setIsAddingItem(false);
    }
  }, [user, collectionId, refresh]);

  const removeItem = useCallback(async (savedItemId: string): Promise<boolean> => {
    if (!user || !collectionId) return false;

    setIsRemovingItem(true);
    clearError();

    // Store the item for potential rollback
    const itemToRemove = items.find(item => item.saved_item_id === savedItemId);
    
    // Optimistic update
    setItems(prev => prev.filter(item => item.saved_item_id !== savedItemId));
    setPagination(prev => ({
      ...prev,
      total_count: Math.max(0, (prev.total_count || 0) - 1)
    }));

    try {
      const response = await removeItemFromCollection(collectionId, savedItemId);
      
      if (response.success) {
        return true;
      } else {
        throw new Error(response.error || 'Failed to remove item from collection');
      }
    } catch (err) {
      // Revert optimistic update
      if (itemToRemove) {
        setItems(prev => [...prev, itemToRemove].sort((a, b) => a.position - b.position));
        setPagination(prev => ({
          ...prev,
          total_count: (prev.total_count || 0) + 1
        }));
      }
      
      const message = err instanceof Error ? err.message : 'Failed to remove item from collection';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    } finally {
      setIsRemovingItem(false);
    }
  }, [user, collectionId, items]);

  const reorderItems = useCallback(async (
    newOrder: Array<{ saved_item_id: string; position: number }>
  ): Promise<boolean> => {
    if (!user || !collectionId) return false;

    setIsReordering(true);
    clearError();

    // Store current order for rollback
    const currentOrder = [...items];
    
    // Optimistic update - reorder items locally
    const reorderedItems = [...items];
    newOrder.forEach(({ saved_item_id, position }) => {
      const itemIndex = reorderedItems.findIndex(item => item.saved_item_id === saved_item_id);
      if (itemIndex !== -1) {
        reorderedItems[itemIndex] = { ...reorderedItems[itemIndex], position };
      }
    });
    reorderedItems.sort((a, b) => a.position - b.position);
    setItems(reorderedItems);

    try {
      const response = await reorderCollectionItems(collectionId, newOrder);
      
      if (response.success) {
        return true;
      } else {
        throw new Error(response.error || 'Failed to reorder items');
      }
    } catch (err) {
      // Revert optimistic update
      setItems(currentOrder);
      
      const message = err instanceof Error ? err.message : 'Failed to reorder items';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    } finally {
      setIsReordering(false);
    }
  }, [user, collectionId, items]);

  // Convenience methods for moving items
  const moveItemUp = useCallback(async (savedItemId: string): Promise<boolean> => {
    const item = items.find(item => item.saved_item_id === savedItemId);
    if (!item || item.position <= 1) return false;

    const newPosition = item.position - 1;
    return await moveItemToPosition(savedItemId, newPosition);
  }, [items]);

  const moveItemDown = useCallback(async (savedItemId: string): Promise<boolean> => {
    const item = items.find(item => item.saved_item_id === savedItemId);
    if (!item) return false;

    const maxPosition = Math.max(...items.map(item => item.position));
    if (item.position >= maxPosition) return false;

    const newPosition = item.position + 1;
    return await moveItemToPosition(savedItemId, newPosition);
  }, [items]);

  const moveItemToPosition = useCallback(async (savedItemId: string, newPosition: number): Promise<boolean> => {
    const item = items.find(item => item.saved_item_id === savedItemId);
    if (!item || item.position === newPosition) return true;

    // Create new order array
    const newOrder = items.map(item => ({
      saved_item_id: item.saved_item_id,
      position: item.saved_item_id === savedItemId ? newPosition : item.position
    }));

    // Adjust positions of other items
    if (newPosition < item.position) {
      // Moving up - shift items down
      newOrder.forEach(orderItem => {
        if (orderItem.saved_item_id !== savedItemId && 
            orderItem.position >= newPosition && 
            orderItem.position < item.position) {
          orderItem.position += 1;
        }
      });
    } else {
      // Moving down - shift items up
      newOrder.forEach(orderItem => {
        if (orderItem.saved_item_id !== savedItemId && 
            orderItem.position > item.position && 
            orderItem.position <= newPosition) {
          orderItem.position -= 1;
        }
      });
    }

    return await reorderItems(newOrder);
  }, [items, reorderItems]);

  const setFilters = useCallback((newFilters: Partial<CollectionItemFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  // Computed values
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const savedItem = item.user_saved_items;
        if (!savedItem) return false;
        
        return savedItem.products.title.toLowerCase().includes(query);
      });
    }

    // Filter by price range
    if (filters.priceRange) {
      filtered = filtered.filter(item => {
        const savedItem = item.user_saved_items;
        if (!savedItem?.products.price) return false;
        
        const price = savedItem.products.price;
        return price >= (filters.priceRange!.min || 0) && 
               price <= (filters.priceRange!.max || Infinity);
      });
    }

    // Filter by sources
    if (filters.sources && filters.sources.length > 0) {
      filtered = filtered.filter(item => {
        const savedItem = item.user_saved_items;
        return savedItem && filters.sources!.includes(savedItem.products.source);
      });
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(item => {
        const savedItem = item.user_saved_items;
        if (!savedItem) return false;
        
        return filters.tags!.some(tag => savedItem.tags.includes(tag));
      });
    }

    // Sort
    filtered.sort((a, b) => {
      const aProduct = a.user_saved_items?.products;
      const bProduct = b.user_saved_items?.products;
      
      switch (filters.sortBy) {
        case 'position':
          return a.position - b.position;
        case 'newest':
          return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
        case 'oldest':
          return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
        case 'price_low':
          return (aProduct?.price || 0) - (bProduct?.price || 0);
        case 'price_high':
          return (bProduct?.price || 0) - (aProduct?.price || 0);
        case 'title':
          return (aProduct?.title || '').localeCompare(bProduct?.title || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, filters]);

  const isItemInCollection = useCallback((savedItemId: string): boolean => {
    return items.some(item => item.saved_item_id === savedItemId);
  }, [items]);

  const getItemPosition = useCallback((savedItemId: string): number => {
    const item = items.find(item => item.saved_item_id === savedItemId);
    return item?.position || 0;
  }, [items]);

  // Auto-fetch on mount and when collectionId or user changes
  useEffect(() => {
    if (autoFetch && user && collectionId && !authLoading && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchItems({ reset: true });
    }
  }, [autoFetch, user, collectionId, authLoading, fetchItems]);

  // Reset when collection changes
  useEffect(() => {
    hasInitializedRef.current = false;
    setItems([]);
    setPagination({
      limit: initialLimit,
      offset: 0,
      has_more: false,
      total_count: 0
    });
  }, [collectionId, initialLimit]);

  return {
    // Data
    items,
    pagination,
    filters,
    
    // State
    loading,
    error,
    isAddingItem,
    isRemovingItem,
    isReordering,
    
    // Actions
    fetchItems,
    loadMore,
    refresh,
    addItem,
    removeItem,
    reorderItems,
    setFilters,
    resetFilters,
    
    // Item management
    moveItemUp,
    moveItemDown,
    moveItemToPosition,
    
    // Computed
    filteredItems,
    hasMore: pagination.has_more,
    isEmpty: items.length === 0,
    totalCount: pagination.total_count || 0,
    isItemInCollection,
    getItemPosition,
  };
} 