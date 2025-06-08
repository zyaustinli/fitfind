"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Heart, 
  Plus, 
  Check, 
  Loader2, 
  ChevronDown,
  Bookmark,
  BookmarkCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSaveItem, useCollections } from "@/hooks";
import type { Collection, SaveItemOptions } from "@/types";

interface SaveButtonProps {
  productId: string;
  variant?: 'default' | 'minimal' | 'icon-only';
  size?: 'sm' | 'default' | 'lg';
  showCollectionSelector?: boolean;
  defaultCollectionId?: string;
  onSave?: (productId: string, collectionId?: string) => void;
  onUnsave?: (productId: string) => void;
  className?: string;
  disabled?: boolean;
}

export function SaveButton({
  productId,
  variant = 'default',
  size = 'default',
  showCollectionSelector = false,
  defaultCollectionId,
  onSave,
  onUnsave,
  className,
  disabled = false
}: SaveButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | undefined>(defaultCollectionId);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Hooks
  const {
    state,
    saveItem,
    unsaveItem,
    isSaved,
    canSave,
    canUnsave
  } = useSaveItem({
    productId,
    onSaveSuccess: (item) => {
      onSave?.(productId, item.collection_id || undefined);
    },
    onUnsaveSuccess: () => {
      onUnsave?.(productId);
    }
  });

  const {
    collections,
    getDefaultCollection,
    loading: collectionsLoading
  } = useCollections({ autoFetch: true });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Handle save/unsave
  const handleToggleSave = async (collectionId?: string) => {
    if (disabled || state.isSaving) return;

    if (isSaved) {
      await unsaveItem();
    } else {
      const options: SaveItemOptions = {};
      if (collectionId) {
        options.collection_id = collectionId;
      }
      await saveItem(options);
    }
  };

  // Handle collection selection
  const handleCollectionSelect = async (collection: Collection) => {
    setSelectedCollection(collection.id);
    setShowDropdown(false);
    await handleToggleSave(collection.id);
  };

  // Handle quick save (no collection selector)
  const handleQuickSave = async () => {
    if (showCollectionSelector && !isSaved) {
      setShowDropdown(true);
    } else {
      await handleToggleSave(selectedCollection);
    }
  };

  // Get button content based on variant
  const getButtonContent = () => {
    const isLoading = state.isSaving;
    
    if (variant === 'icon-only') {
      if (isLoading) {
        return <Loader2 className="h-4 w-4 animate-spin" />;
      }
      return isSaved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      );
    }

    if (variant === 'minimal') {
      return (
        <div className="flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSaved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {size !== 'sm' && (
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          )}
        </div>
      );
    }

    // Default variant
    return (
      <div className="flex items-center gap-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSaved ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        <span>{isSaved ? 'Saved' : 'Save'}</span>
        {showCollectionSelector && !isSaved && (
          <ChevronDown className="h-4 w-4" />
        )}
      </div>
    );
  };

  // Get button styling
  const getButtonVariant = () => {
    if (variant === 'icon-only') {
      return isSaved ? 'default' : 'outline';
    }
    return isSaved ? 'secondary' : 'default';
  };

  const getButtonSize = () => {
    if (variant === 'icon-only') return 'icon';
    return size;
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        variant={getButtonVariant()}
        size={getButtonSize()}
        onClick={handleQuickSave}
        disabled={disabled || state.isSaving || (!canSave && !canUnsave)}
        className={cn(
          "transition-all",
          isSaved && variant !== 'icon-only' && "bg-green-100 border-green-200 text-green-700 hover:bg-green-200",
          variant === 'icon-only' && isSaved && "bg-primary text-primary-foreground",
          state.error && "border-destructive"
        )}
      >
        {getButtonContent()}
      </Button>

      {/* Collection Selector Dropdown */}
      {showDropdown && showCollectionSelector && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)} 
          />
          <div
            ref={dropdownRef}
            className="absolute top-full mt-2 left-0 w-64 bg-background border border-border rounded-lg shadow-lg z-20 max-h-80 overflow-auto"
          >
            <div className="p-2">
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground border-b border-border mb-2">
                Save to Collection
              </div>
              
              {collectionsLoading.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading collections...</span>
                </div>
              ) : collections.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">No collections yet</p>
                  <Button size="sm" variant="outline" className="text-xs">
                    Create Collection
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => handleCollectionSelect(collection)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent rounded-md text-left transition-colors"
                    >
                      <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        {collection.cover_image_url ? (
                          <img
                            src={collection.cover_image_url}
                            alt={collection.name}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <Bookmark className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{collection.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {collection.item_count || 0} items
                          {collection.is_private && (
                            <Badge variant="secondary" className="ml-1 text-xs">Private</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Error State */}
      {state.error && (
        <div className="absolute top-full mt-1 left-0 right-0 text-xs text-destructive">
          {state.error}
        </div>
      )}
    </div>
  );
}

// Quick Save Button (minimal version for product cards)
interface QuickSaveButtonProps {
  productId: string;
  className?: string;
}

export function QuickSaveButton({ productId, className }: QuickSaveButtonProps) {
  return (
    <SaveButton
      productId={productId}
      variant="icon-only"
      size="sm"
      className={className}
    />
  );
}

// Collection Save Button (with collection selector)
interface CollectionSaveButtonProps {
  productId: string;
  defaultCollectionId?: string;
  onSave?: (productId: string, collectionId?: string) => void;
  onUnsave?: (productId: string) => void;
  className?: string;
}

export function CollectionSaveButton({
  productId,
  defaultCollectionId,
  onSave,
  onUnsave,
  className
}: CollectionSaveButtonProps) {
  return (
    <SaveButton
      productId={productId}
      variant="default"
      size="default"
      showCollectionSelector={true}
      defaultCollectionId={defaultCollectionId}
      onSave={onSave}
      onUnsave={onUnsave}
      className={className}
    />
  );
} 