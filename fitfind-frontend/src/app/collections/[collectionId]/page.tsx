"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit3, Trash2, Settings, FolderHeart, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollections } from "@/hooks/useCollections";
import { removeFromWishlist, addToWishlist } from "@/lib/api";
import { useSaveNotification } from "@/hooks/useSaveNotification";
import { SaveNotification } from "@/components/ui/save-notification";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  WishlistGrid,
  WishlistEmpty 
} from "@/components/wishlist";
import { EditCollectionModal, DeleteCollectionModal } from "@/components/collections";
import type { WishlistItemDetailed, ClothingItem } from "@/types";

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const collectionId = params.collectionId as string;
  
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // Track items that have been unsaved but are still visible on the page
  const [unsavedItems, setUnsavedItems] = useState<Set<string>>(new Set());
  // Track items that are in the process of being saved/unsaved
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  
  const { showNotification, savedItem, notificationMessage, showSaveNotification, hideSaveNotification } = useSaveNotification();

  const {
    currentCollection,
    collectionItems,
    collectionPagination,
    loading,
    error,
    selectCollection,
    fetchCollectionItems,
    updateExistingCollection,
    deleteExistingCollection,
    removeFromCollection
  } = useCollections();

  // Fetch collection data when component mounts
  useEffect(() => {
    let isMounted = true;
    if (user && collectionId) {
      fetchCollectionItems(collectionId, true).finally(() => {
        if (isMounted) {
          setIsInitialLoad(false);
        }
      });
    } else if (!user && !authLoading) {
      setIsInitialLoad(false);
    }
    return () => { isMounted = false; };
  }, [user, collectionId, fetchCollectionItems, authLoading]);

  // Show loading state during initial load or auth loading
  if (isInitialLoad || authLoading) {
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

  // Redirect if not authenticated
  if (!user) {
    router.push('/wishlist');
    return null;
  }

  const handleRemoveItem = async (item: WishlistItemDetailed) => {
    if (currentCollection) {
      await removeFromCollection(currentCollection.id, item.id);
    }
  };

  const handleRemoveFromDatabase = async (item: WishlistItemDetailed) => {
    if (processingItems.has(item.id)) return; // Prevent double-clicking
    
    // Optimistic update - immediately mark as unsaved
    setUnsavedItems(prev => new Set(prev).add(item.id));
    setProcessingItems(prev => new Set(prev).add(item.id));
    
    try {
      // Use external_id if available, otherwise fall back to internal id
      const productId = item.products.external_id || item.products.id;
      const response = await removeFromWishlist(productId);
      
      if (!response.success) {
        // Rollback optimistic update on failure
        setUnsavedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
        console.error('Failed to remove item from database:', response.error);
      } else {
        console.log('Item removed from database, but kept on page for potential re-saving');
      }
    } catch (error) {
      // Rollback optimistic update on error
      setUnsavedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
      console.error('Failed to remove item from database:', error);
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const handleResaveItem = async (item: WishlistItemDetailed) => {
    if (processingItems.has(item.id)) return; // Prevent double-clicking
    
    // Optimistic update - immediately mark as saved (remove from unsaved)
    setUnsavedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(item.id);
      return newSet;
    });
    setProcessingItems(prev => new Set(prev).add(item.id));
    
    try {
      // Use external_id if available, otherwise fall back to internal id
      const productId = item.products.external_id || item.products.id;
      const response = await addToWishlist(productId, item.notes || undefined, item.tags);
      
      if (!response.success) {
        // Rollback optimistic update on failure - mark as unsaved again
        setUnsavedItems(prev => new Set(prev).add(item.id));
        console.error('Failed to re-save item to database:', response.error);
      } else {
        console.log('Item re-saved to database');
        // Show save notification with the item converted to ClothingItem format
        const clothingItem: ClothingItem = {
          query: item.products.category || '',
          title: item.products.title,
          link: item.products.product_url,
          price: item.products.price,
          extracted_price: parseFloat(item.products.price || '0'),
          source: item.products.source,
          rating: item.products.rating,
          reviews: item.products.review_count,
          thumbnail: item.products.image_url,
          product_id: item.products.external_id || item.products.id,
          shipping: item.products.delivery_info,
          tag: item.products.category
        };
        showSaveNotification(clothingItem, 'Added to favorites');
      }
    } catch (error) {
      // Rollback optimistic update on error - mark as unsaved again
      setUnsavedItems(prev => new Set(prev).add(item.id));
      console.error('Failed to re-save item to database:', error);
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const handleUpdateItem = async (
    item: WishlistItemDetailed, 
    updates: { notes?: string; tags?: string[] }
  ) => {
    // This would be handled by the wishlist hook if we integrate it
    console.log('Update item:', item.id, updates);
  };

  const handleUpdateCollection = async (id: string, name: string, description?: string, isPrivate?: boolean) => {
    const updates = {
      name,
      description,
      is_private: isPrivate
    };
    const success = await updateExistingCollection(id, updates);
    return success;
  };

  const handleDeleteCollection = async (id: string) => {
    const success = await deleteExistingCollection(id);
    if (success) {
      router.push('/wishlist');
    }
    return success;
  };

  const handleEditClick = () => {
    setShowManageModal(false);
    setShowEditModal(true);
  };

  const handleDeleteClick = () => {
    setShowManageModal(false);
    setShowDeleteModal(true);
  };

  const loadMore = async () => {
    if (collectionId && collectionPagination?.has_more) {
      await fetchCollectionItems(collectionId, false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-7xl mx-auto p-8">
        {/* Error State */}
        {error.hasError && (
          <div className="text-center py-12">
            <div className="text-destructive mb-4">⚠️ {error.message}</div>
            <Button onClick={() => router.push('/wishlist')} variant="outline">
              Back to Collections
            </Button>
          </div>
        )}

        {/* Collection Not Found */}
        {!loading.isLoading && !error.hasError && !currentCollection && (
          <div className="text-center py-12">
            <div className="relative mb-8 mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-[#6b7f3a]/20 rounded-full blur-xl"></div>
              <div className="relative w-24 h-24 bg-gradient-to-br from-primary/10 to-[#6b7f3a]/10 rounded-full flex items-center justify-center border border-primary/20">
                <FolderHeart className="w-10 h-10 text-primary opacity-60" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold mb-4">Collection Not Found</h3>
            <p className="text-muted-foreground mb-8">
              The collection you're looking for doesn't exist or you don't have access to it.
            </p>
            
            <Button onClick={() => router.push('/wishlist')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Collections
            </Button>
          </div>
        )}

        {/* Collection Content */}
        {currentCollection && (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-6">
                <div className="space-y-2">
                  {/* Back Button */}
                  <Button
                    onClick={() => router.push('/wishlist')}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground mb-2"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Collections
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-[#6b7f3a]/20 rounded-xl flex items-center justify-center">
                        <FolderHeart className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-[#6b7f3a] bg-clip-text text-transparent">
                        {currentCollection.name}
                      </h1>
                      {currentCollection.description && (
                        <p className="text-muted-foreground text-lg mt-1">
                          {currentCollection.description}
                        </p>
                      )}
                    </div>
                  </div>


                </div>

                {/* Collection Actions */}
                <div className="flex items-center gap-2">
                  {currentCollection.name !== 'My Favorites' && (
                    <Button
                      onClick={() => setShowManageModal(true)}
                      variant="outline"
                      size="sm"
                      className="border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Collection Items */}
            {collectionItems.length === 0 && !loading.isLoading ? (
              <div className="text-center py-12">
                <div className="relative mb-8 mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-[#6b7f3a]/20 rounded-full blur-xl"></div>
                  <div className="relative w-24 h-24 bg-gradient-to-br from-primary/10 to-[#6b7f3a]/10 rounded-full flex items-center justify-center border border-primary/20">
                    <FolderHeart className="w-10 h-10 text-primary opacity-60" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold mb-4">Empty Collection</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  This collection is empty. Start adding items from your wishlist or discover new fashion finds to organize here.
                </p>
                
                <Button
                  onClick={() => router.push('/')}
                  className="bg-gradient-to-r from-primary to-[#6b7f3a] hover:from-primary/90 hover:to-[#6b7f3a]/90"
                >
                  Discover Fashion
                </Button>
              </div>
            ) : (
              <WishlistGrid
                items={collectionItems}
                loading={loading.isLoading}
                error={error.hasError ? error.message : null}
                filters={{ viewMode: 'grid', sortBy: 'newest' }}
                hasMore={collectionPagination?.has_more || false}
                onLoadMore={loadMore}
                onUpdateItem={handleUpdateItem}
                onRemoveItem={handleRemoveItem}
                onRemoveFromDatabase={handleRemoveFromDatabase}
                onResaveItem={handleResaveItem}
                onBulkSelect={() => {}}
                showBulkActions={false}
                context="collection"
                itemsPerRow={4}
                unsavedItems={unsavedItems}
              />
            )}
          </>
        )}

        {/* Collection Management Modal */}
        {showManageModal && currentCollection && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Manage Collection</h2>
              <p className="text-muted-foreground mb-6">
                Edit your collection settings or delete it permanently.
              </p>
              
              <div className="space-y-4">
                <Button 
                  onClick={handleEditClick}
                  variant="outline" 
                  className="w-full"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Collection
                </Button>
                
                {currentCollection.name !== 'My Favorites' && (
                  <Button 
                    onClick={handleDeleteClick}
                    variant="destructive" 
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Collection
                  </Button>
                )}
                
                <Button 
                  onClick={() => setShowManageModal(false)}
                  variant="ghost" 
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Collection Modal */}
        {currentCollection && (
          <EditCollectionModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            collection={currentCollection}
            onUpdateCollection={handleUpdateCollection}
          />
        )}

        {/* Delete Collection Modal */}
        {currentCollection && currentCollection.name !== 'My Favorites' && (
          <DeleteCollectionModal
            open={showDeleteModal}
            onOpenChange={setShowDeleteModal}
            collection={currentCollection}
            onDeleteCollection={handleDeleteCollection}
          />
        )}
        
        <SaveNotification
          show={showNotification}
          onClose={hideSaveNotification}
          savedItem={savedItem}
          message={notificationMessage}
        />
      </div>
    </div>
  );
} 