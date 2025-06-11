"use client";

import { useState, useCallback, useMemo } from "react";
import { Grid, List, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WishlistCard } from "./WishlistCard";
import { WishlistEmpty } from "./WishlistEmpty";
import { WishlistLoading } from "./WishlistLoading";
import type { WishlistItemDetailed, WishlistFilters } from "@/types";

interface WishlistGridProps {
  items: WishlistItemDetailed[];
  loading?: boolean;
  error?: string | null;
  filters: WishlistFilters;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onUpdateItem?: (item: WishlistItemDetailed, updates: { notes?: string; tags?: string[] }) => void;
  onRemoveItem?: (item: WishlistItemDetailed) => void;
  onShareItem?: (item: WishlistItemDetailed) => void;
  onAddToCollection?: (item: WishlistItemDetailed) => void;
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onBulkSelect?: (items: WishlistItemDetailed[]) => void;
  className?: string;
  showBulkActions?: boolean;
  itemsPerRow?: number;
}

export function WishlistGrid({
  items,
  loading = false,
  error = null,
  filters,
  hasMore = false,
  onLoadMore,
  onUpdateItem,
  onRemoveItem,
  onShareItem,
  onAddToCollection,
  onViewModeChange,
  onBulkSelect,
  className,
  showBulkActions = false,
  itemsPerRow = 4
}: WishlistGridProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);

  const handleItemSelect = useCallback((item: WishlistItemDetailed, selected: boolean) => {
    const newSelected = new Set(selectedItems);
    if (selected) {
      newSelected.add(item.id);
    } else {
      newSelected.delete(item.id);
    }
    setSelectedItems(newSelected);

    if (onBulkSelect) {
      const selectedItemsArray = items.filter(item => newSelected.has(item.id));
      onBulkSelect(selectedItemsArray);
    }
  }, [selectedItems, items, onBulkSelect]);

  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === items.length) {
      // Deselect all
      setSelectedItems(new Set());
      onBulkSelect?.([]);
    } else {
      // Select all
      const allIds = new Set(items.map(item => item.id));
      setSelectedItems(allIds);
      onBulkSelect?.(items);
    }
  }, [selectedItems.size, items, onBulkSelect]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !onLoadMore) return;
    
    setLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, onLoadMore]);

  const handleRemoveItem = useCallback((item: WishlistItemDetailed) => {
    // Remove from selection if selected
    const newSelected = new Set(selectedItems);
    newSelected.delete(item.id);
    setSelectedItems(newSelected);
    
    onRemoveItem?.(item);
  }, [selectedItems, onRemoveItem]);

  const gridCols = useMemo(() => {
    switch (itemsPerRow) {
      case 2: return 'grid-cols-1 sm:grid-cols-2';
      case 3: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      case 5: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';
      case 6: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6';
      default: return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
  }, [itemsPerRow]);

  // Show loading state for initial load
  if (loading && items.length === 0) {
    return <WishlistLoading viewMode={filters.viewMode} />;
  }

  // Show error state
  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-lg font-medium text-foreground mb-2">
          Something went wrong
        </div>
        <div className="text-sm text-muted-foreground mb-4">
          {error}
        </div>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Show empty state
  if (items.length === 0) {
    return <WishlistEmpty />;
  }

  const isGridView = filters.viewMode === 'grid';
  const hasSelection = selectedItems.size > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with view toggle and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Item count */}
          <div className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''}
            {hasSelection && (
              <span className="ml-2 text-primary">
                ({selectedItems.size} selected)
              </span>
            )}
          </div>

          {/* Bulk select toggle */}
          {showBulkActions && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        {/* View mode toggle */}
        {onViewModeChange && (
          <div className="flex items-center border border-border rounded-lg p-1">
            <Button
              variant={isGridView ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className="h-8 px-3"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={!isGridView ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange('list')}
              className="h-8 px-3"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Items grid/list */}
      <div className={cn(
        isGridView 
          ? `grid gap-4 ${gridCols}`
          : "space-y-3"
      )}>
        {items.map((item) => (
          <WishlistCard
            key={item.id}
            item={item}
            onRemove={handleRemoveItem}
            onUpdate={onUpdateItem}
            onShare={onShareItem}
            onAddToCollection={onAddToCollection}
            viewMode={filters.viewMode}
            isSelected={selectedItems.has(item.id)}
            onSelect={handleItemSelect}
            showCheckbox={showBulkActions}
            className={cn(
              "transition-all duration-200",
              hasSelection && !selectedItems.has(item.id) && "opacity-70"
            )}
          />
        ))}
      </div>

      {/* Load more section */}
      {hasMore && (
        <div className="flex justify-center pt-8">
          <Button
            onClick={handleLoadMore}
            disabled={loadingMore}
            variant="outline"
            size="lg"
            className="min-w-32"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more items...
          </div>
        </div>
      )}
    </div>
  );
} 