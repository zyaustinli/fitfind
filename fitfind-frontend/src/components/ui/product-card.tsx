"use client";

import { useState } from "react";
import { Heart, ExternalLink, Star, ShoppingBag } from "lucide-react";
import { cn, formatPrice, truncateText } from "@/lib/utils";
import { Button } from "./button";
import type { ClothingItem } from "@/types";

interface ProductCardProps {
  item: ClothingItem;
  onSave?: (item: ClothingItem) => void;
  onRemove?: (item: ClothingItem) => void;
  isSaved?: boolean;
  className?: string;
  hideSearchQuery?: boolean;
}

export function ProductCard({ 
  item, 
  onSave, 
  onRemove, 
  isSaved = false, 
  className,
  hideSearchQuery = false
}: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleSaveToggle = () => {
    if (isSaved && onRemove) {
      onRemove(item);
    } else if (!isSaved && onSave) {
      onSave(item);
    }
  };

  const handleShopClick = () => {
    if (item.link) {
      window.open(item.link, '_blank', 'noopener,noreferrer');
    }
  };

  if (item.error) {
    return (
      <div className={cn(
        "rounded-lg border border-destructive/20 bg-destructive/5 p-4",
        className
      )}>
        <div className="text-center text-sm text-destructive">
          {item.error}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "group relative rounded-lg border border-border bg-card overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary/5",
      className
    )}>
      {/* Image Section */}
      <div className="relative aspect-square bg-muted">
        {item.thumbnail && !imageError ? (
          <>
            <img
              src={item.thumbnail}
              alt={item.title || "Product image"}
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
            onClick={handleShopClick}
            disabled={!item.link}
            className="bg-white/90 hover:bg-white text-gray-900"
          >
            <ExternalLink className="h-4 w-4" />
            Shop
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveToggle}
            className={cn(
              "bg-white/90 hover:bg-white",
              isSaved ? "text-red-600" : "text-gray-900"
            )}
          >
            <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
            {isSaved ? "Saved" : "Save"}
          </Button>
        </div>

        {/* Source badge */}
        {item.source && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium">
              {item.source}
            </span>
          </div>
        )}

        {/* Rating badge */}
        {item.rating && item.rating > 0 && (
          <div className="absolute bottom-2 right-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium">
              <Star className="h-3 w-3 fill-current text-yellow-400" />
              {item.rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <h3 className="font-medium text-foreground leading-tight">
            {item.title ? truncateText(item.title, 60) : "Untitled Product"}
          </h3>
          {!hideSearchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              Search: {truncateText(item.query, 40)}
            </p>
          )}
        </div>

        {/* Price and Reviews */}
        <div className="flex items-center justify-between">
          <div>
            {item.price ? (
              <span className="text-lg font-bold text-foreground">
                {formatPrice(item.price)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Price unavailable</span>
            )}
          </div>
          
          {item.reviews && item.reviews > 0 && (
            <span className="text-xs text-muted-foreground">
              {item.reviews.toLocaleString()} reviews
            </span>
          )}
        </div>

        {/* Shipping info */}
        {item.shipping && (
          <div className="text-xs text-muted-foreground">
            {item.shipping}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {/* Shop Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShopClick}
            disabled={!item.link}
            className="flex-1 transition-all duration-200"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Shop Now
          </Button>

          {/* Save/Unsave Button */}
          <Button
            variant={isSaved ? "destructive" : "ghost"}
            size="sm"
            onClick={handleSaveToggle}
            className="px-2"
            title={isSaved ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
          </Button>
        </div>
      </div>
    </div>
  );
} 