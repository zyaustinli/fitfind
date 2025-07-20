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
  
  // Refs for tracking without causing re-renders
  const lastUserIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Clear error helper
  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  // Fetch collections function
  const fetchCollections = useCallback(async () => {
    if (!user || isFetchingRef.current) {
      console.log('📁 Collections: Skipping fetch - no user or already fetching');
      return;
    }

    isFetchingRef.current = true;
    console.log('📁 Collections: Fetching collections for user:', user.email);
    
    setLoading({
      isLoading: true,
      message: 'Loading collections...'
    });
    clearError();

    try {
      const response: CollectionsResponse = await getCollections();
      
      // Check if component is still mounted
      if (!mountedRef.current) return;
      
      if (response.success) {
        console.log('📁 Collections: Fetched', response.collections.length, 'collections');
        setCollections(response.collections);
        isInitializedRef.current = true;
      } else {
        throw new Error(response.error || 'Failed to fetch collections');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      const message = err instanceof Error ? err.message : 'Failed to load collections';
      console.error('📁 Collections: Fetch error:', message);
      setError({
        hasError: true,
        message,
        code: undefined
      });
      isInitializedRef.current = true; // Mark as initialized even on error
    } finally {
      if (mountedRef.current) {
        setLoading({ isLoading: false });
      }
      isFetchingRef.current = false;
    }
  }, [user, clearError]);

  // Single useEffect for all data management
  useEffect(() => {
    console.log('📁 Collections: Effect running', {
      authLoading,
      hasUser: !!user,
      userId: user?.id,
      lastUserId: lastUserIdRef.current,
      autoFetch,
      isInitialized: isInitializedRef.current,
      collectionsCount: collections.length
    });

    // If auth is still loading, wait
    if (authLoading) {
      console.log('📁 Collections: Auth loading, waiting...');
      return;
    }

    // If user logged out, clear everything
    if (!user) {
      console.log('📁 Collections: No user, clearing data');
      setCollections([]);
      setCurrentCollection(null);
      setCollectionItems([]);
      setCollectionPagination(null);
      lastUserIdRef.current = null;
      isInitializedRef.current = false;
      return;
    }

    // If user changed, reset and fetch
    if (user.id !== lastUserIdRef.current) {
      console.log('📁 Collections: User changed, resetting');
      lastUserIdRef.current = user.id;
      isInitializedRef.current = false;
      setCollections([]);
      setCurrentCollection(null);
      setCollectionItems([]);
      setCollectionPagination(null);
      setError({ hasError: false });
      
      if (autoFetch) {
        fetchCollections();
      }
      return;
    }

    // If same user but not initialized and autoFetch enabled, fetch
    if (user.id === lastUserIdRef.current && !isInitializedRef.current && autoFetch) {
      console.log('📁 Collections: Same user, not initialized, fetching');
      fetchCollections();
    }

    // Cleanup function
    return () => {
      // Don't clear data on unmount, just stop any ongoing operations
      isFetchingRef.current = false;
    };
  }, [user?.id, authLoading, autoFetch, fetchCollections]);

  // Mount/unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isFetchingRef.current = false;
    };
  }, []);

  // Collection CRUD operations
  const createNewCollection = useCallback(async (
    name: string,
    description?: string,
    isPrivate: boolean = false
  ): Promise<Collection | null> => {
    if (!user) return null;

    clearError();

    try {
      const response: CollectionResponse = await createCollection({ 
        name, 
        description, 
        is_private: isPrivate 
      });
      
      if (response.success && response.collection) {
        setCollections(prev => [...prev, response.collection!]);
        return response.collection;
      } else {
        throw new Error(response.error || 'Failed to create collection');
      }
    } catch (err) {
      throw err; // Re-throw for the calling component to handle
    }
  }, [user, clearError]);

  const updateExistingCollection = useCallback(async (
    id: string,
    updates: Partial<Collection>
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const allowedUpdates = {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description || undefined }),
        ...(updates.is_private !== undefined && { is_private: updates.is_private }),
        ...(updates.cover_image_url !== undefined && { cover_image_url: updates.cover_image_url || undefined })
      };
      
      const response: CollectionResponse = await updateCollection(id, allowedUpdates);
      
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
      const message = err instanceof Error ? err.message : 'Failed to update collection';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    }
  }, [user, currentCollection]);

  const deleteExistingCollection = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const response: ApiResponse = await deleteCollection(id);
      
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
      const message = err instanceof Error ? err.message : 'Failed to delete collection';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
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
    if (!user) return;

    const currentOffset = reset ? 0 : (collectionPagination?.offset || 0);
    const limitToFetch = 50;
    
    setLoading({
      isLoading: true,
      message: reset ? 'Loading items...' : 'Loading more...'
    });

    try {
      const response: CollectionItemsResponse = await getCollectionItems(
        collectionId,
        limitToFetch,
        currentOffset
      );

      if (!mountedRef.current) return;

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
        setLoading({ isLoading: false });
      }
    }
  }, [user, collectionPagination?.offset]);

  const addToCollection = useCallback(async (
    collectionId: string,
    savedItemId: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('useCollections.addToCollection: Adding item to collection', { collectionId, savedItemId });
      const response = await addItemToCollection(collectionId, { saved_item_id: savedItemId });
      console.log('useCollections.addToCollection: API response:', response);
      
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
      console.error('useCollections.addToCollection: Exception caught:', err);
      const message = err instanceof Error ? err.message : 'Failed to add item';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    }
  }, [user]);

  const removeFromCollection = useCallback(async (
    collectionId: string,
    savedItemId: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await removeItemFromCollection(collectionId, savedItemId);
      
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
      const message = err instanceof Error ? err.message : 'Failed to remove item';
      setError({
        hasError: true,
        message,
        code: undefined
      });
      return false;
    }
  }, [user, currentCollection]);

  const moveItemBetweenCollections = useCallback(async (
    savedItemId: string,
    fromCollectionId: string,
    toCollectionId: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Remove from old collection
      const removeSuccess = await removeFromCollection(fromCollectionId, savedItemId);
      if (!removeSuccess) return false;

      // Add to new collection
      const addSuccess = await addToCollection(toCollectionId, savedItemId);
      if (!addSuccess) {
        // Try to revert by adding back to original collection
        await addToCollection(fromCollectionId, savedItemId);
        return false;
      }

      return true;
    } catch (err) {
      setError({
        hasError: true,
        message: 'Failed to move item between collections',
        code: undefined
      });
      return false;
    }
  }, [user, removeFromCollection, addToCollection]);

  // Computed values
  const defaultCollection = useMemo(() => 
    collections.find(col => col.name === 'My Favorites') || null,
    [collections]
  );

  const hasCollections = collections.length > 0;
  // Simple isEmpty logic: show empty only if user exists, not loading, not error, and initialized but no collections
  const isEmpty = !!user && !loading.isLoading && !error.hasError && isInitializedRef.current && collections.length === 0;
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