"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToCollectionModal } from "@/components/collections/AddToCollectionModal";
import { ClothingItem } from "@/types";

interface SaveNotificationProps {
  show: boolean;
  onClose: () => void;
  savedItem: ClothingItem | null;
  message?: string;
}

export function SaveNotification({
  show,
  onClose,
  savedItem,
  message = "Added to favorites",
}: SaveNotificationProps) {
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
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

  const handleCollectionModalClose = () => {
    setShowCollectionModal(false);
    onClose();
  };

  if (!show && !showCollectionModal) return null;

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
          isOpen={showCollectionModal}
          onClose={handleCollectionModalClose}
          item={savedItem}
          initiallyInWishlist={true}
        />
      )}
    </>
  );
}