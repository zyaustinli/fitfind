"use client";

import { useState, useCallback } from "react";
import { ClothingItem } from "@/types";

export function useSaveNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [savedItem, setSavedItem] = useState<ClothingItem | null>(null);
  const [notificationMessage, setNotificationMessage] = useState("Added to favorites");

  const showSaveNotification = useCallback((item: ClothingItem, message?: string) => {
    console.log('useSaveNotification: showSaveNotification called with item:', item.title);
    setSavedItem(item);
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
    notificationMessage,
    showSaveNotification,
    hideSaveNotification,
  };
}