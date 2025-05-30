"use client";

import { useState } from "react";
import { Calendar, Clock, Search, Eye, RotateCcw, Trash2, ImageIcon, ShoppingBag, Star, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { cn, formatDistanceToNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SearchHistoryItem } from "@/types";

interface SearchHistoryCardProps {
  item: SearchHistoryItem;
  onView?: (item: SearchHistoryItem) => void;
  onRedo?: (item: SearchHistoryItem) => void;
  onDelete?: (item: SearchHistoryItem) => void;
  className?: string;
}

const statusConfig = {
  uploading: {
    icon: Loader,
    label: "Uploading",
    variant: "secondary" as const,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  analyzing: {
    icon: Loader,
    label: "Analyzing",
    variant: "secondary" as const,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  searching: {
    icon: Search,
    label: "Searching",
    variant: "secondary" as const,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    variant: "default" as const,
    color: "text-green-600",
    bgColor: "bg-green-50"
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    variant: "destructive" as const,
    color: "text-red-600",
    bgColor: "bg-red-50"
  }
};

export function SearchHistoryCard({ item, onView, onRedo, onDelete, className }: SearchHistoryCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const session = item.search_sessions;
  const statusInfo = statusConfig[session.status];
  const StatusIcon = statusInfo.icon;
  
  const createdAt = new Date(item.created_at);
  const timeAgo = formatDistanceToNow(createdAt);
  
  // Calculate average price from products
  const avgPrice = session.clothing_items && session.clothing_items.length > 0 
    ? session.clothing_items.reduce((acc, clothingItem) => {
        return acc + (clothingItem.price_range_average || 0);
      }, 0) / session.clothing_items.length
    : 0;

  const handleView = () => {
    onView?.(item);
  };

  const handleRedo = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRedo?.(item);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(item);
  };

  return (
    <div 
      className={cn(
        "group relative rounded-lg border border-border bg-card overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 cursor-pointer",
        className
      )}
      onClick={handleView}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={statusInfo.variant} className="text-xs">
                <StatusIcon className={cn("w-3 h-3 mr-1", session.status === 'analyzing' || session.status === 'uploading' ? "animate-spin" : "")} />
                {statusInfo.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {timeAgo}
              </span>
            </div>
            
            <h3 className="font-medium text-foreground truncate mb-1">
              {session.image_filename}
            </h3>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" />
                {session.num_items_identified} items
              </span>
              <span className="flex items-center gap-1">
                <Search className="w-4 h-4" />
                {session.num_products_found} products
              </span>
            </div>
          </div>
          
          {/* Image thumbnail */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {session.image_url && !imageError ? (
              <>
                <img
                  src={session.image_url}
                  alt={session.image_filename}
                  className={cn(
                    "w-full h-full object-cover transition-opacity duration-300",
                    imageLoaded ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                {!imageLoaded && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Queries Preview */}
      {session.search_queries && session.search_queries.length > 0 && (
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="text-xs text-muted-foreground mb-2 font-medium">
            Search Queries
          </div>
          <div className="flex flex-wrap gap-1">
            {session.search_queries.slice(0, 3).map((query, index) => (
              <Badge key={index} variant="outline" className="text-xs px-2 py-1">
                {query.length > 25 ? `${query.substring(0, 25)}...` : query}
              </Badge>
            ))}
            {session.search_queries.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-1">
                +{session.search_queries.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Results Preview */}
      {session.clothing_items && session.clothing_items.length > 0 && (
        <div className="p-4">
          <div className="text-xs text-muted-foreground mb-3 font-medium">
            Found Items
          </div>
          <div className="grid grid-cols-2 gap-2">
            {session.clothing_items.slice(0, 2).map((clothingItem, index) => (
              <div key={index} className="text-xs space-y-1">
                <div className="font-medium text-foreground truncate">
                  {clothingItem.item_type}
                </div>
                <div className="text-muted-foreground">
                  {clothingItem.total_products} products
                </div>
                {clothingItem.price_range_average && (
                  <div className="text-primary font-medium">
                    ~${clothingItem.price_range_average.toFixed(0)}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {session.clothing_items.length > 2 && (
            <div className="mt-3 text-xs text-center text-muted-foreground">
              +{session.clothing_items.length - 2} more items
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {session.status === 'error' && session.error_message && (
        <div className="p-4 bg-destructive/5 border-t border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-xs text-destructive">
              {session.error_message}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleView}
          className="bg-white/90 text-gray-900 hover:bg-white"
        >
          <Eye className="h-4 w-4" />
          View
        </Button>
        
        {session.status === 'completed' && session.conversation_context && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRedo}
            className="bg-white/90 text-gray-900 hover:bg-white"
          >
            <RotateCcw className="h-4 w-4" />
            Redo
          </Button>
        )}
        
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDelete}
          className="bg-white/90 text-red-600 hover:bg-white hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Quick stats footer */}
      <div className="px-4 py-2 bg-muted/50 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {createdAt.toLocaleDateString()}
          </div>
          
          {avgPrice > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              Avg: ${avgPrice.toFixed(0)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 