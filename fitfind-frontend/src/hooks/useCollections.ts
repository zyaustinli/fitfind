import { useState, useEffect, useCallback, useMemo } from 'react';
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
  
  // Track if we've fetched data for the current user
  const [hasFetchedForUser, setHasFetchedForUser] = useState<string | null>(null);

  // Clear error helper
  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  // Fetch collections - stable function that doesn't cause re-renders
  const fetchCollections = useCallback(async () => {
    if (!user) {
      console.log('📁 Collections: No user, skipping fetch');
      return;
    }

    console.log('📁 Collections: Fetching collections for user:', user.email);
    setLoading({
      isLoading: true,
      message: 'Loading collections...'
    });
    clearError();

    try {
      const response: CollectionsResponse = await getCollections();
      
      if (response.success) {
        console.log('📁 Collections: Fetched', response.collections.length, 'collections');
        setCollections(response.collections);
        // ✅ Don't set hasFetchedForUser here - let useEffect handle it after state updates
      } else {
        throw new Error(response.error || 'Failed to fetch collections');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load collections';
      console.error('📁 Collections: Fetch error:', message);
      setError({
        hasError: true,
        message,
        code: undefined
      });
    } finally {
      setLoading({ isLoading: false });
    }
  }, [user, clearError]);

  // Effect to track when we've successfully fetched data for a user
  // This runs AFTER collections state has been updated, preventing race conditions
  useEffect(() => {
    if (user && collections.length >= 0 && !loading.isLoading && !error.hasError) {
      // Only set if we haven't marked this user as fetched yet
      if (hasFetchedForUser !== user.id) {
        console.log('📁 Collections: Marking user as fetched after successful data load:', user.email);
        setHasFetchedForUser(user.id);
      }
    }
  }, [user, collections, loading.isLoading, error.hasError, hasFetchedForUser]);

  // Single effect for data fetching - simplified and stable  
  useEffect(() => {
    console.log('📁 Collections: Main effect check', {
      authLoading,
      hasUser: !!user,
      userId: user?.id,
      hasFetchedForUser,
      autoFetch,
      collectionsCount: collections.length,
      isLoading: loading.isLoading
    });

    // Skip if auth is still loading
    if (authLoading) {
      console.log('📁 Collections: Auth loading, waiting...');
      return;
    }

    // Clear data when user logs out
    if (!user) {
      console.log('📁 Collections: No user, clearing data');
      setCollections([]);
      setCurrentCollection(null);
      setCollectionItems([]);
      setCollectionPagination(null);
      setHasFetchedForUser(null);
      return;
    }

    // Fetch if we haven't fetched for this user yet and autoFetch is enabled
    if (autoFetch && user.id !== hasFetchedForUser && !loading.isLoading) {
      console.log('📁 Collections: Need to fetch for new user');
      fetchCollections();
    }
  }, [user?.id, authLoading, autoFetch, hasFetchedForUser, loading.isLoading, fetchCollections]);

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
      // Check if this is a 404 error (collection not found)
      if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
        // Don't set error state for 404s - let UI handle it
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
      setLoading({ isLoading: false });
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
  // ✅ Improved isEmpty logic: only show empty when we have a user, we're not loading, 
  // there's no error, and we have actually attempted to fetch (either success or error occurred)
  const isEmpty = user && collections.length === 0 && !loading.isLoading && !error.hasError && hasFetchedForUser === user.id;
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