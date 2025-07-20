"use client";

import { useState, useEffect } from "react";
import { Heart, Grid3X3, List, Search, Filter, Sparkles, Stars, LayoutGrid, TrendingUp, FolderHeart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/hooks/useWishlist";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  WishlistGrid, 
  WishlistFilters, 
  WishlistActions 
} from "@/components/wishlist";
import { AddToCollectionModal } from "@/components/collections";
import type { WishlistItemDetailed, BulkOperation } from "@/types";

type ModalState = 
  | { isOpen: false }
  | { isOpen: true; mode: 'login' | 'signup' }

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [selectedItems, setSelectedItems] = useState<WishlistItemDetailed[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [addToCollectionItem, setAddToCollectionItem] = useState<WishlistItemDetailed | null>(null);

  // Debug logging for wishlist page auth state
  useEffect(() => {
    console.log('💖 Wishlist page auth state:', {
      hasUser: !!user,
      userEmail: user?.email,
      authLoading,
      timestamp: new Date().toISOString()
    });
  }, [user, authLoading]);

  const {
    filteredWishlist,
    filters,
    loading,
    error,
    hasMore,
    totalCount,
    isEmpty,
    setFilters,
    resetFilters,
    loadMore,
    refresh,
    removeItem,
    addItem,
    isInWishlist
  } = useWishlist({
    autoFetch: !!user
  });

  // Show loading state while checking authentication
  if (authLoading) {
    console.log('💖 Wishlist showing loading state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex h-screen items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-600 rounded-full animate-spin animate-reverse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show authentication required message if not signed in
  if (!user) {
    console.log('💖 Wishlist showing sign-in required');
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
          <div className="flex items-center justify-center min-h-screen p-8">
            <div className="text-center max-w-md">
              {/* AI-themed icon */}
              <div className="relative mb-8 mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-red-600/20 rounded-full blur-xl"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-pink-500/10 to-red-600/10 rounded-full flex items-center justify-center border border-pink-500/20">
                  <Heart className="w-10 h-10 text-pink-600" />
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-red-600 animate-pulse" />
                </div>
              </div>
              
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-pink-600 bg-clip-text text-transparent mb-4">
                Your Wishlist
              </h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Create an account to save your favorite fashion finds, organize them into collections, and never lose track of items you love.
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => setModalState({ isOpen: true, mode: 'signup' })}
                  className="w-full bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-600/90 hover:to-red-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Saving Items
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setModalState({ isOpen: true, mode: 'login' })}
                  className="w-full border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5 transition-all duration-300"
                  size="lg"
                >
                  Welcome Back
                </Button>
              </div>
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

  // Handle bulk operations
  const handleBulkOperation = async (operation: BulkOperation) => {
    if (selectedItems.length === 0) return;

    try {
      switch (operation.type) {
        case 'remove':
          for (const item of selectedItems) {
            await removeItem(item.products.id);
          }
          setSelectedItems([]);
          setShowBulkActions(false);
          break;
        case 'add_to_collection':
          // Handle adding to collection
          // This would need implementation based on your collections system
          break;
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500/20 to-red-600/20 rounded-xl flex items-center justify-center">
                    <Heart className="w-5 h-5 text-pink-600" />
                  </div>
                  <Stars className="absolute -top-1 -right-1 w-4 h-4 text-red-600 animate-pulse" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-pink-600 to-red-600 bg-clip-text text-transparent">
                  Your Wishlist
                </h1>
              </div>
              <p className="text-muted-foreground">
                {totalCount > 0 ? `${totalCount} saved item${totalCount === 1 ? '' : 's'}` : 'No saved items yet'}
              </p>
            </div>

            {/* Bulk Actions */}
            {showBulkActions && selectedItems.length > 0 && (
              <WishlistActions
                selectedItems={selectedItems}
                onBulkOperation={handleBulkOperation}
                onCancel={() => {
                  setShowBulkActions(false);
                  setSelectedItems([]);
                }}
              />
            )}
          </div>

          {/* Filters */}
          <WishlistFilters
            filters={filters}
            onFiltersChange={setFilters}
            onReset={resetFilters}
            showAdvanced={showAdvancedFilters}
            onToggleAdvanced={() => setShowAdvancedFilters(!showAdvancedFilters)}
            resultCount={filteredWishlist.length}
            totalCount={totalCount}
            onToggleBulkMode={() => {
              setShowBulkActions(!showBulkActions);
              if (showBulkActions) {
                setSelectedItems([]);
              }
            }}
            bulkMode={showBulkActions}
          />
        </div>

        {/* Loading State */}
        {loading.isLoading && filteredWishlist.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-pink-500/20 border-t-pink-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-red-600 rounded-full animate-spin animate-reverse"></div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error.hasError && (
          <div className="text-center py-12">
            <div className="text-destructive mb-4">⚠️ {error.message}</div>
            <Button onClick={refresh} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading.isLoading && !error.hasError && isEmpty && (
          <div className="text-center py-16">
            <div className="relative mb-8 mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-red-600/20 rounded-full blur-xl"></div>
              <div className="relative w-24 h-24 bg-gradient-to-br from-pink-500/10 to-red-600/10 rounded-full flex items-center justify-center border border-pink-500/20">
                <Heart className="w-10 h-10 text-pink-600" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold mb-4">Your wishlist is empty</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
              Start uploading outfit photos to discover fashion items, then save your favorites here to create your dream wardrobe.
            </p>
            
            <Button
              onClick={() => window.location.href = '/'}
              className="bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-600/90 hover:to-red-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              size="lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Discover Fashion Items
            </Button>
          </div>
        )}

        {/* Wishlist Grid */}
        {!loading.isLoading && !error.hasError && filteredWishlist.length > 0 && (
          <>
            <WishlistGrid
              items={filteredWishlist}
              viewMode={filters.viewMode || 'grid'}
              bulkMode={showBulkActions}
              selectedItems={selectedItems}
              onItemSelect={(item, selected) => {
                if (selected) {
                  setSelectedItems(prev => [...prev, item]);
                } else {
                  setSelectedItems(prev => prev.filter(i => i.id !== item.id));
                }
              }}
              onRemoveItem={removeItem}
              onAddToCollection={setAddToCollectionItem}
            />

            {/* Load More */}
            {hasMore && (
              <div className="text-center mt-8">
                <Button
                  onClick={loadMore}
                  disabled={loading.isLoading}
                  variant="outline"
                  size="lg"
                  className="gap-2"
                >
                  {loading.isLoading ? (
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
          </>
        )}
      </div>

      {/* Add to Collection Modal */}
      {addToCollectionItem && (
        <AddToCollectionModal
          open={!!addToCollectionItem}
          onOpenChange={(open) => !open && setAddToCollectionItem(null)}
          item={addToCollectionItem}
        />
      )}
    </div>
  );
}

 