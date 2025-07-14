"use client";

import { useState, useCallback } from "react";
import { ClothingItem } from "@/types";

export function useSaveNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [savedItem, setSavedItem] = useState<ClothingItem | null>(null);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState("Added to favorites");

  const showSaveNotification = useCallback((item: ClothingItem, savedItemId?: string, message?: string) => {
    console.log('useSaveNotification: showSaveNotification called with item:', item.title, 'savedItemId:', savedItemId);
    setSavedItem(item);
    setSavedItemId(savedItemId || null);
    if (message) {
      setNotificationMessage(message);
    }
    setShowNotification(true);
    console.log('useSaveNotification: notification state set to true');
  }, []);

  const hideSaveNotification = useCallback(() => {
    setShowNotification(false);
    // Don't clear savedItem immediately to allow modal to use it
  }, []);

  return {
    showNotification,
    savedItem,
    savedItemId,
    notificationMessage,
    showSaveNotification,
    hideSaveNotification,
  };
}