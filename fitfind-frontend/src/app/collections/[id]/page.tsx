"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  FolderHeart, 
  Plus, 
  Edit3, 
  Share2, 
  MoreVertical, 
  Eye, 
  EyeOff,
  Sparkles,
  Package
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollections, useCollectionItems } from "@/hooks";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CollectionItemsGrid, 
  CollectionModal,
  type CollectionItemFilters 
} from "@/components/collections";
import type { Collection, CollectionItem } from "@/types";
import { cn, formatDistanceToNow } from "@/lib/utils";

type ModalState = 
  | { isOpen: false }
  | { isOpen: true; mode: 'login' | 'signup' }

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const collectionId = params.id as string;
  
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Collection items state and filters
  const [filters, setFilters] = useState<CollectionItemFilters>({
    searchQuery: undefined,
    sortBy: 'position'
  });

  // Get collection details
  const {
    getCollectionById,
    updateExistingCollection,
    deleteExistingCollection,
    operations: collectionOps
  } = useCollections({
    autoFetch: !!user
  });

  const collection = getCollectionById(collectionId);

  // Get collection items
  const {
    items,
    loading: itemsLoading,
    error: itemsError,
    hasMore,
    removeItem: removeItemFromCollection,
    reorderItems,
    loadMore,
    isRemovingItem,
    isReordering
  } = useCollectionItems({
    collectionId,
    autoFetch: !!user && !!collection,
    initialLimit: 50
  });

  // Show loading state while checking authentication
  if (authLoading) {
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
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
          <div className="flex items-center justify-center min-h-screen p-8">
            <div className="text-center max-w-md">
              {/* Collections-themed icon */}
              <div className="relative mb-8 mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-full blur-xl"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-full flex items-center justify-center border border-primary/20">
                  <FolderHeart className="w-10 h-10 text-primary" />
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-purple-600 animate-pulse" />
                </div>
              </div>
              
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-4">
                Sign In Required
              </h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Sign in to view your collections and manage your saved items.
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => setModalState({ isOpen: true, mode: 'signup' })}
                  className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Get Started
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setModalState({ isOpen: true, mode: 'login' })}
                  className="w-full border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
                  size="lg"
                >
                  Sign In
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

  // Show not found if collection doesn't exist
  if (user && !itemsLoading.isLoading && !collection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/collections')}
            className="mb-6 gap-2"
            aria-label="Go back to collections list"
            title="Return to all collections"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Collections
          </Button>
          
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                Collection Not Found
              </h2>
              <p className="text-muted-foreground mb-6">
                This collection doesn't exist or you don't have permission to view it.
              </p>
              <Button onClick={() => router.push('/collections')}>
                View All Collections
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Event handlers
  const handleEditCollection = () => {
    setShowEditModal(true);
    setShowDropdown(false);
  };

  const handleUpdateCollection = async (data: any) => {
    if (collection) {
      await updateExistingCollection(collection.id, data);
      setShowEditModal(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (collection && window.confirm(`Are you sure you want to delete "${collection.name}"? This action cannot be undone.`)) {
      const success = await deleteExistingCollection(collection.id);
      if (success) {
        router.push('/collections');
      }
    }
    setShowDropdown(false);
  };

  const handleShareCollection = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      // Could add a toast here
      console.log('Collection URL copied to clipboard');
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
    setShowDropdown(false);
  };

  const handleItemRemove = async (item: CollectionItem) => {
    await removeItemFromCollection(item.id);
  };

  const handleItemMoveUp = async (item: CollectionItem) => {
    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex > 0) {
      const reorderedItems = [...items];
      [reorderedItems[currentIndex], reorderedItems[currentIndex - 1]] = 
      [reorderedItems[currentIndex - 1], reorderedItems[currentIndex]];
      
      const updatedItems = reorderedItems.map((item, index) => ({
        ...item,
        position: index + 1
      }));
      
      await reorderItems(updatedItems);
    }
  };

  const handleItemMoveDown = async (item: CollectionItem) => {
    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex < items.length - 1) {
      const reorderedItems = [...items];
      [reorderedItems[currentIndex], reorderedItems[currentIndex + 1]] = 
      [reorderedItems[currentIndex + 1], reorderedItems[currentIndex]];
      
      const updatedItems = reorderedItems.map((item, index) => ({
        ...item,
        position: index + 1
      }));
      
      await reorderItems(updatedItems);
    }
  };

  const handleItemsReorder = async (reorderedItems: CollectionItem[]) => {
    await reorderItems(reorderedItems);
  };

  const handleSelectionChange = (item: CollectionItem, selected: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(item.id);
      } else {
        newSet.delete(item.id);
      }
      
      setShowBulkActions(newSet.size > 0);
      return newSet;
    });
  };

  const handleFiltersChange = (newFilters: Partial<CollectionItemFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleAddItems = () => {
    // Navigate to wishlist with a special mode to add items to this collection
    router.push(`/wishlist?addToCollection=${collectionId}`);
  };

  if (!collection) {
    return null; // Still loading
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Navigation */}
          <Button 
            variant="ghost" 
            onClick={() => router.push('/collections')}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Collections
          </Button>

          {/* Collection Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                    {collection.name}
                  </h1>
                  {collection.is_private && (
                    <Badge variant="secondary" className="gap-1">
                      <EyeOff className="h-3 w-3" />
                      Private
                    </Badge>
                  )}
                </div>
                
                {collection.description && (
                  <p className="text-muted-foreground text-lg mb-3">
                    {collection.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{collection.item_count || items.length} items</span>
                  <span>•</span>
                  <span>Updated {formatDistanceToNow(new Date(collection.updated_at))}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {collection.is_private ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {collection.is_private ? 'Private' : 'Public'}
                  </span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleAddItems}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Items
                </Button>
                
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="gap-2"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>

                  {showDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowDropdown(false)} 
                      />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg z-20">
                        <div className="py-1">
                          <button
                            onClick={handleEditCollection}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit Collection
                          </button>
                          <button
                            onClick={handleShareCollection}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                          >
                            <Share2 className="h-4 w-4" />
                            Share Collection
                          </button>
                          <div className="border-t border-border my-1" />
                          <button
                            onClick={handleDeleteCollection}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-destructive text-left"
                          >
                            <FolderHeart className="h-4 w-4" />
                            Delete Collection
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Cover Image */}
            {collection.cover_image_url && (
              <div className="aspect-video w-full max-w-2xl rounded-lg overflow-hidden bg-muted">
                <img
                  src={collection.cover_image_url}
                  alt={collection.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Collection Items */}
          <CollectionItemsGrid
            items={items}
            isLoading={itemsLoading.isLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onItemRemove={handleItemRemove}
            onItemMoveUp={handleItemMoveUp}
            onItemMoveDown={handleItemMoveDown}
            onItemsReorder={handleItemsReorder}
            onAddItems={handleAddItems}
            selectedItems={selectedItems}
            onSelectionChange={handleSelectionChange}
            showSelection={showBulkActions}
            showPosition={filters.sortBy === 'position'}
            filters={filters}
            emptyMessage="No items in this collection yet"
            emptyDescription="Add items from your wishlist or save new items directly to this collection."
          />

          {/* Error State */}
          {itemsError.hasError && (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{itemsError.message}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Collection Modal */}
      <CollectionModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSubmit={handleUpdateCollection}
        collection={collection}
        isLoading={collectionOps.isUpdating}
        title="Edit Collection"
      />
    </>
  );
} 