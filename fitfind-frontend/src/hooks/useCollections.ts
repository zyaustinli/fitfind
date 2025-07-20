import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
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

  const mountedRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const pathname = usePathname();
  
  // FIX #1: Add a ref to track pagination state without causing re-renders
  const paginationRef = useRef(collectionPagination);
  useEffect(() => {
    paginationRef.current = collectionPagination;
  }, [collectionPagination]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-fetch collections when user is authenticated - moved to after fetchCollections is defined

  const clearError = useCallback(() => {
    setError({ hasError: false });
  }, []);

  const fetchCollections = useCallback(async () => {
    if (!user) return;

    setLoading({
      isLoading: true,
      message: 'Loading collections...'
    });
    clearError();

    try {
      const response: CollectionsResponse = await getCollections();

      if (!mountedRef.current) return;

      if (response.success) {
        setCollections(response.collections);
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
      }
    }
  }, [user?.id]); // 🔧 FIX: Stabilize dependencies - only depend on user ID

  // 🔧 CONSOLIDATED initialization effect - FIXED dependencies to prevent instability
  useEffect(() => {
    console.log('📁 Collections: Initialization check', {
      authLoading,
      hasUser: !!user,
      userEmail: user?.email,
      hasInitialized: hasInitializedRef.current,
      autoFetch
    });
    
    // Skip if auth is still loading
    if (authLoading) {
      console.log('📁 Collections: Auth still loading, skipping');
      return;
    }

    // Skip if autoFetch is disabled
    if (!autoFetch) {
      console.log('📁 Collections: AutoFetch disabled, skipping');
      return;
    }

    // Clear data when no user
    if (!user) {
      console.log('📁 Collections: No user, clearing data');
      setCollections([]);
      setCurrentCollection(null);
      setCollectionItems([]);
      setCollectionPagination(null);
      hasInitializedRef.current = false;
      return;
    }

    // Only fetch if we haven't initialized for this user
    if (!hasInitializedRef.current) {
      console.log('📁 Collections: Initializing for user:', user.email);
      hasInitializedRef.current = true;
      // Set loading state before fetch to prevent empty state flash
      setLoading({ isLoading: true, message: 'Loading collections...' });
      fetchCollections();
    }
  }, [user?.id, authLoading, autoFetch]); // 🔧 FIXED: Removed fetchCollections to prevent instability

  const createNewCollection = useCallback(async (
    name: string,
    description?: string,
    isPrivate: boolean = false
  ): Promise<Collection | null> => {
    if (!user) return null;

    // Clear any existing errors when starting a new collection creation
    clearError();

    try {
      const response: CollectionResponse = await createCollection({ name, description, is_private: isPrivate });
      
      if (response.success && response.collection) {
        setCollections(prev => [...prev, response.collection!]);
        return response.collection;
      } else {
        // Throw the error so it can be caught by the calling function
        // but don't set the hook's error state
        throw new Error(response.error || 'Failed to create collection');
      }
    } catch (err) {
      // Re-throw the error so the calling function can handle it
      throw err;
    }
  }, [user, clearError]);

  const updateExistingCollection = useCallback(async (
    id: string,
    updates: Partial<Collection>
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Filter to only allowed update fields and handle null values
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

    // FIX #2: Use the ref to get the current offset, preventing a dependency cycle
    const currentOffset = reset ? 0 : (paginationRef.current?.offset || 0);
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
        // FIX #3: Set the current collection from the API response
        if (response.collection) {
          setCurrentCollection(response.collection);
        }

        setCollectionItems(prev => 
          reset ? response.items : [...prev, ...response.items]
        );
        setCollectionPagination(response.pagination);
        
        // Set loading to false AFTER setting the collection data to prevent race condition
        setLoading({ isLoading: false });
      } else {
        setLoading({ isLoading: false });
        throw new Error(response.error || 'Failed to fetch items');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      // Set loading to false for error cases
      setLoading({ isLoading: false });
      
      // Check if this is an ApiError with 404 status (collection not found)
      if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
        // For 404 errors, we don't set an error state - we let the UI show "Collection Not Found"
        // The currentCollection will remain null, which will trigger the not found UI
      } else {
        // For other errors, set the error state
        const message = err instanceof Error ? err.message : 'Failed to load items';
        setError({
          hasError: true,
          message,
          code: undefined
        });
      }
    }
  }, [user]);

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

  // 🔧 SIMPLIFIED user change reset - following useWishlist pattern (ONLY reset flag, don't clear data)
  useEffect(() => {
    console.log('🔄 Collections: User changed, resetting initialization flag only');
    hasInitializedRef.current = false;
    // 🚨 CRITICAL: Don't clear data here - let main effect handle it
  }, [user?.id]);

  // 🔧 SIMPLIFIED navigation cleanup - keep data in memory like useWishlist
  useEffect(() => {
    if (!pathname.startsWith('/collections')) {
      console.log('🧹 Collections: Navigated away, light cleanup (keeping data in memory)');
      // Only clear loading state, keep data for fast return visits
      setLoading({ isLoading: false });
      // 🚨 Don't reset hasInitializedRef - keep data loaded for same user
    }
  }, [pathname]);

  // Computed values
  const defaultCollection = useMemo(() => 
    collections.find(col => col.name === 'My Favorites') || null,
    [collections]
  );

  const hasCollections = collections.length > 0;
  // 🔧 FIX: Prevent empty state flash - only show empty if we've actually tried to load data
  const isEmpty = collections.length === 0 && !loading.isLoading && hasInitializedRef.current;
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