import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  SaveItemState, 
  SaveItemOptions,
  Collection,
  WishlistItemDetailedWithCollection 
} from '@/types';
import { 
  addToWishlist,
  addToWishlistWithCollection,
  removeFromWishlist,
  checkWishlistStatus,
  bulkAddToWishlist
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCollections } from './useCollections';

export interface UseSaveItemOptions {
  productId?: string;
  initialSavedState?: boolean;
  onSaveSuccess?: (item: WishlistItemDetailedWithCollection) => void;
  onUnsaveSuccess?: () => void;
  onError?: (error: string) => void;
}

export interface UseSaveItemReturn {
  // State
  state: SaveItemState;
  
  // Actions
  saveItem: (options?: SaveItemOptions) => Promise<boolean>;
  unsaveItem: () => Promise<boolean>;
  toggleSave: (options?: SaveItemOptions) => Promise<boolean>;
  bulkSave: (productIds: string[], options?: SaveItemOptions) => Promise<{ successful: string[]; failed: string[] }>;
  
  // Status checking
  checkSaveStatus: (productIds?: string[]) => Promise<void>;
  refreshStatus: () => Promise<void>;
  
  // Computed
  isSaved: boolean;
  canSave: boolean;
  canUnsave: boolean;
}

export function useSaveItem(options: UseSaveItemOptions = {}): UseSaveItemReturn {
  const { 
    productId, 
    initialSavedState = false,
    onSaveSuccess,
    onUnsaveSuccess,
    onError 
  } = options;
  
  const { user } = useAuth();
  const { getDefaultCollection, collections } = useCollections({ autoFetch: true });
  
  // State
  const [state, setState] = useState<SaveItemState>({
    isSaving: false,
    isSaved: initialSavedState,
    error: undefined
  });

  // Clear error when state changes
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: undefined }));
  }, []);

  // Check if item is saved
  const checkSaveStatus = useCallback(async (productIds?: string[]) => {
    if (!user) return;
    
    const idsToCheck = productIds || (productId ? [productId] : []);
    if (idsToCheck.length === 0) return;

    try {
      const response = await checkWishlistStatus(idsToCheck);
      
      if (response.success && productId) {
        setState(prev => ({
          ...prev,
          isSaved: response.wishlist_status[productId] || false,
          error: undefined
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check save status';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [user, productId, onError]);

  // Refresh status for current product
  const refreshStatus = useCallback(async () => {
    if (productId) {
      await checkSaveStatus([productId]);
    }
  }, [productId, checkSaveStatus]);

  // Save item with optional collection assignment
  const saveItem = useCallback(async (saveOptions: SaveItemOptions = {}): Promise<boolean> => {
    if (!user || !productId) {
      const error = !user ? 'Please log in to save items' : 'No product specified';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return false;
    }

    // Don't save if already saved (unless forcing)
    if (state.isSaved && !saveOptions.showCollectionSelector) {
      return true;
    }

    setState(prev => ({ ...prev, isSaving: true, error: undefined }));

    try {
      let response;
      let targetCollectionId = saveOptions.collection_id;

      // Auto-assign to default collection if none specified
      if (!targetCollectionId && !saveOptions.showCollectionSelector) {
        const defaultCollection = getDefaultCollection();
        targetCollectionId = defaultCollection?.id;
      }

      // Use collection-aware save if collection is specified
      if (targetCollectionId || saveOptions.notes || saveOptions.tags) {
        response = await addToWishlistWithCollection(productId, {
          notes: saveOptions.notes,
          tags: saveOptions.tags,
          collection_id: targetCollectionId
        });
      } else {
        // Fallback to regular save
        response = await addToWishlist(productId, saveOptions.notes, saveOptions.tags);
      }

      if (response.success && response.wishlist_item) {
        setState(prev => ({ 
          ...prev, 
          isSaved: true, 
          error: undefined 
        }));
        
        onSaveSuccess?.(response.wishlist_item);
        return true;
      } else {
        throw new Error(response.error || 'Failed to save item');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save item';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
      return false;
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [user, productId, state.isSaved, getDefaultCollection, onSaveSuccess, onError]);

  // Unsave item
  const unsaveItem = useCallback(async (): Promise<boolean> => {
    if (!user || !productId) {
      const error = !user ? 'Please log in to manage saved items' : 'No product specified';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return false;
    }

    if (!state.isSaved) {
      return true; // Already unsaved
    }

    setState(prev => ({ ...prev, isSaving: true, error: undefined }));

    try {
      const response = await removeFromWishlist(productId);

      if (response.success) {
        setState(prev => ({ 
          ...prev, 
          isSaved: false, 
          error: undefined 
        }));
        
        onUnsaveSuccess?.();
        return true;
      } else {
        throw new Error(response.error || 'Failed to unsave item');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsave item';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
      return false;
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [user, productId, state.isSaved, onUnsaveSuccess, onError]);

  // Toggle save/unsave
  const toggleSave = useCallback(async (saveOptions?: SaveItemOptions): Promise<boolean> => {
    if (state.isSaved) {
      return await unsaveItem();
    } else {
      return await saveItem(saveOptions);
    }
  }, [state.isSaved, saveItem, unsaveItem]);

  // Bulk save multiple items
  const bulkSave = useCallback(async (
    productIds: string[], 
    saveOptions: SaveItemOptions = {}
  ): Promise<{ successful: string[]; failed: string[] }> => {
    if (!user) {
      const error = 'Please log in to save items';
      onError?.(error);
      return { successful: [], failed: productIds };
    }

    if (productIds.length === 0) {
      return { successful: [], failed: [] };
    }

    setState(prev => ({ ...prev, isSaving: true, error: undefined }));

    try {
      let targetCollectionId = saveOptions.collection_id;

      // Auto-assign to default collection if none specified
      if (!targetCollectionId) {
        const defaultCollection = getDefaultCollection();
        targetCollectionId = defaultCollection?.id;
      }

      const response = await bulkAddToWishlist(productIds, {
        collection_id: targetCollectionId,
        notes: saveOptions.notes,
        tags: saveOptions.tags
      });

      if (response.success) {
        const successful = response.results.successful.map(item => item.product_id);
        const failed = response.results.failed;
        
        // Update current item status if it's in the successful list
        if (productId && successful.includes(productId)) {
          setState(prev => ({ ...prev, isSaved: true }));
        }

        return { successful, failed };
      } else {
        throw new Error(response.error || 'Bulk save failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save items';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
      return { successful: [], failed: productIds };
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [user, productId, getDefaultCollection, onError]);

  // Computed values
  const isSaved = state.isSaved;
  const canSave = !!user && !!productId && !state.isSaving;
  const canUnsave = !!user && !!productId && !state.isSaving && state.isSaved;

  // Auto-check status when productId changes
  useEffect(() => {
    if (productId && user) {
      checkSaveStatus([productId]);
    }
  }, [productId, user, checkSaveStatus]);

  return {
    // State
    state,
    
    // Actions
    saveItem,
    unsaveItem,
    toggleSave,
    bulkSave,
    
    // Status checking
    checkSaveStatus,
    refreshStatus,
    
    // Computed
    isSaved,
    canSave,
    canUnsave,
  };
}

// Hook for managing multiple items
export interface UseBulkSaveItemOptions {
  onSaveSuccess?: (results: { successful: string[]; failed: string[] }) => void;
  onError?: (error: string) => void;
}

export interface UseBulkSaveItemReturn {
  // State
  isSaving: boolean;
  error?: string;
  
  // Actions
  bulkSave: (productIds: string[], options?: SaveItemOptions) => Promise<{ successful: string[]; failed: string[] }>;
  
  // Status management
  savedItems: Set<string>;
  checkBulkStatus: (productIds: string[]) => Promise<void>;
  refreshBulkStatus: (productIds: string[]) => Promise<void>;
  
  // Computed
  isSaved: (productId: string) => boolean;
  getSaveCount: () => number;
}

export function useBulkSaveItem(options: UseBulkSaveItemOptions = {}): UseBulkSaveItemReturn {
  const { onSaveSuccess, onError } = options;
  const { user } = useAuth();
  const { getDefaultCollection } = useCollections({ autoFetch: true });
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  const checkBulkStatus = useCallback(async (productIds: string[]) => {
    if (!user || productIds.length === 0) return;

    try {
      const response = await checkWishlistStatus(productIds);
      
      if (response.success) {
        const newSavedItems = new Set<string>();
        Object.entries(response.wishlist_status).forEach(([productId, isSaved]) => {
          if (isSaved) {
            newSavedItems.add(productId);
          }
        });
        setSavedItems(newSavedItems);
        setError(undefined);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check save status';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [user, onError]);

  const refreshBulkStatus = useCallback(async (productIds: string[]) => {
    await checkBulkStatus(productIds);
  }, [checkBulkStatus]);

  const bulkSave = useCallback(async (
    productIds: string[], 
    saveOptions: SaveItemOptions = {}
  ): Promise<{ successful: string[]; failed: string[] }> => {
    if (!user) {
      const errorMsg = 'Please log in to save items';
      setError(errorMsg);
      onError?.(errorMsg);
      return { successful: [], failed: productIds };
    }

    if (productIds.length === 0) {
      return { successful: [], failed: [] };
    }

    setIsSaving(true);
    setError(undefined);

    try {
      let targetCollectionId = saveOptions.collection_id;

      // Auto-assign to default collection if none specified
      if (!targetCollectionId) {
        const defaultCollection = getDefaultCollection();
        targetCollectionId = defaultCollection?.id;
      }

      const response = await bulkAddToWishlist(productIds, {
        collection_id: targetCollectionId,
        notes: saveOptions.notes,
        tags: saveOptions.tags
      });

      if (response.success) {
        const successful = response.results.successful.map(item => item.product_id);
        const failed = response.results.failed;
        
        // Update saved items set
        setSavedItems(prev => {
          const newSet = new Set(prev);
          successful.forEach(id => newSet.add(id));
          return newSet;
        });

        const result = { successful, failed };
        onSaveSuccess?.(result);
        return result;
      } else {
        throw new Error(response.error || 'Bulk save failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save items';
      setError(errorMessage);
      onError?.(errorMessage);
      return { successful: [], failed: productIds };
    } finally {
      setIsSaving(false);
    }
  }, [user, getDefaultCollection, onSaveSuccess, onError]);

  const isSaved = useCallback((productId: string): boolean => {
    return savedItems.has(productId);
  }, [savedItems]);

  const getSaveCount = useCallback((): number => {
    return savedItems.size;
  }, [savedItems]);

  return {
    // State
    isSaving,
    error,
    
    // Actions
    bulkSave,
    
    // Status management
    savedItems,
    checkBulkStatus,
    refreshBulkStatus,
    
    // Computed
    isSaved,
    getSaveCount,
  };
} 