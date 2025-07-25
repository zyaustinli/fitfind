import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Collection,
  CollectionsResponse,
  CollectionResponse,
  CollectionItemsResponse,
  ApiResponse,
  LoadingState,
  ErrorState,
  WishlistItemDetailed,
  PaginationInfo
} from '@/types';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionItems,
  addItemToCollection,
  removeItemFromCollection
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface UseCollectionsOptions {
  autoFetch?: boolean;
}

export interface UseCollectionsReturn {
  // Data
  collections: Collection[];
  currentCollection: Collection | null;
  collectionItems: WishlistItemDetailed[];
  collectionPagination: PaginationInfo | null;
  
  // State
  loading: LoadingState;
  error: ErrorState;
  
  // Actions
  fetchCollections: () => Promise<void>;
  createNewCollection: (name: string, description?: string, isPrivate?: boolean) => Promise<Collection | null>;
  updateExistingCollection: (id: string, updates: Partial<Collection>) => Promise<boolean>;
  deleteExistingCollection: (id: string) => Promise<boolean>;
  selectCollection: (collection: Collection | null) => void;
  fetchCollectionItems: (collectionId: string, reset?: boolean) => Promise<void>;
  addToCollection: (collectionId: string, savedItemId: string) => Promise<boolean>;
  removeFromCollection: (collectionId: string, savedItemId: string) => Promise<boolean>;
  moveItemBetweenCollections: (savedItemId: string, fromCollectionId: string, toCollectionId: string) => Promise<boolean>;
  
  // Computed
  defaultCollection: Collection | null;
  hasCollections: boolean;
  isEmpty: boolean;
  totalCollections: number;
}

