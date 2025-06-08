"use client";

import { useState, useEffect } from "react";
import { Heart, Grid3X3, List, Search, Filter, Sparkles, Stars, LayoutGrid, TrendingUp, FolderHeart, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useCollections } from "@/hooks";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  WishlistGrid, 
  WishlistFilters, 
  WishlistActions 
} from "@/components/wishlist";
import { CollectionModal } from "@/components/collections";
import type { WishlistItemDetailed, BulkOperation, Collection } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";

type ModalState = 
  | { isOpen: false }
  | { isOpen: true; mode: 'login' | 'signup' }

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addToCollectionId = searchParams.get('addToCollection');
  
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [selectedItems, setSelectedItems] = useState<WishlistItemDetailed[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [showCollectionsSection, setShowCollectionsSection] = useState(false);

  // Debug logging for wishlist page auth state
  useEffect(() => {
    console.log('📋 Wishlist page auth state:', {
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
    setFilters,
    resetFilters,
    loadMore,
    updateItem,
    removeItem
  } = useWishlist({
    autoFetch: !!user,
    initialLimit: 20
  });

  // Collections hook
  const {
    collections,
    filteredCollections,
    createNewCollection,
    operations: collectionOps
  } = useCollections({
    autoFetch: !!user
  });

  // Show loading state while checking authentication
  if (authLoading) {
    console.log('📋 Wishlist showing loading state');
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
    console.log('📋 Wishlist showing sign-in required');
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
          <div className="flex items-center justify-center min-h-screen p-8">
            <div className="text-center max-w-md">
              {/* AI-themed icon */}
              <div className="relative mb-8 mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-full blur-xl"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-full flex items-center justify-center border border-primary/20">
                  <Heart className="w-10 h-10 text-primary" />
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-purple-600 animate-pulse" />
                </div>
              </div>
              
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-4">
                Your AI-Powered Wishlist
              </h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Create an account to save your favorite finds, let AI organize your style preferences, and never lose track of that perfect outfit again.
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => setModalState({ isOpen: true, mode: 'signup' })}
                  className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Your Style Journey
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setModalState({ isOpen: true, mode: 'login' })}
                  className="w-full border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
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

  const handleBulkAction = async (operation: BulkOperation) => {
    switch (operation.type) {
      case 'delete':
        // Remove selected items
        for (const id of operation.selectedIds) {
          const item = filteredWishlist.find(item => item.id === id);
          if (item) {
            await removeItem(item.products.id);
          }
        }
        setSelectedItems([]);
        setShowBulkActions(false);
        break;
        
      case 'tag':
        // Add tags to selected items
        for (const id of operation.selectedIds) {
          const item = filteredWishlist.find(item => item.id === id);
          if (item && operation.data?.tags) {
            const existingTags = item.tags || [];
            const newTags = [...new Set([...existingTags, ...operation.data.tags])];
            await updateItem(item.id, { tags: newTags });
          }
        }
        break;

      case 'add_to_collection':
        // Add selected items to a collection
        if (operation.data?.collection_id) {
          // This would require implementing bulk add to collection API
          console.log('Adding items to collection:', operation.data.collection_id);
          // TODO: Implement bulk add to collection
        }
        break;
        
      case 'export':
        // Export selected items (placeholder implementation)
        const exportData = selectedItems.map(item => ({
          title: item.products.title,
          price: item.products.price,
          url: item.products.product_url,
          source: item.products.source,
          notes: item.notes,
          tags: item.tags,
          added_date: item.created_at
        }));
        
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
          type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wishlist-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
    }
  };

  const handleRemoveItem = async (item: WishlistItemDetailed) => {
    await removeItem(item.products.id);
  };

  const handleUpdateItem = async (
    item: WishlistItemDetailed, 
    updates: { notes?: string; tags?: string[] }
  ) => {
    await updateItem(item.id, updates);
  };

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setFilters({ viewMode: mode });
  };

  const handleBulkSelect = (items: WishlistItemDetailed[]) => {
    setSelectedItems(items);
    if (items.length > 0 && !showBulkActions) {
      setShowBulkActions(true);
    } else if (items.length === 0 && showBulkActions) {
      setShowBulkActions(false);
    }
  };

  const handleSelectAll = () => {
    setSelectedItems(filteredWishlist);
    setShowBulkActions(true);
  };

  const handleDeselectAll = () => {
    setSelectedItems([]);
    setShowBulkActions(false);
  };

  const handleCancelBulkActions = () => {
    setSelectedItems([]);
    setShowBulkActions(false);
  };

  const handleCreateCollection = async (data: any) => {
    await createNewCollection(data.name, { 
      description: data.description, 
      is_private: data.is_private 
    });
    setShowCreateCollectionModal(false);
  };

  const isAllSelected = selectedItems.length === filteredWishlist.length && filteredWishlist.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-7xl mx-auto p-8">
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-xl flex items-center justify-center">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <Stars className="absolute -top-1 -right-1 w-4 h-4 text-purple-600 animate-pulse" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-purple-600 bg-clip-text text-transparent">
                  Your Wishlist
                </h1>
              </div>
              <p className="text-muted-foreground text-lg">
                {totalCount > 0 
                  ? `${totalCount} curated item${totalCount !== 1 ? 's' : ''} waiting to complete your style`
                  : 'Start building your perfect style collection'
                }
              </p>
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/collections')}
                className="border-primary/20 hover:border-primary/40 hover:bg-primary/5 gap-2"
              >
                <FolderHeart className="h-4 w-4" />
                Collections
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateCollectionModal(true)}
                className="border-primary/20 hover:border-primary/40 hover:bg-primary/5 gap-2"
              >
                <Plus className="h-4 w-4" />
                New Collection
              </Button>
              
              <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border/50">
                <Button
                  variant={filters.viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewModeChange('grid')}
                  className={filters.viewMode === 'grid' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'hover:bg-background/80'
                  }
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={filters.viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewModeChange('list')}
                  className={filters.viewMode === 'list' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'hover:bg-background/80'
                  }
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                {showBulkActions ? 'Exit Selection' : 'Bulk Actions'}
              </Button>
            </div>
          </div>

          {/* Enhanced Search and Quick Filters */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search your saved items by brand, style, color..."
                value={filters.searchQuery || ''}
                onChange={(e) => setFilters({ searchQuery: e.target.value || undefined })}
                className="pl-12 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all duration-300"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => setFilters({ searchQuery: undefined })}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>

            {/* Quick Filter Pills */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Quick filters:</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-6 px-2 text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  onClick={() => setFilters({ sortBy: 'price_low' })}
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Lowest Price
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-6 px-2 text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  onClick={() => setFilters({ sortBy: 'newest' })}
                >
                  Recently Added
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-6 px-2 text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  onClick={() => setFilters({ tags: ['favorites'] })}
                >
                  Favorites
                </Button>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              >
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
                {Object.keys(filters).length > 1 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {Object.keys(filters).length - 1}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mb-6 animate-in slide-in-from-bottom-4 duration-300">
            <WishlistFilters
              filters={filters}
              items={filteredWishlist}
              onFiltersChange={setFilters}
              onReset={resetFilters}
              className="bg-background/50 border-border/50 backdrop-blur-sm"
            />
          </div>
        )}

        {/* Main Content */}
        <WishlistGrid
          items={filteredWishlist}
          loading={loading.isLoading}
          error={error.hasError ? error.message : null}
          filters={filters}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItem}
          onViewModeChange={handleViewModeChange}
          onBulkSelect={handleBulkSelect}
          showBulkActions={showBulkActions}
          itemsPerRow={4}
        />

        {/* Bulk Actions Toolbar */}
        {showBulkActions && (
          <WishlistActions
            selectedItems={selectedItems}
            onBulkAction={handleBulkAction}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onCancel={handleCancelBulkActions}
            isAllSelected={isAllSelected}
            totalItems={filteredWishlist.length}
          />
        )}
      </div>

      {/* Create Collection Modal */}
      <CollectionModal
        open={showCreateCollectionModal}
        onOpenChange={setShowCreateCollectionModal}
        onSubmit={handleCreateCollection}
        isLoading={collectionOps.isCreating}
        title="Create New Collection"
      />
    </div>
  );
} 