import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Collection, 
  CollectionDetails,
  CollectionItem,
  CollectionsResponse,
  CollectionResponse,
  CollectionDetailsResponse,
  CollectionItemsResponse,
  CollectionFilters,
  CollectionFiltersState,
  CollectionOperationsState,
  PaginationInfo,
  LoadingState,
  ErrorState 
} from '@/types';
import { 
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionDetails,
  getCollectionItems,
  addItemToCollection,
  removeItemFromCollection,
  reorderCollectionItems
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStableFetch } from './useStableFetch';

export interface UseCollectionsOptions {
  autoFetch?: boolean;
  initialLimit?: number;
  includeStats?: boolean;
}

export interface UseCollectionsReturn {
  // Data
  collections: Collection[];
  pagination: PaginationInfo;
  filters: CollectionFiltersState;
  
  // State
  loading: LoadingState;
  error: ErrorState;
  operations: CollectionOperationsState;
  
  // Actions
  fetchCollections: (options?: { reset?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  createNewCollection: (name: string, options?: { description?: string; is_private?: boolean }) => Promise<Collection | null>;
  updateExistingCollection: (collectionId: string, updates: any) => Promise<boolean>;
  deleteExistingCollection: (collectionId: string) => Promise<boolean>;
  setFilters: (filters: Partial<CollectionFiltersState>) => void;
  resetFilters: () => void;
  
  // Collection details
  getCollectionById: (collectionId: string) => Collection | undefined;
  getDefaultCollection: () => Collection | undefined;
  
  // UI actions
  showCreateModal: () => void;
  hideCreateModal: () => void;
  showEditModal: (collection: Collection) => void;
  hideEditModal: () => void;
  
  // Computed
  filteredCollections: Collection[];
  hasMore: boolean;
  isEmpty: boolean;
  totalCount: number;
  publicCollections: Collection[];
  privateCollections: Collection[];
}

const defaultFilters: CollectionFiltersState = {
  sortBy: 'newest',
  viewMode: 'grid',
  showCreateModal: false,
  showEditModal: false,
};

const defaultOperations: CollectionOperationsState = {
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  isReordering: false,
  isAddingItem: false,
  isRemovingItem: false,
};

export function useCollections(options: UseCollectionsOptions = {}): UseCollectionsReturn {
  const { autoFetch = true, initialLimit = 50, includeStats = true } = options;
  const { user, loading: authLoading } = useAuth();
  
  // Core state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit: initialLimit,
    offset: 0,
    has_more: false,
    total_count: 0
  });
  const [filters, setFiltersState] = useState<CollectionFiltersState>(defaultFilters);
  
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
  const [operations, setOperations] = useState<CollectionOperationsState>(defaultOperations);

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

