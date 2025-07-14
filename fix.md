Debugging and Fixing the 'Save' Notification Feature
1. Summary of Issues
This document addresses two primary issues reported with the "save" item feature:

Missing Functionality: The "save" notification popup does not appear on the main search recommendations page or on search history cards.

Performance Bug: When the notification does appear (e.g., on the collections page), it is extremely slow, unresponsive, and appears to be buggy.

2. Analysis of Missing Notifications
2.1. Product Cards (Main Search Page)
The "save" functionality is correctly implemented for ProductCard components on the main search page (/app/page.tsx) and the search session detail page (/app/history/[sessionId]/page.tsx).

Data Flow: The parent pages use the useWishlist and useSaveNotification hooks. The onSave handler is passed down through RecommendationsDisplay to each ProductCard.

Component Placement: The <SaveNotification /> component is rendered on these parent pages, allowing it to be displayed when showSaveNotification is called.

Conclusion: The feature should be working as expected in this context. If it's not appearing, it might be due to a different, unrelated issue.

2.2. Search History Cards
The SearchHistoryCard component, as used on the main /history page, is designed as a navigational summary card. It provides a snapshot of a past search session and links to the detailed view.

Design Intent: By design, these summary cards do not include "save" functionality for individual products. The action of saving is meant to occur on the detailed view (/app/history/[sessionId]/page.tsx), where all products from that session are displayed.

Implementation Path: To add "save" functionality directly to the main history page, the useWishlist and useSaveNotification hooks would need to be implemented in /app/history/page.tsx, and the save handlers would need to be passed down to each SearchHistoryCard. This would be a new feature implementation rather than a bug fix.

3. Root Cause of the Slow/Buggy Notification
The core of the performance issue on the collections page is a classic React re-rendering problem that creates an unstable function reference.

The Re-render Loop
State Update: When a user saves or unsaves an item on a collection page (/app/collections/[collectionId]/page.tsx), the useWishlist or useCollections hook is called, which updates the component's state.

Component Re-render: This state update triggers a re-render of the entire page component.

Function Re-creation: Inside the useSaveNotification hook, the hideSaveNotification function is re-created from scratch on every single render of the parent component.

Dependency Change: The SaveNotification component uses a useEffect hook to manage its visibility timer. This useEffect has the onClose prop (which is the hideSaveNotification function) in its dependency array.

Effect Re-run: Because the hideSaveNotification function is a new instance on every render, React sees it as a changed dependency. This causes the useEffect to re-run, clearing the previous setTimeout and starting a new one.

This cycle of clearing and resetting the timeout prevents the notification from ever properly completing its lifecycle, making it appear to flicker, hang, or disappear too slowly.

4. Proposed Solution: Memoization with useCallback
The solution is to ensure that the hideSaveNotification function has a stable reference across re-renders. This can be achieved by wrapping it in the useCallback hook.

By memoizing the function with an empty dependency array ([]), we tell React to create the function only once and reuse the same instance for all subsequent renders. This breaks the re-render loop described above.

5. Code Implementation
The fix requires a small change in fitfind-frontend/src/hooks/useSaveNotification.ts.

Before (Problematic Code)
// fitfind-frontend/src/hooks/useSaveNotification.ts

"use client";

import { useState, useCallback } from "react";
import { ClothingItem } from "@/types";

export function useSaveNotification() {
  // ... (showSaveNotification is already correctly memoized)

  const hideSaveNotification = () => {
    setShowNotification(false);
  };

  return {
    // ...
    hideSaveNotification,
  };
}

After (Corrected Code)
// fitfind-frontend/src/hooks/useSaveNotification.ts

"use client";

import { useState, useCallback } from "react";
import { ClothingItem } from "@/types";

export function useSaveNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [savedItem, setSavedItem] = useState<ClothingItem | null>(null);
  const [notificationMessage, setNotificationMessage] = useState("Added to favorites");

  const showSaveNotification = useCallback((item: ClothingItem, message?: string) => {
    setSavedItem(item);
    if (message) {
      setNotificationMessage(message);
    }
    setShowNotification(true);
  }, []);

  // By wrapping this function in useCallback with an empty dependency array,
  // we ensure that the same function instance is used across re-renders.
  const hideSaveNotification = useCallback(() => {
    setShowNotification(false);
  }, []); // <-- The empty dependency array is the key to the fix.

  return {
    showNotification,
    savedItem,
    notificationMessage,
    showSaveNotification,
    hideSaveNotification,
  };
}

6. Expected Outcome
With this change, the useEffect in the SaveNotification component will no longer be re-triggered by parent component re-renders. The timeout will be set once when the notification appears and will run to completion, ensuring a smooth, responsive, and predictable user experience for the save notification popup across the entire application.