"use client";

import { useState, useRef } from "react";
import { 
  Heart, 
  ExternalLink, 
  Star, 
  ShoppingBag, 
  MoreVertical,
  Edit3,
  Share2,
  Trash2,
  Check,
  FolderPlus
} from "lucide-react";
import { cn, formatPrice, truncateText, formatDistanceToNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WishlistItemDetailed } from "@/types";

interface WishlistCardProps {
  item: WishlistItemDetailed;
  onRemove?: (item: WishlistItemDetailed) => void;
  onUpdate?: (item: WishlistItemDetailed, updates: { notes?: string; tags?: string[] }) => void;
  onShare?: (item: WishlistItemDetailed) => void;
  onAddToCollection?: (item: WishlistItemDetailed) => void;
  onRemoveFromDatabase?: (item: WishlistItemDetailed) => void;
  onResaveItem?: (item: WishlistItemDetailed) => void;
  className?: string;
  isSelected?: boolean;
  onSelect?: (item: WishlistItemDetailed, selected: boolean) => void;
  showCheckbox?: boolean;
  viewMode?: 'grid' | 'list';
  context?: 'wishlist' | 'collection';
  isUnsaved?: boolean;
}

export function WishlistCard({ 
  item, 
  onRemove, 
  onUpdate,
  onShare,
  onAddToCollection,
  onRemoveFromDatabase,
  onResaveItem,
  className,
  isSelected = false,
  onSelect,
  showCheckbox = false,
  viewMode = 'grid',
  context = 'wishlist',
  isUnsaved = false
}: WishlistCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const [editTags, setEditTags] = useState(item.tags.join(', '));
  const [showDropdown, setShowDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const product = item.products;

  const handleRemove = () => {
    if (context === 'collection') {
      if (isUnsaved && onResaveItem) {
        // Item is currently unsaved, so re-save it
        onResaveItem(item);
      } else if (onRemoveFromDatabase) {
        // Item is currently saved, so unsave it
        onRemoveFromDatabase(item);
      }
    } else {
      // In wishlist context, use regular remove
      onRemove?.(item);
    }
    setShowDropdown(false);
  };

  const handleExternalLink = () => {
    if (product.product_url) {
      window.open(product.product_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      const tags = editTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      onUpdate(item, {
        notes: editNotes || undefined,
        tags
      });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditNotes(item.notes || '');
    setEditTags(item.tags.join(', '));
    setIsEditing(false);
  };

  const handleShare = async () => {
    if (onShare) {
      onShare(item);
    } else if (product.product_url) {
      try {
        // Try to use the Web Share API if available
        if (navigator.share) {
          await navigator.share({
            title: product.title,
            text: `Check out this item: ${product.title}`,
            url: product.product_url
          });
        } else {
          // Fallback to clipboard
          await navigator.clipboard.writeText(product.product_url);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        }
      } catch (err) {
        // If sharing fails, fallback to clipboard
        try {
          await navigator.clipboard.writeText(product.product_url);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        } catch (clipboardErr) {
          console.error('Failed to copy to clipboard:', clipboardErr);
          // As last resort, create a temporary text area to copy
          const textArea = document.createElement('textarea');
          textArea.value = product.product_url;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
          } catch (e) {
            console.error('All share methods failed:', e);
          }
          document.body.removeChild(textArea);
        }
      }
    }
    setShowDropdown(false);
  };

  const handleAddToCollection = () => {
    onAddToCollection?.(item);
    setShowDropdown(false);
  };

  const handleCheckboxChange = (checked: boolean) => {
    onSelect?.(item, checked);
  };

  const calculateDiscount = () => {
    if (product.old_price && product.price && product.old_price > product.price) {
      return Math.round(((product.old_price - product.price) / product.old_price) * 100);
    }
    return null;
  };

  const discount = calculateDiscount();

  if (viewMode === 'list') {
    return (
      <div className={cn(
        "group relative rounded-lg border border-border bg-card overflow-hidden transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary ring-offset-2",
        className
      )}>
        {/* Checkbox */}
        {showCheckbox && (
          <div className="flex items-start pt-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleCheckboxChange(e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
          </div>
        )}

        {/* Image */}
        <div className="relative w-24 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
          {product.image_url && !imageError ? (
            <>
              <img
                src={product.image_url}
                alt={product.title}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground leading-tight">
                {truncateText(product.title, 80)}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {product.source}
                </span>
                {product.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current text-yellow-400" />
                    <span className="text-xs text-muted-foreground">
                      {product.rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExternalLink}
                disabled={!product.product_url}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
                {showDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border rounded-md shadow-md z-10">
                    <div className="py-1">
                      {context !== 'collection' && (
                        <>
                          <button
                            onClick={handleAddToCollection}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted"
                          >
                            <FolderPlus className="h-4 w-4" />
                            Add to Collection
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setShowDropdown(false);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit Notes
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted"
                      >
                        {copySuccess ? (
                          <>
                            <Check className="h-4 w-4 text-green-600" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Share2 className="h-4 w-4" />
                            Share
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleRemove}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted",
                          isUnsaved ? "text-primary" : "text-destructive"
                        )}
                        title={isUnsaved ? "Save to wishlist" : "Remove from wishlist"}
                      >
                        <Heart className={cn(
                          "h-4 w-4 transition-all duration-75",
                          isUnsaved ? "" : "fill-current"
                        )} />
                        {isUnsaved ? "Save to Wishlist" : "Remove from Wishlist"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 mt-2">
            {product.price ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                {product.old_price && product.old_price > product.price && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.old_price)}
                    </span>
                    {discount && (
                      <Badge variant="destructive" className="text-xs">
                        -{discount}%
                      </Badge>
                    )}
                  </>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Price unavailable</span>
            )}
          </div>

          {/* Notes and Tags */}
          {(item.notes || item.tags.length > 0) && (
            <div className="mt-2 space-y-1">
              {item.notes && (
                <p className="text-sm text-muted-foreground">
                  {truncateText(item.notes, 100)}
                </p>
              )}
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {item.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{item.tags.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Added date */}
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">
              Added {formatDistanceToNow(new Date(item.created_at))}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Grid view (default)
  return (
    <div className={cn(
      "group relative rounded-lg border border-border bg-card overflow-hidden transition-all hover:shadow-lg",
      isSelected && "ring-2 ring-primary ring-offset-2",
      className
    )}>
      {/* Checkbox */}
      {showCheckbox && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleCheckboxChange(e.target.checked)}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded bg-white"
          />
        </div>
      )}

      {/* Image Section */}
      <div className="relative aspect-square bg-muted">
        {product.image_url && !imageError ? (
          <>
            <img
              src={product.image_url}
              alt={product.title}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExternalLink}
            disabled={!product.product_url}
            className="bg-white/90 text-gray-900 hover:bg-white"
          >
            <ExternalLink className="h-4 w-4" />
            View
          </Button>
          {context !== 'collection' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddToCollection}
                className="bg-white/90 text-gray-900 hover:bg-white"
              >
                <FolderPlus className="h-4 w-4" />
                Add
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="bg-white/90 text-gray-900 hover:bg-white"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
            </>
          )}
        </div>

        {/* Source badge */}
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium">
            {product.source}
          </span>
        </div>

        {/* Rating badge */}
        {product.rating && product.rating > 0 && (
          <div className="absolute bottom-2 right-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium">
              <Star className="h-3 w-3 fill-current text-yellow-400" />
              {product.rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Discount badge */}
        {discount && (
          <div className="absolute bottom-2 left-2">
            <Badge variant="destructive" className="text-xs">
              -{discount}%
            </Badge>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <h3 className="font-medium text-foreground leading-tight">
            {truncateText(product.title, 60)}
          </h3>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div>
            {product.price ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                {product.old_price && product.old_price > product.price && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(product.old_price)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Price unavailable</span>
            )}
          </div>
          
          {product.review_count && product.review_count > 0 && (
            <span className="text-xs text-muted-foreground">
              {product.review_count.toLocaleString()} reviews
            </span>
          )}
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="text-sm text-muted-foreground">
            {truncateText(item.notes, 80)}
          </div>
        )}

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {item.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{item.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Date and Actions */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.created_at))}
          </span>
          
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="h-8 w-8 p-0"
            >
              {copySuccess ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className={cn(
                "h-8 w-8 p-0 transition-colors",
                isUnsaved 
                  ? "text-muted-foreground hover:text-primary" 
                  : "text-destructive hover:text-destructive"
              )}
              title={isUnsaved ? "Save to wishlist" : "Remove from wishlist"}
            >
              <Heart className={cn(
                "h-4 w-4 transition-all duration-75",
                isUnsaved ? "" : "fill-current"
              )} />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Mode Overlay */}
      {isEditing && (
        <div className="absolute inset-0 bg-background/95 p-4 z-20">
          <div className="space-y-3">
            <h4 className="font-medium">Edit Item</h4>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add personal notes..."
                className="w-full mt-1 p-2 border border-border rounded-md text-sm resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tags</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="casual, summer, work"
                className="w-full mt-1 p-2 border border-border rounded-md text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} size="sm">
                Save
              </Button>
              <Button onClick={handleCancelEdit} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 