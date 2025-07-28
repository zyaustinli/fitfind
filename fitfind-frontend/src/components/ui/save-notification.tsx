"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToCollectionModal } from "@/components/collections/AddToCollectionModal";
import { ClothingItem, WishlistItemDetailed } from "@/types";
import { useWishlist } from "@/hooks/useWishlist";

interface SaveNotificationProps {
  show: boolean;
  onClose: () => void;
  savedItem: ClothingItem | null;
  savedWishlistItem?: WishlistItemDetailed | null;
  message?: string;
}

// Utility function to check if a wishlist item matches a product ID
const doesWishlistItemMatchProductId = (wishlistItem: WishlistItemDetailed, productId: string): boolean => {
  if (!productId || !wishlistItem) return false;
  
  return (
    wishlistItem.products.id === productId ||
    wishlistItem.products.external_id === productId ||
    wishlistItem.product_id === productId ||
    wishlistItem.id === productId
  );
};

// Convert ClothingItem to WishlistItemDetailed for the modal
const convertToWishlistItem = (item: ClothingItem): WishlistItemDetailed => {
  const finalId = item.product_id || `temp-${Date.now()}`;
  console.log('SaveNotification: Converting ClothingItem to WishlistItemDetailed', {
    originalItemTitle: item.title,
    productId: item.product_id,
    finalId
  });
  
  return {
    id: finalId,
    user_id: "current-user", // This will be populated by the backend
    product_id: item.product_id || "",
    notes: null,
    tags: item.tag ? [item.tag] : [],
    created_at: new Date().toISOString(),
    products: {
      id: item.product_id || `temp-${Date.now()}`,
      clothing_item_id: "",
      external_id: item.product_id,
      title: item.title || "Untitled Product",
      price: item.extracted_price?.toString() || null,
      old_price: null,
      discount_percentage: null,
      image_url: item.thumbnail,
      product_url: item.link,
      source: item.source || "",
      source_icon: null,
      rating: item.rating,
      review_count: item.reviews,
      delivery_info: item.shipping,
      tags: item.tag ? [item.tag] : [],
      created_at: new Date().toISOString(),
    }
  };
};

