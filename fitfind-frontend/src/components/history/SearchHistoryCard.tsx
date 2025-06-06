"use client";

import { useState } from "react";
import { Eye, ImageIcon, AlertTriangle, Clock, CheckCircle, Loader, Trash2, Undo2, WifiOff, Check } from "lucide-react";
import { cn, formatDistanceToNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SearchHistoryItem } from "@/types";

interface SearchHistoryCardProps {
  item: SearchHistoryItem;
  onView?: (item: SearchHistoryItem) => void;
  onRedo?: (item: SearchHistoryItem) => void;
  onDelete?: (item: SearchHistoryItem) => void;
  onUndo?: () => void;
  onSelect?: (selected: boolean) => void;
  className?: string;
  isDeleting?: boolean;
  isSelected?: boolean;
  canUndo?: boolean;
  showNetworkStatus?: boolean;
}

const statusConfig = {
  uploading: {
    icon: Loader,
    label: "Uploading",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  analyzing: {
    icon: Loader,
    label: "Analyzing",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  searching: {
    icon: Loader,
    label: "Searching",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  completed: {
    icon: CheckCircle,
    label: "Ready",
    iconColor: "text-green-500",
    bgColor: "bg-green-500/10"
  },
  error: {
    icon: AlertTriangle,
    label: "Error",
    iconColor: "text-red-500",
    bgColor: "bg-red-500/10"
  }
};

export function SearchHistoryCard({ 
  item, 
  onView, 
  onRedo, 
  onDelete, 
  onUndo, 
  onSelect, 
  className,
  isDeleting = false,
  isSelected = false,
  canUndo = false,
  showNetworkStatus = false
}: SearchHistoryCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const session = item.search_sessions;
  const statusInfo = statusConfig[session.status];
  const StatusIcon = statusInfo.icon;
  
  const createdAt = new Date(item.created_at);
  const timeAgo = formatDistanceToNow(createdAt);

  const handleView = () => {
    if (!onSelect) {
      onView?.(item);
    }
  };

  const handleRedo = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRedo?.(item);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(item);
  };

  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUndo?.();
  };

  const handleSelect = (selected: boolean) => {
    onSelect?.(selected);
  };

  const toggleSelection = () => {
    handleSelect(!isSelected);
  };

  const isProcessing = session.status === 'uploading' || session.status === 'analyzing' || session.status === 'searching';
  const canInteract = !isDeleting && !isProcessing;

  return (
    <div 
      className={cn(
        "group relative aspect-[4/5] rounded-xl overflow-hidden bg-muted/30",
        "border border-border/50 hover:border-primary/20",
        "shadow-sm hover:shadow-xl hover:shadow-primary/10",
        "transition-all duration-300 ease-out",
        canInteract && "cursor-pointer hover:scale-[1.02] hover:-translate-y-1",
        isDeleting && "opacity-50 pointer-events-none",
        isSelected && "ring-2 ring-primary shadow-lg scale-[1.02]",
        showNetworkStatus && "border-orange-200 bg-orange-50/20",
        className
      )}
      onClick={onSelect ? toggleSelection : handleView}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div className="absolute top-3 left-3 z-30">
          <div 
            className={cn(
              "w-6 h-6 rounded border-2 backdrop-blur-sm flex items-center justify-center cursor-pointer transition-all",
              isSelected 
                ? "bg-primary border-primary text-white" 
                : "bg-white/90 border-white/50 hover:border-primary/50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelection();
            }}
          >
            {isSelected && <Check className="w-4 h-4" />}
          </div>
        </div>
      )}

      {/* Network Status Indicator */}
      {showNetworkStatus && !onSelect && (
        <div className="absolute top-3 left-3 z-25">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/90 text-white text-xs font-medium">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </div>
        </div>
      )}

      {/* Main Image */}
      <div className="absolute inset-0">
        {session.image_url && !imageError ? (
          <>
            <img
              src={session.image_url}
              alt={session.image_filename}
              className={cn(
                "w-full h-full object-cover transition-all duration-500",
                imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
                canInteract && "group-hover:scale-110"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            
            {/* Loading shimmer effect */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50 animate-pulse" />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Action Buttons - Top Right Corner */}
      <div className="absolute top-3 right-3 z-20 flex gap-2">
        {/* Undo Button */}
        {canUndo && onUndo && (
          <Button
            variant="secondary"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 bg-green-500/90 hover:bg-green-600 border-0 shadow-lg",
              "opacity-0 group-hover:opacity-100 transition-all duration-300",
              "transform translate-x-2 group-hover:translate-x-0"
            )}
            onClick={handleUndo}
            title="Undo deletion"
          >
            <Undo2 className="w-4 h-4 text-white" />
          </Button>
        )}

        {/* Delete Button */}
        {onDelete && !canUndo && !onSelect && (
          <Button
            variant="secondary"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 bg-red-500/90 hover:bg-red-600 border-0 shadow-lg",
              "opacity-0 group-hover:opacity-100 transition-all duration-300",
              "transform translate-x-2 group-hover:translate-x-0",
              isDeleting && "opacity-100 translate-x-0"
            )}
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete from history"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-white" />
            )}
          </Button>
        )}
      </div>

      {/* Status Indicator */}
      {(isProcessing || session.status === 'error') && !onSelect && !showNetworkStatus && (
        <div className="absolute top-3 left-3 z-10">
          <div className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 rounded-full backdrop-blur-md border border-white/20",
            statusInfo.bgColor
          )}>
            <StatusIcon className={cn(
              "w-3.5 h-3.5",
              statusInfo.iconColor,
              isProcessing && "animate-spin"
            )} />
            <span className={cn("text-xs font-medium", statusInfo.iconColor)}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      )}

      {/* Time indicator - subtle, bottom left */}
      <div className="absolute bottom-3 left-3 z-10">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm">
          <Clock className="w-3 h-3 text-white/80" />
          <span className="text-xs text-white/90 font-medium">
            {timeAgo}
          </span>
        </div>
      </div>

      {/* Items count - subtle, bottom right */}
      {session.status === 'completed' && session.num_items_identified > 0 && (
        <div className="absolute bottom-3 right-3 z-10">
          <div className="px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm">
            <span className="text-xs text-white/90 font-medium">
              {session.num_items_identified} {session.num_items_identified === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      )}

      {/* Hover Overlay */}
      {!onSelect && canInteract && (
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          "flex items-center justify-center"
        )}>
          <Button
            variant="secondary"
            size="lg"
            className={cn(
              "bg-white/95 text-gray-900 hover:bg-white border-0 shadow-xl",
              "transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300",
              "font-semibold tracking-wide"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleView();
            }}
          >
            <Eye className="w-5 h-5 mr-2" />
            View Details
          </Button>
        </div>
      )}

      {/* Selection Overlay */}
      {onSelect && isSelected && (
        <div className="absolute inset-0 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg">
            <Check className="w-6 h-6 text-white" />
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/90 text-sm font-medium">
              {session.status === 'uploading' && 'Uploading...'}
              {session.status === 'analyzing' && 'Analyzing outfit...'}
              {session.status === 'searching' && 'Finding items...'}
            </p>
          </div>
        </div>
      )}

      {/* Deleting Overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-red-500/20 backdrop-blur-[2px] flex items-center justify-center z-30">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-red-600 text-sm font-medium">
              Deleting...
            </p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {session.status === 'error' && (
        <div className="absolute inset-0 bg-red-500/10 backdrop-blur-[1px] flex items-center justify-center">
          <div className="text-center px-4">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-600 text-sm font-medium">
              Processing failed
            </p>
          </div>
        </div>
      )}

      {/* Subtle gradient border effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-primary/0 via-primary/0 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
} 