"use client";

import { useState, useCallback } from "react";
import { 
  Trash2, 
  Download, 
  Tag, 
  Share2, 
  X, 
  CheckSquare,
  Square,
  Loader2,
  Heart,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WishlistItemDetailed, BulkOperation } from "@/types";

interface WishlistActionsProps {
  selectedItems: WishlistItemDetailed[];
  onBulkAction: (operation: BulkOperation) => Promise<void>;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCancel: () => void;
  isAllSelected: boolean;
  totalItems: number;
  className?: string;
}

export function WishlistActions({
  selectedItems,
  onBulkAction,
  onSelectAll,
  onDeselectAll,
  onCancel,
  isAllSelected,
  totalItems,
  className
}: WishlistActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTags, setNewTags] = useState('');

  const handleBulkAction = useCallback(async (type: BulkOperation['type'], data?: { tags?: string[]; format?: string }) => {
    if (selectedItems.length === 0) return;

    setIsLoading(true);
    setLoadingAction(type);
    
    try {
      await onBulkAction({
        type,
        selectedIds: selectedItems.map(item => item.id),
        data
      });
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }, [selectedItems, onBulkAction]);

  const handleDelete = useCallback(() => {
    handleBulkAction('delete');
  }, [handleBulkAction]);

  const handleExport = useCallback(() => {
    handleBulkAction('export');
  }, [handleBulkAction]);

  const handleAddTags = useCallback(() => {
    if (!newTags.trim()) return;
    
    const tags = newTags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    if (tags.length > 0) {
      handleBulkAction('tag', { tags });
      setNewTags('');
      setShowTagInput(false);
    }
  }, [newTags, handleBulkAction]);

  const handleShare = useCallback(() => {
    handleBulkAction('export', { format: 'share' });
  }, [handleBulkAction]);

  if (selectedItems.length === 0) {
    return null;
  }

  const selectedCount = selectedItems.length;
  const totalValue = selectedItems.reduce((sum, item) => {
    return sum + (item.products.price || 0);
  }, 0);

  return (
    <div className={cn(
      "fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg max-w-4xl w-full mx-4",
      className
    )}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <span className="font-medium">
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>
            
            {totalValue > 0 && (
              <Badge variant="secondary" className="text-xs">
                Total: ${totalValue.toFixed(2)}
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Selection controls */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={isAllSelected ? onDeselectAll : onSelectAll}
            className="text-xs"
          >
            {isAllSelected ? (
              <>
                <CheckSquare className="h-4 w-4 mr-1" />
                Deselect All
              </>
            ) : (
              <>
                <Square className="h-4 w-4 mr-1" />
                Select All ({totalItems})
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground">
            {selectedCount} of {totalItems} items
          </div>
        </div>

        {/* Tag input */}
        {showTagInput && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add tags (comma separated)"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTags();
                  } else if (e.key === 'Escape') {
                    setShowTagInput(false);
                    setNewTags('');
                  }
                }}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                autoFocus
              />
              <Button
                onClick={handleAddTags}
                disabled={!newTags.trim() || isLoading}
                size="sm"
              >
                Add
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTagInput(false);
                  setNewTags('');
                }}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {loadingAction === 'delete' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remove {selectedCount} item{selectedCount !== 1 ? 's' : ''}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTagInput(!showTagInput)}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            Add Tags
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {loadingAction === 'export' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {loadingAction === 'export' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Share
          </Button>
        </div>

        {/* Quick stats */}
        <div className="mt-4 pt-3 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>{selectedCount} items</span>
            </div>
            {totalValue > 0 && (
              <div className="flex items-center gap-2">
                <span>💰</span>
                <span>${totalValue.toFixed(2)} total</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span>🏪</span>
              <span>
                {new Set(selectedItems.map(item => item.products.source)).size} sources
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>🏷️</span>
              <span>
                {new Set(
                  selectedItems.flatMap(item => [...item.tags, ...item.products.tags])
                ).size} unique tags
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 