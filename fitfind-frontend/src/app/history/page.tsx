"use client";

import { useState, useCallback, useEffect } from "react";
import { History, AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useToast } from "@/components/ui/toast";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { SearchHistoryCard, ConfirmDeleteDialog } from "@/components/history";
import { SearchHistoryFilters } from "@/components/history/SearchHistoryFilters";
import type { SearchHistoryItem, ClothingItem } from "@/types";
import { redoSearch } from "@/lib/api";
import { useRouter } from "next/navigation";

type ModalState = 
  | { isOpen: false }
  | { isOpen: true; mode: 'login' | 'signup' }

interface DeleteState {
  isOpen: boolean;
  item: SearchHistoryItem | null;
  loading: boolean;
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [deleteState, setDeleteState] = useState<DeleteState>({
    isOpen: false,
    item: null,
    loading: false
  });
  const [savedProducts, setSavedProducts] = useState<Set<string>>(new Set());
  const [isRedoing, setIsRedoing] = useState(false);
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
    fetchHistory,
    loadMore,
    refresh,
    setFilters,
    resetFilters,
    deleteHistoryItem,
    isItemDeleting
  } = useSearchHistory({
    autoFetch: true,
    initialLimit: 20,
    includeDetails: true
  });

  // Debug logging for history page auth state
  useEffect(() => {
    console.log('📚 History page auth state:', {
      hasUser: !!user,
      userEmail: user?.email,
      loading,
      timestamp: new Date().toISOString()
    });
  }, [user, loading]);

  // Handle view actions
  const handleViewItem = useCallback(async (item: SearchHistoryItem) => {
    // Navigate to dedicated session detail page
    router.push(`/history/${item.search_session_id}`);
  }, [router]);

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
        // Success! Close dialog and show toast
        setDeleteState({ isOpen: false, item: null, loading: false });
        
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

  // Handle product save/remove (mock implementation)
  const handleSaveProduct = useCallback((product: ClothingItem) => {
    if (!user) {
      toast({
        type: "error",
        title: "Sign In Required",
        description: "Please sign in to save items to your wishlist."
      });
      return;
    }
    setSavedProducts(prev => new Set([...prev, product.product_id || '']));
  }, [user, toast]);

  const handleRemoveProduct = useCallback((product: ClothingItem) => {
    setSavedProducts(prev => {
      const newSet = new Set(prev);
      newSet.delete(product.product_id || '');
      return newSet;
    });
  }, []);

  const isProductSaved = useCallback((product: ClothingItem) => {
    return savedProducts.has(product.product_id || '');
  }, [savedProducts]);

  // Show loading state while checking authentication
  if (loading) {
    console.log('📚 History showing loading state');
    return (
      <div className="h-full p-8 bg-gradient-to-br from-muted/30 to-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show authentication required message if not signed in
  if (!user) {
    console.log('📚 History showing sign-in required');
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-muted/30 to-primary/5">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-full flex items-center justify-center mb-8 mx-auto">
              <History className="w-10 h-10 text-muted-foreground" />
            </div>
            
            <h3 className="text-2xl font-semibold text-foreground mb-4">Sign in to view your search history</h3>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Create an account or sign in to access your previous searches, track your style journey, and easily revisit past outfit discoveries.
            </p>
            
            <div className="space-y-4">
              <Button 
                onClick={() => setModalState({ isOpen: true, mode: 'signup' })}
                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create Account
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setModalState({ isOpen: true, mode: 'login' })}
                className="w-full"
                size="lg"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
        
        {modalState.isOpen && (
          <AuthModal 
            open={modalState.isOpen} 
            onOpenChange={(open) => setModalState(open ? modalState : { isOpen: false })}
            defaultMode={modalState.mode}
          />
        )}
      </>
    );
  }

  // Main history view
  return (
    <>
      <div className="h-full p-8 bg-gradient-to-br from-muted/30 to-primary/5">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Search History</h1>
              <p className="text-muted-foreground">
                View and manage your previous outfit searches and recommendations
              </p>
            </div>
          </div>

          {/* Filters */}
          <SearchHistoryFilters
            filters={filters}
            onFiltersChange={setFilters}
            onReset={resetFilters}
            totalCount={totalCount}
          />

          {/* Loading state */}
          {historyLoading.isLoading && history.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">{historyLoading.message || 'Loading search history...'}</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {historyError.hasError && (
            <div className="p-6 rounded-lg border border-destructive/20 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-destructive mb-1">Failed to load search history</h3>
                  <p className="text-sm text-destructive mb-3">{historyError.message}</p>
                  <Button variant="outline" size="sm" onClick={refresh}>
                    Try Again
                  </Button>
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

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        open={deleteState.isOpen}
        onOpenChange={(open) => !deleteState.loading && setDeleteState(prev => ({ ...prev, isOpen: open }))}
        item={deleteState.item}
        onConfirm={handleConfirmDelete}
        loading={deleteState.loading}
      />
    </>
  );
} 