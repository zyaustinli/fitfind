"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToCollectionModal } from "@/components/collections/AddToCollectionModal";
import { ClothingItem, WishlistItemDetailed } from "@/types";

interface SaveNotificationProps {
  show: boolean;
  onClose: () => void;
  savedItem: ClothingItem | null;
  message?: string;
}

// Convert ClothingItem to WishlistItemDetailed for the modal
const convertToWishlistItem = (item: ClothingItem): WishlistItemDetailed => {
  return {
    id: item.product_id || `temp-${Date.now()}`,
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
  message = "Added to favorites",
}: SaveNotificationProps) {
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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

      {savedItem && (
        <AddToCollectionModal
          open={showCollectionModal}
          onOpenChange={handleCollectionModalClose}
          item={convertToWishlistItem(savedItem)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}