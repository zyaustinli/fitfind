"use client";

import { useState, useCallback } from "react";
import { ClothingItem, WishlistItemDetailed } from "@/types";

export function useSaveNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [savedItem, setSavedItem] = useState<ClothingItem | null>(null);
  const [savedWishlistItem, setSavedWishlistItem] = useState<WishlistItemDetailed | null>(null);
  const [notificationMessage, setNotificationMessage] = useState("Added to favorites");

  const showSaveNotification = useCallback((item: ClothingItem, message?: string, wishlistItem?: WishlistItemDetailed) => {
    console.log('useSaveNotification: showSaveNotification called with item:', item.title, {
      newWishlistItemId: wishlistItem?.id,
      previousWishlistItemId: savedWishlistItem?.id
    });
    
    // Clear any existing notification state before setting new one
    // This prevents stale state when the same item is saved multiple times
    if (showNotification && savedItem?.product_id === item.product_id) {
      console.log('useSaveNotification: Clearing previous notification state for same item');
      setShowNotification(false);
    }
    
    setSavedItem(item);
    setSavedWishlistItem(wishlistItem || null);
    setNotificationMessage(message || "Added to favorites");
    setShowNotification(true);
    console.log('useSaveNotification: notification state set to true');
  }, [showNotification, savedItem?.product_id, savedWishlistItem?.id]);

  const hideSaveNotification = useCallback(() => {
    setShowNotification(false);
    // Don't clear savedItem immediately to allow modal to use it
  }, []);
  
  const clearNotificationState = useCallback(() => {
    console.log('useSaveNotification: Explicitly clearing all notification state');
    setShowNotification(false);
    setSavedItem(null);
    setSavedWishlistItem(null);
    setNotificationMessage("Added to favorites");
  }, []);

  return {
    showNotification,
    savedItem,
    savedWishlistItem,
    notificationMessage,
    showSaveNotification,
    hideSaveNotification,
    clearNotificationState,
  };
}