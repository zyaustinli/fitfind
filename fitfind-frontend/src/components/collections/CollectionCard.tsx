"use client";

import { useState, useRef } from "react";
import { 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Share2,
  Eye,
  EyeOff,
  Images,
  Calendar,
  Users
} from "lucide-react";
import { cn, formatDistanceToNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { Collection } from "@/types";

interface CollectionCardProps {
  collection: Collection;
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
  onShare?: (collection: Collection) => void;
  onClick?: (collection: Collection) => void;
  className?: string;
  isSelected?: boolean;
  onSelect?: (collection: Collection, selected: boolean) => void;
  showCheckbox?: boolean;
  viewMode?: 'grid' | 'list';
}

export function CollectionCard({ 
  collection, 
  onEdit, 
  onDelete,
  onShare,
  onClick,
  className,
  isSelected = false,
  onSelect,
  showCheckbox = false,
  viewMode = 'grid'
}: CollectionCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(collection);
    setShowDropdown(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(collection);
    setShowDropdown(false);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) {
      onShare(collection);
    } else {
      try {
        const url = `${window.location.origin}/collections/${collection.id}`;
        await navigator.clipboard.writeText(url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
    setShowDropdown(false);
  };

  const handleCardClick = () => {
    onClick?.(collection);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(collection, e.target.checked);
  };

  const formatItemCount = (count?: number) => {
    if (!count) return "0 items";
    return count === 1 ? "1 item" : `${count} items`;
  };

  if (viewMode === 'list') {
    return (
      <Card className={cn(
        "group relative overflow-hidden transition-all hover:shadow-md cursor-pointer",
        isSelected && "ring-2 ring-primary ring-offset-2",
        className
      )} onClick={handleCardClick}>
        <div className="flex gap-4 p-4">
          {/* Checkbox */}
          {showCheckbox && (
            <div className="flex items-start pt-2">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Cover Image */}
          <div className="relative w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            {collection.cover_image_url && !imageError ? (
              <>
                <img
                  src={collection.cover_image_url}
                  alt={collection.name}
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
                <Images className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground leading-tight truncate">
                    {collection.name}
                  </h3>
                  {collection.is_private && (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
                {collection.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {collection.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Images className="h-3 w-3" />
                    {formatItemCount(collection.item_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(collection.updated_at))}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                <div className="relative" ref={dropdownRef}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDropdown(!showDropdown);
                    }}
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
                          <button
                            onClick={handleEdit}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit Collection
                          </button>
                          <button
                            onClick={handleShare}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                          >
                            <Share2 className="h-4 w-4" />
                            {copySuccess ? "Copied!" : "Share Collection"}
                          </button>
                          <div className="border-t border-border my-1" />
                          <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-destructive text-left"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Collection
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
      "group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer",
      isSelected && "ring-2 ring-primary ring-offset-2",
      className
    )} onClick={handleCardClick}>
      {/* Checkbox overlay */}
      {showCheckbox && (
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Privacy indicator */}
      {collection.is_private && (
        <div className="absolute top-3 right-3 z-10">
          <Badge variant="secondary" className="text-xs">
            <EyeOff className="h-3 w-3 mr-1" />
            Private
          </Badge>
        </div>
      )}

      {/* Cover Image */}
      <div className="relative aspect-video bg-muted">
        {collection.cover_image_url && !imageError ? (
          <>
            <img
              src={collection.cover_image_url}
              alt={collection.name}
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
            <Images className="w-12 h-12 text-muted-foreground" />
          </div>
        )}

        {/* Actions overlay */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
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
                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit Collection
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <Share2 className="h-4 w-4" />
                      {copySuccess ? "Copied!" : "Share Collection"}
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-destructive text-left"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Collection
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-foreground leading-tight truncate">
            {collection.name}
          </h3>
        </div>
        
        {collection.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {collection.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Images className="h-3 w-3" />
            {formatItemCount(collection.item_count)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(collection.updated_at))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
} 