export function SaveNotification({
  show,
  onClose,
  savedItem,
  savedWishlistItem,
  message = "Added to favorites",
}: SaveNotificationProps) {
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [wishlistItem, setWishlistItem] = useState<WishlistItemDetailed | null>(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  
  const { wishlist, refresh } = useWishlist({ autoFetch: false });

  useEffect(() => {
    console.log('SaveNotification: useEffect triggered, show =', show);
    if (show) {
      console.log('SaveNotification: Making notification visible');
      setIsVisible(true);
      const timer = setTimeout(() => {
        console.log('SaveNotification: Timer expired, hiding notification');
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  // Sync savedWishlistItem prop changes and reset internal state
  useEffect(() => {
    console.log('SaveNotification: savedWishlistItem prop changed:', {
      newSavedWishlistItemId: savedWishlistItem?.id,
      currentWishlistItemId: wishlistItem?.id,
      show
    });
    
    // Reset internal wishlist item state when savedWishlistItem prop changes
    if (show && savedWishlistItem?.id !== wishlistItem?.id) {
      console.log('SaveNotification: Resetting internal wishlist item state due to prop change');
      setWishlistItem(null);
      setShowCollectionModal(false);
      setIsLoadingModal(false);
    }
  }, [savedWishlistItem?.id, show, wishlistItem?.id]);

  const handleManageClick = async () => {
    // Prevent multiple clicks while loading
    if (isLoadingModal) {
      console.log('SaveNotification: Already loading, ignoring click');
      return;
    }

    setIsLoadingModal(true);
    console.log('SaveNotification: handleManageClick called', {
      hasSavedWishlistItem: !!savedWishlistItem,
      savedWishlistItemId: savedWishlistItem?.id,
      hasSavedItem: !!savedItem,
      savedItemProductId: savedItem?.product_id,
      wishlistLength: wishlist.length
    });

    try {
      // First priority: Use the savedWishlistItem if available AND valid (from recent save)
      if (savedWishlistItem) {
        console.log('SaveNotification: Validating saved wishlist item:', savedWishlistItem.id);
        
        // Validate that the saved wishlist item ID still exists in current wishlist
        const isValidWishlistItem = wishlist.some(item => item.id === savedWishlistItem.id);
        
        if (isValidWishlistItem) {
          console.log('SaveNotification: Using validated saved wishlist item:', savedWishlistItem.id);
          setWishlistItem(savedWishlistItem);
          setShowCollectionModal(true);
          setIsVisible(false);
          return;
        } else {
          console.warn('SaveNotification: Saved wishlist item ID is stale, falling back to search:', {
            staleId: savedWishlistItem.id,
            currentWishlistIds: wishlist.map(item => item.id)
          });
          // Continue to next priority level instead of using stale ID
        }
      }

      // Second priority: Try to find it in current wishlist state
      if (savedItem?.product_id) {
        console.log('SaveNotification: Searching for wishlist item with product_id:', savedItem.product_id);
        const foundWishlistItem = wishlist.find(item => 
          doesWishlistItemMatchProductId(item, savedItem.product_id!)
        );
        
        if (foundWishlistItem) {
          console.log('SaveNotification: Found wishlist item in state:', foundWishlistItem.id);
          setWishlistItem(foundWishlistItem);
          setShowCollectionModal(true);
          setIsVisible(false);
          return;
        }
      }

      // Third priority: Refresh wishlist and try again
      console.log('SaveNotification: Item not found in current state, refreshing wishlist...');
      
      try {
        await refresh();
        
        // Give a small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to find the item again after refresh
        if (savedItem?.product_id) {
          console.log('SaveNotification: Searching again after refresh with product_id:', savedItem.product_id);
          const foundWishlistItem = wishlist.find(item => 
            doesWishlistItemMatchProductId(item, savedItem.product_id!)
          );
          
          if (foundWishlistItem) {
            console.log('SaveNotification: Found wishlist item after refresh:', foundWishlistItem.id);
            setWishlistItem(foundWishlistItem);
            setShowCollectionModal(true);
            setIsVisible(false);
            return;
          }
        }
      } catch (error) {
        console.error('SaveNotification: Failed to refresh wishlist:', error);
      }

      // Fourth priority: Create a temporary wishlist item from the saved item
      if (savedItem) {
        console.log('SaveNotification: Creating temporary wishlist item from saved item');
        const tempWishlistItem = convertToWishlistItem(savedItem);
        setWishlistItem(tempWishlistItem);
        setShowCollectionModal(true);
        setIsVisible(false);
        return;
      }

      // Last resort: show improved error message
      console.error('SaveNotification: Unable to find valid wishlist item, cannot open collections modal');
      alert('Unable to manage collections for this item right now. The item has been saved to your wishlist. Please try accessing collections from the wishlist page.');
    } finally {
      setIsLoadingModal(false);
    }
  };

  const handleCollectionModalClose = (open: boolean) => {
    setShowCollectionModal(open);
    if (!open) {
      onClose();
    }
  };

  const handleSuccess = () => {
    setShowCollectionModal(false);
    onClose();
  };

  if (!show && !showCollectionModal) {
    console.log('SaveNotification: Component not rendering - show:', show, 'showCollectionModal:', showCollectionModal);
    return null;
  }

  console.log('SaveNotification: Component rendering - show:', show, 'isVisible:', isVisible, 'savedItem:', savedItem?.title);

  return (
    <>
      <div
        className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        )}
      >
        <Card className="flex items-center gap-3 px-4 py-3 shadow-lg border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
              <Check className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-900">{message}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManageClick}
            disabled={isLoadingModal}
            className="ml-2 h-7 px-3 text-xs font-medium"
          >
            {isLoadingModal ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Loading...
              </>
            ) : (
              'Manage'
            )}
          </Button>
        </Card>
      </div>

      {wishlistItem && (
        <AddToCollectionModal
          open={showCollectionModal}
          onOpenChange={handleCollectionModalClose}
          item={wishlistItem}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}