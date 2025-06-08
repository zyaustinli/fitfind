"use client";

import { cn } from "@/lib/utils";

interface WishlistLoadingProps {
  viewMode?: 'grid' | 'list';
  itemCount?: number;
  className?: string;
}

export function WishlistLoading({ 
  viewMode = 'grid', 
  itemCount = 8,
  className 
}: WishlistLoadingProps) {
  const skeletonItems = Array.from({ length: itemCount }, (_, i) => i);

  if (viewMode === 'list') {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-4 bg-muted rounded w-24 animate-pulse" />
          <div className="h-8 bg-muted rounded w-20 animate-pulse" />
        </div>

        {/* List items skeleton */}
        <div className="space-y-3">
          {skeletonItems.map((i) => (
            <div 
              key={i}
              className="border border-border rounded-lg bg-card overflow-hidden"
            >
              <div className="flex gap-4 p-4">
                {/* Image skeleton */}
                <div className="w-24 h-24 bg-muted rounded-lg animate-pulse flex-shrink-0" />
                
                {/* Content skeleton */}
                <div className="flex-1 space-y-3">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="flex items-center gap-2">
                      <div className="h-3 bg-muted rounded animate-pulse w-16" />
                      <div className="h-3 bg-muted rounded animate-pulse w-12" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="h-6 bg-muted rounded animate-pulse w-20" />
                    <div className="h-4 bg-muted rounded animate-pulse w-16" />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded animate-pulse w-full" />
                    <div className="flex gap-1">
                      <div className="h-5 bg-muted rounded animate-pulse w-12" />
                      <div className="h-5 bg-muted rounded animate-pulse w-16" />
                    </div>
                  </div>
                  
                  <div className="h-3 bg-muted rounded animate-pulse w-20" />
                </div>
                
                {/* Actions skeleton */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Grid view skeleton
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-4 bg-muted rounded w-24 animate-pulse" />
        <div className="h-8 bg-muted rounded w-20 animate-pulse" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {skeletonItems.map((i) => (
          <div 
            key={i}
            className="border border-border rounded-lg bg-card overflow-hidden"
          >
            {/* Image skeleton */}
            <div className="aspect-square bg-muted animate-pulse" />
            
            {/* Content skeleton */}
            <div className="p-4 space-y-3">
              {/* Title */}
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              </div>
              
              {/* Price */}
              <div className="flex items-center justify-between">
                <div className="h-6 bg-muted rounded animate-pulse w-20" />
                <div className="h-3 bg-muted rounded animate-pulse w-16" />
              </div>
              
              {/* Notes */}
              <div className="h-3 bg-muted rounded animate-pulse w-full" />
              
              {/* Tags */}
              <div className="flex gap-1">
                <div className="h-5 bg-muted rounded animate-pulse w-12" />
                <div className="h-5 bg-muted rounded animate-pulse w-16" />
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div className="h-3 bg-muted rounded animate-pulse w-20" />
                <div className="flex gap-1">
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 