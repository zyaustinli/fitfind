"use client";

import { useState, useRef } from "react";
import { 
  MoreVertical, 
  ExternalLink, 
  Star, 
  ShoppingBag, 
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical
} from "lucide-react";
import { cn, formatPrice, truncateText, formatDistanceToNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CollectionItem, WishlistItemDetailed } from "@/types";

interface CollectionItemCardProps {
  item: CollectionItem;
  onRemove?: (item: CollectionItem) => void;
  onMoveUp?: (item: CollectionItem) => void;
  onMoveDown?: (item: CollectionItem) => void;
  onExternalLink?: (item: CollectionItem) => void;
  className?: string;
  isSelected?: boolean;
  onSelect?: (item: CollectionItem, selected: boolean) => void;
  showCheckbox?: boolean;
  showPosition?: boolean;
  viewMode?: 'grid' | 'list';
  isDragging?: boolean;
  dragHandleProps?: any;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function CollectionItemCard({ 
  item, 
  onRemove, 
  onMoveUp,
  onMoveDown,
  onExternalLink,
  className,
  isSelected = false,
  onSelect,
  showCheckbox = false,
  showPosition = false,
  viewMode = 'grid',
  isDragging = false,
  dragHandleProps,
  canMoveUp = false,
  canMoveDown = false
}: CollectionItemCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the saved item details
  const savedItem = item.user_saved_items;
  if (!savedItem) return null;

  const product = savedItem.products;

  const handleRemove = () => {
    onRemove?.(item);
    setShowDropdown(false);
  };

  const handleExternalLink = () => {
    if (product.product_url) {
      if (onExternalLink) {
        onExternalLink(item);
      } else {
        window.open(product.product_url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleMoveUp = () => {
    onMoveUp?.(item);
    setShowDropdown(false);
  };

  const handleMoveDown = () => {
    onMoveDown?.(item);
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
      <Card className={cn(
        "group relative overflow-hidden transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary ring-offset-2",
        isDragging && "opacity-50 shadow-lg",
        className
      )}>
        <div className="flex gap-4 p-4">
          {/* Drag Handle */}
          {dragHandleProps && (
            <div 
              {...dragHandleProps}
              className="flex items-center cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {/* Position indicator */}
          {showPosition && (
            <div className="flex items-center text-sm text-muted-foreground font-mono w-8">
              #{item.position}
            </div>
          )}

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
          <div className="relative w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
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
                <ShoppingBag className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground leading-tight">
                  {truncateText(product.title, 60)}
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

                {/* Price */}
                <div className="flex items-center gap-2 mt-2">
                  {product.price && (
                    <span className="font-semibold text-foreground">
                      {formatPrice(product.price)}
                    </span>
                  )}
                  {product.old_price && product.old_price > (product.price || 0) && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.old_price)}
                    </span>
                  )}
                  {discount && (
                    <Badge variant="destructive" className="text-xs">
                      {discount}% off
                    </Badge>
                  )}
                </div>

                {/* Tags */}
                {savedItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {savedItem.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {savedItem.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{savedItem.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
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
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowDropdown(false)} 
                      />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg z-20">
                        <div className="py-1">
                          {canMoveUp && (
                            <button
                              onClick={handleMoveUp}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                            >
                              <ArrowUp className="h-4 w-4" />
                              Move Up
                            </button>
                          )}
                          {canMoveDown && (
                            <button
                              onClick={handleMoveDown}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                            >
                              <ArrowDown className="h-4 w-4" />
                              Move Down
                            </button>
                          )}
                          {(canMoveUp || canMoveDown) && (
                            <div className="border-t border-border my-1" />
                          )}
                          <button
                            onClick={handleRemove}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-destructive text-left"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove from Collection
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Grid view
  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all hover:shadow-lg",
      isSelected && "ring-2 ring-primary ring-offset-2",
      isDragging && "opacity-50 shadow-lg",
      className
    )}>
      {/* Drag Handle overlay */}
      {dragHandleProps && (
        <div 
          {...dragHandleProps}
          className="absolute top-2 left-2 z-10 p-1 bg-background/80 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Position indicator */}
      {showPosition && (
        <div className="absolute top-2 left-2 z-10 bg-background/90 text-xs font-mono px-2 py-1 rounded">
          #{item.position}
        </div>
      )}

      {/* Checkbox overlay */}
      {showCheckbox && (
        <div className="absolute top-3 right-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleCheckboxChange(e.target.checked)}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
          />
        </div>
      )}

      {/* Image */}
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
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          </div>
        )}

        {/* Discount badge */}
        {discount && (
          <div className="absolute top-2 left-2">
            <Badge variant="destructive" className="text-xs">
              {discount}% off
            </Badge>
          </div>
        )}

        {/* Actions overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExternalLink}
            disabled={!product.product_url}
            className="h-8 w-8 p-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDropdown(!showDropdown)}
              className="h-8 w-8 p-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowDropdown(false)} 
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg z-20">
                  <div className="py-1">
                    {canMoveUp && (
                      <button
                        onClick={handleMoveUp}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        <ArrowUp className="h-4 w-4" />
                        Move Up
                      </button>
                    )}
                    {canMoveDown && (
                      <button
                        onClick={handleMoveDown}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        <ArrowDown className="h-4 w-4" />
                        Move Down
                      </button>
                    )}
                    {(canMoveUp || canMoveDown) && (
                      <div className="border-t border-border my-1" />
                    )}
                    <button
                      onClick={handleRemove}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-destructive text-left"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove from Collection
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-medium text-foreground leading-tight line-clamp-2">
            {product.title}
          </h3>
          
          <div className="flex items-center gap-2">
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

          {/* Price */}
          <div className="flex items-center gap-2">
            {product.price && (
              <span className="font-semibold text-foreground">
                {formatPrice(product.price)}
              </span>
            )}
            {product.old_price && product.old_price > (product.price || 0) && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.old_price)}
              </span>
            )}
          </div>

          {/* Tags */}
          {savedItem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {savedItem.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {savedItem.tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{savedItem.tags.length - 2}
                </Badge>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Added {formatDistanceToNow(new Date(item.added_at))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 