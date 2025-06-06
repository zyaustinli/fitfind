"use client";

import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { SearchHistoryItem } from '@/types';

// Event types for history state changes
export type HistoryEvent = 
  | { type: 'ITEM_DELETED'; historyId: string; item: SearchHistoryItem }
  | { type: 'ITEM_RESTORED'; historyId: string; item: SearchHistoryItem }
  | { type: 'HISTORY_REFRESHED'; items: SearchHistoryItem[] }
  | { type: 'ITEM_UPDATED'; historyId: string; item: SearchHistoryItem }
  | { type: 'BULK_DELETE_STARTED'; historyIds: string[] }
  | { type: 'BULK_DELETE_COMPLETED'; deletedIds: string[]; failedIds: string[] };

// Event listener type
export type HistoryEventListener = (event: HistoryEvent) => void;

interface HistoryContextType {
  // Event system
  addEventListener: (listener: HistoryEventListener) => () => void;
  removeEventListener: (listener: HistoryEventListener) => void;
  dispatchEvent: (event: HistoryEvent) => void;
  
  // Global state coordination
  notifyItemDeleted: (historyId: string, item: SearchHistoryItem) => void;
  notifyItemRestored: (historyId: string, item: SearchHistoryItem) => void;
  notifyHistoryRefreshed: (items: SearchHistoryItem[]) => void;
  notifyItemUpdated: (historyId: string, item: SearchHistoryItem) => void;
  notifyBulkDeleteStarted: (historyIds: string[]) => void;
  notifyBulkDeleteCompleted: (deletedIds: string[], failedIds: string[]) => void;
  
  // Navigation state
  setCurrentDetailItem: (item: SearchHistoryItem | null) => void;
  getCurrentDetailItem: () => SearchHistoryItem | null;
  
  // Deletion management
  addDeletingItem: (historyId: string) => void;
  removeDeletingItem: (historyId: string) => void;
  isDeletingItem: (historyId: string) => boolean;
  clearAllDeletingItems: () => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<HistoryEventListener>>(new Set());
  const currentDetailItemRef = useRef<SearchHistoryItem | null>(null);
  const deletingItemsRef = useRef<Set<string>>(new Set());

  // Event system
  const addEventListener = useCallback((listener: HistoryEventListener) => {
    listenersRef.current.add(listener);
    
    // Return cleanup function
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const removeEventListener = useCallback((listener: HistoryEventListener) => {
    listenersRef.current.delete(listener);
  }, []);

  const dispatchEvent = useCallback((event: HistoryEvent) => {
    // Debug logging
    console.log('🔄 History Event:', event.type, event);
    
    // Notify all listeners
    listenersRef.current.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in history event listener:', error);
      }
    });
  }, []);

  // High-level notification methods
  const notifyItemDeleted = useCallback((historyId: string, item: SearchHistoryItem) => {
    dispatchEvent({ type: 'ITEM_DELETED', historyId, item });
  }, [dispatchEvent]);

  const notifyItemRestored = useCallback((historyId: string, item: SearchHistoryItem) => {
    dispatchEvent({ type: 'ITEM_RESTORED', historyId, item });
  }, [dispatchEvent]);

  const notifyHistoryRefreshed = useCallback((items: SearchHistoryItem[]) => {
    dispatchEvent({ type: 'HISTORY_REFRESHED', items });
  }, [dispatchEvent]);

  const notifyItemUpdated = useCallback((historyId: string, item: SearchHistoryItem) => {
    dispatchEvent({ type: 'ITEM_UPDATED', historyId, item });
  }, [dispatchEvent]);

  const notifyBulkDeleteStarted = useCallback((historyIds: string[]) => {
    dispatchEvent({ type: 'BULK_DELETE_STARTED', historyIds });
  }, [dispatchEvent]);

  const notifyBulkDeleteCompleted = useCallback((deletedIds: string[], failedIds: string[]) => {
    dispatchEvent({ type: 'BULK_DELETE_COMPLETED', deletedIds, failedIds });
  }, [dispatchEvent]);

  // Navigation state management
  const setCurrentDetailItem = useCallback((item: SearchHistoryItem | null) => {
    currentDetailItemRef.current = item;
  }, []);

  const getCurrentDetailItem = useCallback(() => {
    return currentDetailItemRef.current;
  }, []);

  // Deletion state management
  const addDeletingItem = useCallback((historyId: string) => {
    deletingItemsRef.current.add(historyId);
  }, []);

  const removeDeletingItem = useCallback((historyId: string) => {
    deletingItemsRef.current.delete(historyId);
  }, []);

  const isDeletingItem = useCallback((historyId: string) => {
    return deletingItemsRef.current.has(historyId);
  }, []);

  const clearAllDeletingItems = useCallback(() => {
    deletingItemsRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      listenersRef.current.clear();
      deletingItemsRef.current.clear();
    };
  }, []);

  const value: HistoryContextType = {
    // Event system
    addEventListener,
    removeEventListener,
    dispatchEvent,
    
    // Notifications
    notifyItemDeleted,
    notifyItemRestored,
    notifyHistoryRefreshed,
    notifyItemUpdated,
    notifyBulkDeleteStarted,
    notifyBulkDeleteCompleted,
    
    // Navigation
    setCurrentDetailItem,
    getCurrentDetailItem,
    
    // Deletion management
    addDeletingItem,
    removeDeletingItem,
    isDeletingItem,
    clearAllDeletingItems
  };

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistoryContext() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistoryContext must be used within a HistoryProvider');
  }
  return context;
}

// Hook for listening to specific history events
export function useHistoryEvents(
  eventTypes: HistoryEvent['type'][] | HistoryEvent['type'],
  listener: HistoryEventListener,
  deps: any[] = []
) {
  const { addEventListener } = useHistoryContext();
  
  useEffect(() => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    
    const filteredListener: HistoryEventListener = (event) => {
      if (types.includes(event.type)) {
        listener(event);
      }
    };
    
    const cleanup = addEventListener(filteredListener);
    return cleanup;
  }, [addEventListener, listener, ...deps]);
}

// Hook for cross-component deletion state
export function useGlobalDeletionState() {
  const { 
    addDeletingItem, 
    removeDeletingItem, 
    isDeletingItem, 
    clearAllDeletingItems 
  } = useHistoryContext();
  
  return {
    addDeletingItem,
    removeDeletingItem,
    isDeletingItem,
    clearAllDeletingItems
  };
} 