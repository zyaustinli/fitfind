"use client";

import { useState, useCallback, useEffect } from "react";
import { History, AlertCircle, Sparkles, Clock, RefreshCw, CheckSquare, X, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useHistoryContext, useHistoryEvents } from "@/contexts/HistoryContext";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useWishlist } from "@/hooks/useWishlist"; // Import the wishlist hook
import { useToast } from "@/components/ui/toast";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchHistoryCard, ConfirmDeleteDialog } from "@/components/history";
import { ConfirmBulkDeleteDialog } from "@/components/history/ConfirmBulkDeleteDialog";
import { SearchHistoryFilters } from "@/components/history/SearchHistoryFilters";
import type { SearchHistoryItem, ClothingItem } from "@/types";
import { redoSearch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type ModalState = 
  | { isOpen: false }
  | { isOpen: true; mode: 'login' | 'signup' }

interface DeleteState {
  isOpen: boolean;
  item: SearchHistoryItem | null;
  loading: boolean;
}

interface BulkDeleteState {
  isOpen: boolean;
  itemCount: number;
  loading: boolean;
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const historyContext = useHistoryContext();
  const { addItem, removeItem, isInWishlist } = useWishlist({}); // Use the wishlist hook
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [deleteState, setDeleteState] = useState<DeleteState>({
    isOpen: false,
    item: null,
    loading: false
  });
  const [bulkDeleteState, setBulkDeleteState] = useState<BulkDeleteState>({
    isOpen: false,
    itemCount: 0,
    loading: false
  });
  const [isRedoing, setIsRedoing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkOperationMode, setBulkOperationMode] = useState(false);
  const router = useRouter();

  const {
    history,
    loading: historyLoading,
    error: historyError,
    pagination,
    filteredHistory,
    filters,
    hasMore,
    isEmpty,
    totalCount,
    isOnline,
    queuedOperationsCount,
    fetchHistory,
    loadMore,
    refresh,
    setFilters,
    resetFilters,
    deleteHistoryItem,
    undoDelete,
    bulkDelete,
    isItemDeleting,
    canUndo,
    clearAllPendingOperations
  } = useSearchHistory({
    autoFetch: true,
    initialLimit: 20,
    includeDetails: true,
    enableUndo: false,
    maxUndoTimeout: 10000
  });

  // Listen to global history events for cross-component sync
  useHistoryEvents(['ITEM_DELETED', 'ITEM_RESTORED'], (event) => {
    if (event.type === 'ITEM_DELETED') {
      console.log('History page: Item deleted globally', event.historyId);
      // The useSearchHistory hook already handles this via optimistic updates
    } else if (event.type === 'ITEM_RESTORED') {
      console.log('History page: Item restored globally', event.historyId);
      // The hook handles restoration
    }
  });

  // Debug logging for history page auth state
  useEffect(() => {
    console.log('📚 History page auth state:', {
      hasUser: !!user,
      userEmail: user?.email,
      loading,
      isOnline,
      queuedOperations: queuedOperationsCount,
      timestamp: new Date().toISOString()
    });
  }, [user, loading, isOnline, queuedOperationsCount]);

  // Handle view actions
  const handleViewItem = useCallback(async (item: SearchHistoryItem) => {
    // Set current detail item for navigation consistency
    historyContext.setCurrentDetailItem(item);
    // Navigate to dedicated session detail page
    router.push(`/history/${item.search_session_id}`);
  }, [router, historyContext]);

  // Handle redo search
  const handleRedoSearch = useCallback(async (item: SearchHistoryItem) => {
    if (!item.search_sessions.conversation_context || isRedoing) return;

    setIsRedoing(true);
    try {
      const response = await redoSearch(
        item.search_sessions.conversation_context,
        undefined,
        {
          country: item.search_sessions.country,
          language: item.search_sessions.language,
          fileId: item.search_sessions.file_id,
          sessionId: item.search_sessions.id
        }
      );

      if (response.success) {
        // Refresh the history to show updated results
        await refresh();
        
        // Show success toast
        toast({
          type: "success",
          title: "Search Redone Successfully",
          description: "Your search has been updated with fresh results."
        });
        
        console.log('Search redone successfully');
      } else {
        throw new Error(response.error || 'Failed to redo search');
      }
    } catch (error) {
      console.error('Error redoing search:', error);
      toast({
        type: "error",
        title: "Failed to Redo Search",
        description: error instanceof Error ? error.message : "An unexpected error occurred."
      });
    } finally {
      setIsRedoing(false);
    }
  }, [isRedoing, refresh, toast]);

  // Handle delete search - open confirmation dialog
  const handleDeleteSearch = useCallback(async (item: SearchHistoryItem) => {
    setDeleteState({
      isOpen: true,
      item,
      loading: false
    });
  }, []);

  // Handle confirmed delete
  const handleConfirmDelete = useCallback(async () => {
    const { item } = deleteState;
    if (!item) return;

    setDeleteState(prev => ({ ...prev, loading: true }));

    try {
      const result = await deleteHistoryItem(item.id);
      
      if (result.success) {
        // Success! Close dialog
        setDeleteState({ isOpen: false, item: null, loading: false });
        
        // Show success message
        toast({
          type: "success",
          title: "Search Deleted",
          description: "The search has been removed from your history."
        });
      } else {
        throw new Error(result.error || 'Failed to delete search');
      }
    } catch (error) {
      console.error('Error deleting search:', error);
      
      // Keep dialog open, stop loading, show error
      setDeleteState(prev => ({ ...prev, loading: false }));
      
      toast({
        type: "error",
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete search. Please try again."
      });
    }
  }, [deleteState, deleteHistoryItem, toast]);

  // Bulk operations
  const handleSelectItem = useCallback((itemId: string, selected: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === filteredHistory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredHistory.map(item => item.id)));
    }
  }, [selectedItems.size, filteredHistory]);

  const handleBulkDelete = useCallback(() => {
    if (selectedItems.size === 0) return;

    setBulkDeleteState({
      isOpen: true,
      itemCount: selectedItems.size,
      loading: false
    });
  }, [selectedItems.size]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedItems.size === 0) return;

    const selectedIds = Array.from(selectedItems);
    setBulkDeleteState(prev => ({ ...prev, loading: true }));
    
    try {
      const result = await bulkDelete(selectedIds);
      
      // Close dialog and clear selection
      setBulkDeleteState({ isOpen: false, itemCount: 0, loading: false });
      setSelectedItems(new Set());
      setBulkOperationMode(false);
      
      if (result.success) {
        toast({
          type: "success",
          title: "Items Deleted",
          description: `Successfully deleted ${result.deletedIds.length} items.`
        });
      } else if (result.failedIds.length > 0) {
        toast({
          type: "warning",
          title: "Some Deletions Failed",
          description: `${result.failedIds.length} items could not be deleted. Please try again.`,
          duration: 8000
        });
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      setBulkDeleteState(prev => ({ ...prev, loading: false }));
      toast({
        type: "error",
        title: "Bulk Delete Failed",
        description: "Failed to delete selected items. Please try again."
      });
    }
  }, [selectedItems, bulkDelete, toast]);

  // Network status handling
  const handleRetryOfflineOperations = useCallback(async () => {
    try {
      await refresh();
      toast({
        type: "success",
        title: "Sync Complete",
        description: "Your history has been synchronized."
      });
    } catch (error) {
      toast({
        type: "error",
        title: "Sync Failed",
        description: "Failed to synchronize offline operations."
      });
    }
  }, [refresh, toast]);

  // Product save/remove handlers using wishlist hook
  const handleSaveProduct = useCallback(async (product: ClothingItem) => {
    if (!user) {
      toast({
        type: "error",
        title: "Sign In Required",
        description: "Please sign in to save items to your wishlist."
      });
      return;
    }
    if (product.product_id) {
      await addItem(product.product_id);
    }
  }, [user, toast, addItem]);

  const handleRemoveProduct = useCallback(async (product: ClothingItem) => {
    if (!user) return;
    if (product.product_id) {
      await removeItem(product.product_id);
    }
  }, [user, removeItem]);

  const isProductSaved = useCallback((product: ClothingItem) => {
    return product.product_id ? isInWishlist(product.product_id) : false;
  }, [isInWishlist]);

  // Early return for loading state
  if (loading && !user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Early return for unauthenticated users
  if (!loading && !user) {
    return (
      <>
        <div className="h-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-primary/5">
          <div className="text-center max-w-md px-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-full flex items-center justify-center mb-6 mx-auto">
              <History className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              View Your Search History
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Sign in to access your saved outfit searches, redo searches with updated results, and manage your fashion discovery history.
            </p>
            <div className="space-y-3">
              <Button 
                size="lg" 
                onClick={() => setModalState({ isOpen: true, mode: 'login' })}
                className="w-full gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Sign In to Continue
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setModalState({ isOpen: true, mode: 'signup' })}
                className="w-full"
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>
        
        <AuthModal
          open={modalState.isOpen}
          onOpenChange={(open) => setModalState(open ? { isOpen: true, mode: 'login' } : { isOpen: false })}
          defaultMode={modalState.isOpen ? modalState.mode : 'login'}
        />
      </>
    );
  }

  return (
    <>
      <div className="min-h-full bg-gradient-to-br from-muted/30 to-primary/5">
        <div className="min-h-full p-8">
          <div className="max-w-7xl mx-auto flex flex-col">
            
            {/* Header with network status */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">Search History</h1>
                  <p className="text-muted-foreground">
                    {totalCount > 0 ? `${totalCount} search${totalCount === 1 ? '' : 'es'}` : 'No searches yet'}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Bulk operations toolbar - enhanced design */}
                  {bulkOperationMode && (
                    <div className="flex items-center gap-2 mr-4 p-2 bg-muted/30 rounded-lg border border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        className="gap-2 hover:bg-background/80"
                      >
                        <CheckSquare className="w-4 h-4" />
                        {selectedItems.size === filteredHistory.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      {selectedItems.size > 0 && (
                        <>
                          <div className="w-px h-6 bg-border/50" />
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDelete}
                            className="gap-2"
                          >
                            Delete {selectedItems.size} {selectedItems.size === 1 ? 'item' : 'items'}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {filteredHistory.length > 0 && (
                      <Button
                        variant={bulkOperationMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBulkOperationMode(!bulkOperationMode)}
                        className={cn(
                          "gap-2 transition-all duration-200",
                          bulkOperationMode 
                            ? "bg-primary text-primary-foreground shadow-sm" 
                            : "border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                        )}
                      >
                        {bulkOperationMode ? (
                          <>
                            <X className="w-4 h-4" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-4 h-4" />
                            Select
                          </>
                        )}
                      </Button>
                    )}
                    
                    {queuedOperationsCount > 0 && isOnline && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetryOfflineOperations}
                        className="gap-2 border-orange-200 hover:border-orange-300 hover:bg-orange-50 text-orange-700"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Sync ({queuedOperationsCount})
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <SearchHistoryFilters
                filters={filters}
                onFiltersChange={setFilters}
                onReset={resetFilters}
                resultCount={filteredHistory.length}
                totalCount={totalCount}
              />
            </div>

            {/* Error state */}
            {historyError.hasError && (
              <div className="p-6 rounded-lg border border-destructive/20 bg-destructive/5 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-destructive mb-1">Failed to load search history</h3>
                    <p className="text-sm text-destructive mb-3">{historyError.message}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={refresh}>
                        Try Again
                      </Button>
                      {!isOnline && (
                        <Button variant="outline" size="sm" onClick={clearAllPendingOperations}>
                          Clear Offline Data
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {isEmpty && !historyLoading.isLoading && !historyError.hasError && (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <History className="w-12 h-12 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No search history yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start uploading outfit photos to build your search history
                </p>
              </div>
            )}

            {/* Search history grid */}
            {filteredHistory.length > 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredHistory.map((item) => (
                    <SearchHistoryCard
                      key={item.id}
                      item={item}
                      onView={handleViewItem}
                      onRedo={handleRedoSearch}
                      onDelete={handleDeleteSearch}
                      isDeleting={isItemDeleting(item.id)}
                      isSelected={bulkOperationMode && selectedItems.has(item.id)}
                      onSelect={bulkOperationMode ? (selected) => handleSelectItem(item.id, selected) : undefined}

                      showNetworkStatus={!isOnline}
                    />
                  ))}
                </div>

                {/* Load more button */}
                {hasMore && (
                  <div className="text-center">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={historyLoading.isLoading}
                      className="gap-2"
                    >
                      {historyLoading.isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        open={deleteState.isOpen}
        onOpenChange={(open) => !deleteState.loading && setDeleteState(prev => ({ ...prev, isOpen: open }))}
        item={deleteState.item}
        onConfirm={handleConfirmDelete}
        loading={deleteState.loading}
      />

      {/* Bulk delete confirmation dialog */}
      <ConfirmBulkDeleteDialog
        open={bulkDeleteState.isOpen}
        onOpenChange={(open) => !bulkDeleteState.loading && setBulkDeleteState(prev => ({ ...prev, isOpen: open }))}
        itemCount={bulkDeleteState.itemCount}
        onConfirm={handleConfirmBulkDelete}
        loading={bulkDeleteState.loading}
      />
    </>
  );
} 