export function useCollections(options: UseCollectionsOptions = {}): UseCollectionsReturn {
  const { autoFetch = true } = options;
  const { user, loading: authLoading } = useAuth();
  
  // Core state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [currentCollection, setCurrentCollection] = useState<Collection | null>(null);
  const [collectionItems, setCollectionItems] = useState<WishlistItemDetailed[]>([]);
  const [collectionPagination, setCollectionPagination] = useState<PaginationInfo | null>(null);
  
  // Centralized loading state machine
  const [loadingState, setLoadingState] = useState<{
    type: 'idle' | 'fetching' | 'creating' | 'updating' | 'deleting' | 'loading_items';
    message?: string;
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
  
  // Refs for tracking without causing re-renders
  const lastUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const authChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountTimeRef = useRef<number>(Date.now());

  // Clear error helper
  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  // Fetch collections function
  const fetchCollections = useCallback(async () => {
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
        console.log('🔄 Collections fetch already in progress, skipping duplicate request');
        return;
      }
    }

    // Create new abort controller for this fetch
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    isFetchingRef.current = true;
    
    setLoadingState({
      type: 'fetching',
      message: 'Loading collections...'
    });
    clearError();

    try {
      // Check if component is still mounted and operation not aborted
      if (!mountedRef.current || signal.aborted) {
        isFetchingRef.current = false;
        return;
      }

      const response: CollectionsResponse = await getCollections({ signal });
      
      // Double-check component is still mounted and not aborted after async operation
      if (!mountedRef.current || signal.aborted) {
        isFetchingRef.current = false;
        return;
      }
      
      if (response.success) {
        setCollections(response.collections);
      } else {
        throw new Error(response.error || 'Failed to fetch collections');
      }
    } catch (err) {
      if (!mountedRef.current || signal.aborted) {
        isFetchingRef.current = false;
        return;
      }
      
      handleErrorWithRecovery(
        err instanceof Error ? err : { message: 'Failed to load collections' },
        'fetchCollections'
      );
    } finally {
      if (mountedRef.current) {
        setLoadingState({ type: 'idle' });
      }
      isFetchingRef.current = false;
    }
  }, [user?.id, clearError]);

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
      
      // Reset all state when user logs out
      setCollections([]);
      setCurrentCollection(null);
      setCollectionItems([]);
      setCollectionPagination(null);
      setError({ hasError: false });
      setLoadingState({ type: 'idle' });
      isFetchingRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    const currentUserId = user.id;
    if (currentUserId !== lastUserIdRef.current) {
      console.log('🔄 Collections: User ID changed, resetting collections state', { 
        oldUser: lastUserIdRef.current, 
        newUser: currentUserId 
      });
      
      // Cancel any ongoing requests when user changes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      lastUserIdRef.current = currentUserId;
      setCollections([]);
      setCurrentCollection(null);
      setCollectionItems([]);
      setCollectionPagination(null);
      setError({ hasError: false });
      setLoadingState({ type: 'idle' });
      isFetchingRef.current = false;
      
      // Debounce the fetch to prevent rapid consecutive calls
      if (autoFetch) {
        authChangeTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && lastUserIdRef.current === currentUserId) {
            fetchCollections();
          }
        }, 100);
      }
    } else if (autoFetch && collections.length === 0 && !loading.isLoading && !isFetchingRef.current) {
      // Only fetch if no request is already in progress
      fetchCollections();
    }
  }, [authLoading, user?.id, autoFetch, fetchCollections, collections.length, loading.isLoading]);

  // Mount/unmount tracking and comprehensive cleanup
  useEffect(() => {
    mountedRef.current = true;
    mountTimeRef.current = Date.now(); // Track mount time for navigation detection
    
    return () => {
      console.log('🧹 useCollections cleanup: Component unmounting');
      mountedRef.current = false;
      
      // Clear auth change timeout
      if (authChangeTimeoutRef.current) {
        clearTimeout(authChangeTimeoutRef.current);
        authChangeTimeoutRef.current = null;
      }
      
      // Cancel any ongoing requests and reset flags immediately
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset fetch flag immediately to prevent navigation blocking
      isFetchingRef.current = false;
    };
  }, []);

  // Collection CRUD operations
  const createNewCollection = useCallback(async (
    name: string,
    description?: string,
    isPrivate: boolean = false
  ): Promise<Collection | null> => {
    if (!user || !mountedRef.current) return null;

    setLoadingState({
      type: 'creating',
      message: 'Creating collection...'
    });
    clearError();

    try {
      const response: CollectionResponse = await createCollection({ 
        name, 
        description, 
        is_private: isPrivate 
      });
      
      // Check if still mounted after async operation
      if (!mountedRef.current) {
        console.log('🖾 Collection creation cancelled: component unmounted');
        return null;
      }
      
      if (response.success && response.collection) {
        setCollections(prev => [...prev, response.collection!]);
        return response.collection;
      } else {
        throw new Error(response.error || 'Failed to create collection');
      }
    } catch (err) {
      if (mountedRef.current) {
        setLoadingState({ type: 'idle' });
        throw err; // Re-throw for the calling component to handle
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setLoadingState({ type: 'idle' });
      }
    }
  }, [user, clearError]);

  const updateExistingCollection = useCallback(async (
    id: string,
    updates: Partial<Collection>
  ): Promise<boolean> => {
    if (!user || !mountedRef.current) return false;

    setLoadingState({
      type: 'updating',
      message: 'Updating collection...'
    });

    try {
      const allowedUpdates = {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description || undefined }),
        ...(updates.is_private !== undefined && { is_private: updates.is_private }),
        ...(updates.cover_image_url !== undefined && { cover_image_url: updates.cover_image_url || undefined })
      };
      
      const response: CollectionResponse = await updateCollection(id, allowedUpdates);
      
      // Check if still mounted after async operation
      if (!mountedRef.current) {
        console.log('🖾 Collection update cancelled: component unmounted');
        return false;
      }
      
      if (response.success && response.collection) {
        setCollections(prev => 
          prev.map(col => col.id === id ? response.collection! : col)
        );
        
        if (currentCollection?.id === id) {
          setCurrentCollection(response.collection);
        }
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to update collection');
      }
    } catch (err) {
      if (mountedRef.current) {
        handleErrorWithRecovery(
          err instanceof Error ? err : { message: 'Failed to update collection' },
          'updateExistingCollection'
        );
        setLoadingState({ type: 'idle' });
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setLoadingState({ type: 'idle' });
      }
    }
  }, [user, currentCollection]);

  const deleteExistingCollection = useCallback(async (id: string): Promise<boolean> => {
    if (!user || !mountedRef.current) return false;

    setLoadingState({
      type: 'deleting',
      message: 'Deleting collection...'
    });

    try {
      const response: ApiResponse = await deleteCollection(id);
      
      // Check if still mounted after async operation
      if (!mountedRef.current) {
        console.log('🖾 Collection deletion cancelled: component unmounted');
        return false;
      }
      
      if (response.success) {
        setCollections(prev => prev.filter(col => col.id !== id));
        
        if (currentCollection?.id === id) {
          setCurrentCollection(null);
          setCollectionItems([]);
          setCollectionPagination(null);
        }
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete collection');
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to delete collection';
        setError({
          hasError: true,
          message,
          code: undefined
        });
        setLoadingState({ type: 'idle' });
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setLoadingState({ type: 'idle' });
      }
    }
  }, [user, currentCollection]);

  const selectCollection = useCallback((collection: Collection | null) => {
    setCurrentCollection(collection);
    if (!collection) {
      setCollectionItems([]);
      setCollectionPagination(null);
    }
  }, []);

  const fetchCollectionItems = useCallback(async (
    collectionId: string,
    reset: boolean = true
  ) => {
    if (!user || !mountedRef.current) return;

    const currentOffset = reset ? 0 : (collectionPagination?.offset || 0);
    const limitToFetch = 50;
    
    setLoadingState({
      type: 'loading_items',
      message: reset ? 'Loading items...' : 'Loading more...'
    });

    try {
      const response: CollectionItemsResponse = await getCollectionItems(
        collectionId,
        limitToFetch,
        currentOffset
      );

      // Double-check component is still mounted after async operation
      if (!mountedRef.current) {
        return;
      }

      if (response.success) {
        if (response.collection) {
          setCurrentCollection(response.collection);
        }

        setCollectionItems(prev => 
          reset ? response.items : [...prev, ...response.items]
        );
        setCollectionPagination(response.pagination);
      } else {
        throw new Error(response.error || 'Failed to fetch items');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      // Check if this is a 404 error (collection not found)
      if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
        console.log('📁 Collections: Collection not found');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load items';
        setError({
          hasError: true,
          message,
          code: undefined
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoadingState({ type: 'idle' });
      }
    }
  }, [user, collectionPagination?.offset]);

  const addToCollection = useCallback(async (
    collectionId: string,
    savedItemId: string
  ): Promise<boolean> => {
    if (!user || !mountedRef.current) return false;

    try {
      console.log('useCollections.addToCollection: Adding item to collection', { collectionId, savedItemId });
      const response = await addItemToCollection(collectionId, { saved_item_id: savedItemId });
      console.log('useCollections.addToCollection: API response:', response);
      
      // Check if still mounted after async operation
      if (!mountedRef.current) {
        console.log('🖾 Add to collection cancelled: component unmounted');
        return false;
      }
      
      if (response.success) {
        // Update collection item count
        setCollections(prev => 
          prev.map(col => 
            col.id === collectionId 
              ? { ...col, item_count: (col.item_count || 0) + 1 }
              : col
          )
        );
        
        console.log('useCollections.addToCollection: Successfully added item to collection');
        return true;
      } else {
        console.error('useCollections.addToCollection: API returned error:', response.error);
        throw new Error(response.error || 'Failed to add item');
      }
    } catch (err) {
      if (mountedRef.current) {
        console.error('useCollections.addToCollection: Exception caught:', err);
        const message = err instanceof Error ? err.message : 'Failed to add item';
        setError({
          hasError: true,
          message,
          code: undefined
        });
      }
      return false;
    }
  }, [user]);

  const removeFromCollection = useCallback(async (
    collectionId: string,
    savedItemId: string
  ): Promise<boolean> => {
    if (!user || !mountedRef.current) return false;

    try {
      const response = await removeItemFromCollection(collectionId, savedItemId);
      
      // Check if still mounted after async operation
      if (!mountedRef.current) {
        console.log('🖾 Remove from collection cancelled: component unmounted');
        return false;
      }
      
      if (response.success) {
        // Update collection item count
        setCollections(prev => 
          prev.map(col => 
            col.id === collectionId 
              ? { ...col, item_count: Math.max(0, (col.item_count || 0) - 1) }
              : col
          )
        );
        
        // Remove from current view if viewing this collection
        if (currentCollection?.id === collectionId) {
          setCollectionItems(prev => 
            prev.filter(item => item.id !== savedItemId)
          );
        }
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to remove item');
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to remove item';
        setError({
          hasError: true,
          message,
          code: undefined
        });
      }
      return false;
    }
  }, [user, currentCollection]);

  const moveItemBetweenCollections = useCallback(async (
    savedItemId: string,
    fromCollectionId: string,
    toCollectionId: string
  ): Promise<boolean> => {
    if (!user || !mountedRef.current) return false;

    try {
      // Remove from old collection
      const removeSuccess = await removeFromCollection(fromCollectionId, savedItemId);
      if (!removeSuccess || !mountedRef.current) return false;

      // Add to new collection
      const addSuccess = await addToCollection(toCollectionId, savedItemId);
      if (!addSuccess) {
        // Try to revert by adding back to original collection (only if still mounted)
        if (mountedRef.current) {
          await addToCollection(fromCollectionId, savedItemId);
        }
        return false;
      }

      return true;
    } catch (err) {
      if (mountedRef.current) {
        setError({
          hasError: true,
          message: 'Failed to move item between collections',
          code: undefined
        });
      }
      return false;
    }
  }, [user, removeFromCollection, addToCollection]);

  // Computed values
  const defaultCollection = useMemo(() => 
    collections.find(col => col.name === 'My Favorites') || null,
    [collections]
  );

  const hasCollections = collections.length > 0;
  const isEmpty = !!user && !loading.isLoading && !error.hasError && collections.length === 0;
  const totalCollections = collections.length;

  return {
    // Data
    collections,
    currentCollection,
    collectionItems,
    collectionPagination,
    
    // State
    loading,
    error,
    
    // Actions
    fetchCollections,
    createNewCollection,
    updateExistingCollection,
    deleteExistingCollection,
    selectCollection,
    fetchCollectionItems,
    addToCollection,
    removeFromCollection,
    moveItemBetweenCollections,
    
    // Computed
    defaultCollection,
    hasCollections,
    isEmpty,
    totalCollections
  };
}