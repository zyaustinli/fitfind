"use client";

import { useState } from "react";
import { CollectionItemCard } from "./CollectionItemCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Package, ArrowLeft } from "lucide-react";
import type { CollectionItem, CollectionItemFilters } from "@/types";

interface CollectionItemsGridProps {
  items: CollectionItem[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onItemRemove?: (item: CollectionItem) => void;
  onItemMoveUp?: (item: CollectionItem) => void;
  onItemMoveDown?: (item: CollectionItem) => void;
  onItemsReorder?: (items: CollectionItem[]) => void;
  onAddItems?: () => void;
  selectedItems?: Set<string>;
  onSelectionChange?: (item: CollectionItem, selected: boolean) => void;
  showSelection?: boolean;
  showPosition?: boolean;
  filters: CollectionItemFilters;
  className?: string;
  emptyMessage?: string;
  emptyDescription?: string;
}

export function CollectionItemsGrid({
  items,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onItemRemove,
  onItemMoveUp,
  onItemMoveDown,
  onItemsReorder,
  onAddItems,
  selectedItems = new Set(),
  onSelectionChange,
  showSelection = false,
  showPosition = false,
  filters,
  className,
  emptyMessage = "No items in this collection",
  emptyDescription = "Add items to this collection to see them here. You can save items from search results or move them from other collections."
}: CollectionItemsGridProps) {
  const [draggedItem, setDraggedItem] = useState<CollectionItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<CollectionItem | null>(null);

  const isEmpty = items.length === 0 && !isLoading;

  // Drag and drop handlers
  const handleDragStart = (item: CollectionItem) => {
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent, item: CollectionItem) => {
    e.preventDefault();
    setDragOverItem(item);
  };

  const handleDragEnd = () => {
    if (draggedItem && dragOverItem && draggedItem.id !== dragOverItem.id) {
      // Calculate new positions
      const reorderedItems = [...items];
      const draggedIndex = reorderedItems.findIndex(item => item.id === draggedItem.id);
      const targetIndex = reorderedItems.findIndex(item => item.id === dragOverItem.id);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        // Remove dragged item
        const [movedItem] = reorderedItems.splice(draggedIndex, 1);
        // Insert at new position
        reorderedItems.splice(targetIndex, 0, movedItem);
        
        // Update positions
        const updatedItems = reorderedItems.map((item, index) => ({
          ...item,
          position: index + 1
        }));
        
        onItemsReorder?.(updatedItems);
      }
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleDragEnd();
  };

  if (isEmpty) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {emptyMessage}
          </h3>
          <p className="text-muted-foreground mb-6">
            {emptyDescription}
          </p>
          {onAddItems && (
            <Button onClick={onAddItems} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Items
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Grid Container */}
      <div className={cn(
        "grid gap-6",
        filters.sortBy === 'position' && onItemsReorder 
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
          : filters.sortBy === 'position' 
            ? "grid-cols-1"  // List view for position-based sorting without drag
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      )}>
        {/* Add Items Card (only for grid view) */}
        {filters.sortBy !== 'position' && onAddItems && (
          <Card 
            className="group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer border-dashed border-2 border-muted-foreground/25 hover:border-primary/50"
            onClick={onAddItems}
          >
            <div className="aspect-square bg-muted/50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-background border border-border rounded-full flex items-center justify-center mx-auto mb-2 group-hover:border-primary transition-colors">
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Add Items
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Collection Item Cards */}
        {items.map((item, index) => {
          const canMoveUp = index > 0;
          const canMoveDown = index < items.length - 1;
          const isDragging = draggedItem?.id === item.id;
          const isDropTarget = dragOverItem?.id === item.id;

          // Determine view mode based on sorting
          const viewMode = filters.sortBy === 'position' ? 'list' : 'grid';
          
          // Drag handle props for sortable lists
          const dragHandleProps = onItemsReorder && filters.sortBy === 'position' ? {
            draggable: true,
            onDragStart: () => handleDragStart(item),
            onDragOver: (e: React.DragEvent) => handleDragOver(e, item),
            onDragEnd: handleDragEnd,
            onDrop: handleDrop
          } : undefined;

          return (
            <div
              key={item.id}
              className={cn(
                "transition-all",
                isDropTarget && "scale-105 ring-2 ring-primary ring-offset-2"
              )}
            >
              <CollectionItemCard
                item={item}
                onRemove={onItemRemove}
                onMoveUp={canMoveUp ? onItemMoveUp : undefined}
                onMoveDown={canMoveDown ? onItemMoveDown : undefined}
                isSelected={selectedItems.has(item.id)}
                onSelect={onSelectionChange}
                showCheckbox={showSelection}
                showPosition={showPosition && filters.sortBy === 'position'}
                viewMode={viewMode}
                isDragging={isDragging}
                dragHandleProps={dragHandleProps}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
              />
            </div>
          );
        })}

        {/* Loading placeholder cards */}
        {isLoading && (
          <>
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={`loading-${index}`} className="overflow-hidden">
                {filters.sortBy === 'position' ? (
                  <div className="flex gap-4 p-4">
                    <div className="w-20 h-20 bg-muted rounded-lg animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                      <div className="flex gap-2">
                        <div className="h-6 bg-muted rounded w-16 animate-pulse" />
                        <div className="h-6 bg-muted rounded w-12 animate-pulse" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="aspect-square bg-muted animate-pulse" />
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                        <div className="flex gap-2">
                          <div className="h-6 bg-muted rounded w-16 animate-pulse" />
                          <div className="h-6 bg-muted rounded w-12 animate-pulse" />
                        </div>
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Add Items Button (list view or when no grid items) */}
      {onAddItems && (filters.sortBy === 'position' || items.length === 0) && (
        <Card 
          className="group relative overflow-hidden transition-all hover:shadow-md cursor-pointer border-dashed border-2 border-muted-foreground/25 hover:border-primary/50"
          onClick={onAddItems}
        >
          <div className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 bg-background border border-border rounded-full flex items-center justify-center group-hover:border-primary transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <h3 className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Add More Items
              </h3>
              <p className="text-sm text-muted-foreground">
                Browse your saved items or search for new ones
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Load More Button */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-6">
          <Button 
            variant="outline" 
            onClick={onLoadMore}
            className="gap-2"
          >
            Load More Items
          </Button>
        </div>
      )}

      {/* Loading More Indicator */}
      {isLoading && items.length > 0 && (
        <div className="flex justify-center items-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading more items...</span>
        </div>
      )}
    </div>
  );
} 