  const fetchCollectionsImpl = useCallback(async (options: { reset?: boolean } = {}) => {
    if (!user || fetchingRef.current) {
      console.log('Skipping collections fetch: no user or already fetching');
      return;
    }

    const { reset = false } = options;
    const currentOffset = reset ? 0 : pagination.offset;
    
    fetchingRef.current = true;
    setLoading({
      isLoading: true,
      message: reset ? 'Loading collections...' : 'Loading more...'
    });
    clearError();

    try {
      const response: CollectionsResponse = await getCollections(
        pagination.limit,
        currentOffset,
        includeStats
      );

      if (!mountedRef.current) {
        console.log('Component unmounted, skipping collections state update');
        return;
      }

      if (response.success) {
        const newItems = response.collections;
        setCollections(prev => reset ? newItems : [...prev, ...newItems]);
        setPagination(response.pagination);
      } else {
        throw new Error(response.error || 'Failed to fetch collections');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      const message = err instanceof Error ? err.message : 'Failed to load collections';
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
  }, [user?.id, pagination.limit, includeStats]);

  // Use stable fetch
  const fetchCollections = useStableFetch(fetchCollectionsImpl, [user?.id, pagination.limit, includeStats]);

  const loadMore = useCallback(async () => {
    if (loading.isLoading || !pagination.has_more) return;
    
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
    
    await fetchCollections({ reset: false });
  }, [loading.isLoading, pagination.has_more, fetchCollections]);

  const refresh = useCallback(async () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
    await fetchCollections({ reset: true });
  }, [fetchCollections]);

  const createNewCollection = useCallback(async (
    name: string,
    options: { description?: string; is_private?: boolean } = {}
  ): Promise<Collection | null> => {
    if (!user) return null;

    setOperations(prev => ({ ...prev, isCreating: true }));
    clearError();

    try {
      const response: CollectionResponse = await createCollection(name, options);
      
      if (response.success && response.collection) {
        // Add the new collection to the beginning of the list
        setCollections(prev => [response.collection!, ...prev]);
        
        // Update pagination count
        setPagination(prev => ({
          ...prev,
          total_count: (prev.total_count || 0) + 1
        }));
        
        return response.collection;
      } else {
        throw new Error(response.error || 'Failed to create collection');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create collection';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return null;
    } finally {
      setOperations(prev => ({ ...prev, isCreating: false }));
    }
  }, [user]);

  const updateExistingCollection = useCallback(async (
    collectionId: string,
    updates: any
  ): Promise<boolean> => {
    if (!user) return false;

    setOperations(prev => ({ ...prev, isUpdating: true }));
    clearError();

    // Optimistic update
    setCollections(prev => prev.map(collection => 
      collection.id === collectionId 
        ? { ...collection, ...updates, updated_at: new Date().toISOString() }
        : collection
    ));

    try {
      const response: CollectionResponse = await updateCollection(collectionId, updates);
      
      if (response.success && response.collection) {
        // Update with server response
        setCollections(prev => prev.map(collection => 
          collection.id === collectionId ? response.collection! : collection
        ));
        return true;
      } else {
        throw new Error(response.error || 'Failed to update collection');
      }
    } catch (err) {
      // Revert optimistic update
      await refresh();
      
      const message = err instanceof Error ? err.message : 'Failed to update collection';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    } finally {
      setOperations(prev => ({ ...prev, isUpdating: false }));
    }
  }, [user, refresh]);

  const deleteExistingCollection = useCallback(async (collectionId: string): Promise<boolean> => {
    if (!user) return false;

    setOperations(prev => ({ ...prev, isDeleting: true }));
    clearError();

    // Store the collection for potential rollback
    const collectionToDelete = collections.find(c => c.id === collectionId);
    
    // Optimistic update
    setCollections(prev => prev.filter(collection => collection.id !== collectionId));
    setPagination(prev => ({
      ...prev,
      total_count: Math.max(0, (prev.total_count || 0) - 1)
    }));

    try {
      const response = await deleteCollection(collectionId);
      
      if (response.success) {
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete collection');
      }
    } catch (err) {
      // Revert optimistic update
      if (collectionToDelete) {
        setCollections(prev => [collectionToDelete, ...prev]);
        setPagination(prev => ({
          ...prev,
          total_count: (prev.total_count || 0) + 1
        }));
      }
      
      const message = err instanceof Error ? err.message : 'Failed to delete collection';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    } finally {
      setOperations(prev => ({ ...prev, isDeleting: false }));
    }
  }, [user, collections]);

  const setFilters = useCallback((newFilters: Partial<CollectionFiltersState>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  // UI actions
  const showCreateModal = useCallback(() => {
    setFilters({ showCreateModal: true });
  }, [setFilters]);

  const hideCreateModal = useCallback(() => {
    setFilters({ showCreateModal: false });
  }, [setFilters]);

  const showEditModal = useCallback((collection: Collection) => {
    setFilters({ showEditModal: true, selectedCollection: collection });
  }, [setFilters]);

  const hideEditModal = useCallback(() => {
    setFilters({ showEditModal: false, selectedCollection: undefined });
  }, [setFilters]);

  // Computed values
  const getCollectionById = useCallback((collectionId: string): Collection | undefined => {
    return collections.find(collection => collection.id === collectionId);
  }, [collections]);

  const getDefaultCollection = useCallback((): Collection | undefined => {
    return collections.find(collection => collection.name === 'My Favorites');
  }, [collections]);

  const filteredCollections = useMemo(() => {
    let filtered = [...collections];

    // Filter by privacy
    if (filters.isPrivate !== undefined) {
      filtered = filtered.filter(collection => collection.is_private === filters.isPrivate);
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(collection => 
        collection.name.toLowerCase().includes(query) ||
        (collection.description && collection.description.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'item_count':
          return (b.item_count || 0) - (a.item_count || 0);
        case 'last_updated':
          const aUpdate = a.last_updated || a.updated_at;
          const bUpdate = b.last_updated || b.updated_at;
          return new Date(bUpdate).getTime() - new Date(aUpdate).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [collections, filters]);

  const publicCollections = useMemo(() => {
    return collections.filter(collection => !collection.is_private);
  }, [collections]);

  const privateCollections = useMemo(() => {
    return collections.filter(collection => collection.is_private);
  }, [collections]);

  // Auto-fetch on mount and when user changes
  useEffect(() => {
    if (autoFetch && user && !authLoading && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchCollections({ reset: true });
    }
  }, [autoFetch, user, authLoading, fetchCollections]);

  return {
    // Data
    collections,
    pagination,
    filters,
    
    // State
    loading,
    error,
    operations,
    
    // Actions
    fetchCollections,
    loadMore,
    refresh,
    createNewCollection,
    updateExistingCollection,
    deleteExistingCollection,
    setFilters,
    resetFilters,
    
    // Collection details
    getCollectionById,
    getDefaultCollection,
    
    // UI actions
    showCreateModal,
    hideCreateModal,
    showEditModal,
    hideEditModal,
    
    // Computed
    filteredCollections,
    hasMore: pagination.has_more,
    isEmpty: collections.length === 0,
    totalCount: pagination.total_count || 0,
    publicCollections,
    privateCollections,
  };
} 