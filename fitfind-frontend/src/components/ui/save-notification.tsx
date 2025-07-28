"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
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
      price: item.extracted_price,
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
  
  const { wishlist } = useWishlist({ autoFetch: false });

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

  const handleManageClick = () => {
    console.log('SaveNotification: handleManageClick called', {
      hasSavedWishlistItem: !!savedWishlistItem,
      savedWishlistItemId: savedWishlistItem?.id,
      hasSavedItem: !!savedItem,
      savedItemProductId: savedItem?.product_id,
      wishlistLength: wishlist.length
    });

    // Use the savedWishlistItem if available (from recent save), otherwise search wishlist
    if (savedWishlistItem) {
      console.log('SaveNotification: Using saved wishlist item:', savedWishlistItem.id);
      setWishlistItem(savedWishlistItem);
    } else if (savedItem?.product_id) {
      console.log('SaveNotification: Searching for wishlist item with product_id:', savedItem.product_id);
      const foundWishlistItem = wishlist.find(item => 
        item.products.id === savedItem.product_id || 
        item.products.external_id === savedItem.product_id
      );
      
      if (foundWishlistItem) {
        console.log('SaveNotification: Found wishlist item in state:', foundWishlistItem.id);
        setWishlistItem(foundWishlistItem);
      } else {
        console.warn('SaveNotification: Wishlist item not found in state, this may cause collection issues');
        console.log('SaveNotification: Available wishlist items:', wishlist.map(item => ({
          id: item.id,
          productId: item.products.id,
          externalId: item.products.external_id,
          title: item.products.title
        })));
        setWishlistItem(convertToWishlistItem(savedItem));
      }
    } else {
      console.warn('SaveNotification: No product_id available, using converted item - this may cause collection issues');
      setWishlistItem(savedItem ? convertToWishlistItem(savedItem) : null);
    }
    
    setShowCollectionModal(true);
    setIsVisible(false);
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
            className="ml-2 h-7 px-3 text-xs font-medium"
          >
            Manage
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